//
//  shp2json.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/9/2021.
//

function handleShapefile(source, keys, asLabel = true, show = false) {
  let k = 0;
  let raw = [];
  const nameKey = keys?.name;
  const weightKey = keys?.weight ?? false;
  const populationKey = keys?.population ?? false;

  const handleLabel = (input) => {
    let props = {};
    // props[nameKey] = input.properties[nameKey];
    // if (weightKey) props[weightKey] = input.properties[weightKey];
    // if (populationKey) props[populationKey] = input.properties[populationKey];
    props["N"] = input.properties[nameKey];
    if (weightKey) props["W"] = input.properties[weightKey];
    if (populationKey) props["P"] = input.properties[populationKey];
    const label = {
      G: {
        C: input.geometry.coordinates,
      },
      P: props,
    };
    if (k++ < 3 && show) {
      console.log(input);
      console.log("...");
      console.log(label);
      console.log("...");
      console.log(JSON.stringify(label, replacer));
      console.log("===");
    }
    raw.push(label);
  };

  const handlePoly = (input) => {
    const poly = {
      geometry: {
        type: input.geometry.type,
        coordinates: input.geometry.coordinates,
      },
    };
    if (k++ < 3 && show) {
      console.log(input);
      console.log("...");
      console.log(input.geometry.coordinates);
      console.log("...");
      console.log(JSON.stringify(poly));
      console.log("===");
    }
    raw.push(poly);
  };

  return source.read().then(function retrieve(result) {
    if (result.done) {
      return raw;
    }
    if (asLabel) handleLabel(result.value);
    else handlePoly(result.value);
    return source.read().then(retrieve);
  });
}

function sortByWeight(raw) {
  raw.sort((a, b) => {
    return a.weight > b.weight;
  });
  return raw;
}

function replacer(key, val) {
  if (key[0] == "P" && val == -99999) return 0;
  return val.toFixed ? Number(val.toFixed(5)) : val;
}

//

// const src = "../frontend/static/maps/United States/gz_2010_us_050_00_500k.shp";
// const keys = {
//   name: "NAME",
//   weight: "CENSUSAREA",
// };
// const isLabel = false;

//

function shapefile2ShpJSON(data) {
  let lines = [];
  data.forEach((shape) => {
    if (shape.geometry.type.includes("MultiPolygon")) {
      shape.geometry.coordinates.forEach((multipolygon) => {
        multipolygon.forEach((polygon) => {
          lines.push(polygon);
        });
      });
    } else if (shape.geometry.type.includes("Polygon") || shape.geometry.type.includes("MultiLineString")) {
      shape.geometry.coordinates.forEach((polygon) => {
        lines.push(polygon);
      });
    } else if (shape.geometry.type.includes("LineString")) {
      lines.push(shape.geometry.coordinates);
    }
  });
  return lines;
}

