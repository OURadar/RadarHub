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
    } else if (
      shape.geometry.type.includes("Polygon") ||
      shape.geometry.type.includes("MultiLineString")
    ) {
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
  let translate = [-158.5, 10.5];
  let scale = [0.000005, 0.000005];

  let arcs = [];
  let count = 0;
  lines.forEach((line) => {
    let lon = translate[0];
    let lat = translate[1];
    let arc = [];
    line.forEach((point) => {
      x = point[0] - lon;
      y = point[1] - lat;
      arc.push([
        parseInt(Math.round(x / scale[0])),
        parseInt(Math.round(y / scale[1])),
      ]);
      lon = point[0];
      lat = point[1];
    });
    // console.log(arc);
    arcs.push(arc);
    count += arc.length;
  });

  return {
    type: "Topology",
    bbox: [min_lon, min_lat, min_lat, max_lat],
    transform: {
      scale: scale,
      translate: translate,
    },
    count: count,
    arcs: arcs,
  };
}

function convert({ src, keys, isLabel }, method = 1) {
  const dst =
    method == 0
      ? src.concat(".json")
      : src.split(".").slice(0, -1).join(".").concat(".st.json");
  console.log(`Generating ${dst} ...`);

  require("../frontend/node_modules/shapefile")
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
          console.log(`count = ${dict.count}`);
          let count = dict.arcs.length.toLocaleString();
          console.log(`Transformed map ${dst} contains ${count} lines`);
        }
        require("fs").writeFileSync(dst, JSON.stringify(dict));
      } else {
        fs.writeFileSync(dst, JSON.stringify(list, replacer));
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

const configs = [
  {
    src: "../frontend/static/maps/United States/gz_2010_us_050_00_500k.shp",
    isLabel: false,
  },
  {
    src: "../frontend/static/maps/United States/intrstat.shp",
    isLabel: false,
  },
];

// const configs = [
//   {
//     src: "../frontend/static/maps/United States/intrstat.shp",
//     isLabel: false,
//   },
// ];

configs.forEach((config) => {
  convert(config);
});