function shapefile2TransformJSON(data) {
  let lines = shapefile2ShpJSON(data);

  console.log(`SHP contains ${lines.length} segments`);

  let min_lon = 180,
    max_lon = -180,
    min_lat = 90,
    max_lat = -90;
  lines.forEach((line) => {
    line.forEach((point) => {
      min_lon = Math.min(min_lon, point[0]);
      max_lon = Math.max(max_lon, point[0]);
      min_lat = Math.min(min_lat, point[1]);
      max_lat = Math.max(max_lat, point[1]);
    });
  });

  // let translate = [min_lon, min_lat];
  // let scale = [
  //   (max_lon - min_lon) / 100000000,
  //   (max_lat - min_lat) / 100000000,
  // ];
  // let b = [-158.5, 10.5];
  // let w = [0.000005, 0.000005];
  const b = [-95.7129, 37.0902];
  const w = [0.0001, 0.0001];

  let arcs = [];
  let count = 0;
  let k = 0;
  let sdx = 0;
  let sdy = 0;
  let mdx = 0;
  let mdy = 0;
  lines.forEach((line) => {
    let lon = b[0];
    let lat = b[1];
    let arc = [];
    let point = [0, 0];
    // if (
    //   Math.abs(line[0][0] + 97.43722) > 0.5 ||
    //   Math.abs(line[0][1] - 35.18138) > 0.5
    // ) {
    //   // console.log(`k = ${k}`);
    //   return;
    // }
    line.forEach((coord) => {
      let qlon = Math.round((coord[0] - b[0]) / w[0]) * w[0] + b[0];
      let qlat = Math.round((coord[1] - b[1]) / w[1]) * w[1] + b[1];
      let x = qlon - lon;
      let y = qlat - lat;
      const p = [parseInt(Math.round(x / w[0])), parseInt(Math.round(y / w[1]))];
      arc.push(p);
      // Reconstruct coordinate
      point[0] += p[0];
      point[1] += p[1];
      let rlon = w[0] * point[0] + b[0];
      let rlat = w[1] * point[1] + b[1];
      let dx = coord[0] - rlon;
      let dy = coord[1] - rlat;
      // console.log(`${coord[0]}, ${coord[1]} -> ${rlon}, ${rlat}`);
      // lon = coord[0]
      // lat = coord[1]
      lon = qlon;
      lat = qlat;
      // Some statistics
      mdx += dx;
      mdy += dy;
      sdx += dx * dx;
      sdy += dy * dy;
      k++;
    });
    // console.log(arc);
    arcs.push(arc);
    count += arc.length;
  });
  mdx /= k;
  mdy /= k;
  sdx = Math.sqrt(sdx / k - mdx * mdx);
  sdy = Math.sqrt(sdy / k - mdy * mdy);
  console.log(`Mean ${mdx}, ${mdy}`);
  console.log(`STD ${sdx}, ${sdy}`);

  return {
    type: "Topology",
    bbox: [min_lon, min_lat, min_lat, max_lat],
    transform: {
      scale: w,
      translate: b,
    },
    count: count,
    arcs: arcs,
  };
}

function convert({ src, keys, isLabel }, method = 1) {
  const dst = method == 0 ? src.concat(".json") : src.split(".").slice(0, -1).join(".").concat(".stqv1.json");
  console.log(`Generating ${dst} ...`);

  require("./node_modules/shapefile")
    .open(src)
    .then((source) => handleShapefile(source, keys, isLabel))
    // .then((list) => sortByWeight(list))
    .then((list) => {
      if (!isLabel) {
        let dict = {};
        if (method == 0) {
          dict = shapefile2ShpJSON(list);
          let count = dict.length.toLocaleString();
          console.log(`Map ${dst} contains ${count} parts`);
        } else {
          dict = shapefile2TransformJSON(list);
          let count = dict.arcs.length.toLocaleString();
          console.log(`Transformed map ${dst} contains ${count} lines`);
        }
        require("fs").writeFileSync(dst, JSON.stringify(dict));
      } else {
        console.log(list.slice(0, 21));
        require("fs").writeFileSync(dst, JSON.stringify(list, replacer));
      }
    });
}

// const configs = [
//   {
//     src: "../frontend/static/maps/World/cities.shp",
//     keys: {
//       name: "CITY_NAME",
//       weight: "POP_RANK",
//     },
//     isLabel: true,
//   },
//   {
//     src: "../frontend/static/maps/United States/citiesx020.shp",
//     keys: {
//       name: "NAME",
//       population: "POP_2000",
//     },
//     isLabel: true,
//   },
// ];

// const configs = [
//   {
//     src: "../frontend/static/maps/United States/_extracted/gz_2010_us_050_00_500k.shp",
//     isLabel: false,
//   },
//   {
//     src: "../frontend/static/maps/United States/_extracted/intrstat.shp",
//     isLabel: false,
//   },
// ];

const configs = [
  {
    src: "../frontend/static/maps/United States/_extracted/intrstat.shp",
    isLabel: false,
  },
  {
    src: "../frontend/static/maps/United States/_extracted/citiesx020.shp",
    keys: {
      name: "NAME",
      population: "POP_2000",
    },
    isLabel: true,
  },
];

configs.forEach((config) => {
  convert(config);
});
