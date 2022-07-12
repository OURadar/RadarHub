//
//  shp2json.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/9/2021.
//

function handleShapefile(source, keys, asLabel = true) {
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
    if (k++ < 3) {
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
    if (k++ < 3) {
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

function shapefile2JSON(data) {
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

  const mid_lon = 0.5 * (min_lon + max_lon);
  const mid_lat = 0.5 * (min_lat + max_lat);

  let translate = [mid_lon, mid_lat];
  let scale = [65535 / (max_lon - min_lon), 65535 / (max_lat - min_lat)];

  let dic = {
    type: "Topology",
    bbox: [-180, 0, 180, 80],
    transform: {
      scale: scale,
      translate: translate,
    },
    objects: {},
    arcs: [],
  };
  console.log(dic);

  console.log(`lon = [${min_lon} ${max_lon}]`);
  console.log(`lat = [${min_lat} ${max_lat}]`);

  lines.forEach((line) => {
    let k = 0;
    let lon0 = 0,
      lat0 = 0;
    line.forEach((point) => {
      if (k == 0) {
        // arc.push([(point[0] - translate[0]) / scale[0], (point[1] - translate[1]) / scale[1]]);
        lon0 = point[0];
        lat0 = point[1];
        let x0 = (point[0] - translate[0]) / scale[0];
        let y0 = (point[1] - translate[1]) / scale[1];
        console.log(`k = ${k}   ${x0}, ${y0}`);
      } else {
        let x = (point[0] - lon0) * scale[0];
        let y = (point[1] - lat0) * scale[1];
        console.log(`k = ${k}   ${x}, ${y}`);
      }
      k++;
    });
  });
}

function convert({ src, keys, isLabel }) {
  const dst = src.concat(".json");
  console.log(`Generating ${dst} ...`);

  require("../frontend/node_modules/shapefile")
    .open(src)
    .then((source) => handleShapefile(source, keys, isLabel))
    // .then((list) => sortByWeight(list))
    .then((list) => {
      if (!isLabel) {
        list = shapefile2JSON(list);
      }
      // const fs = require("fs");
      // fs.writeFileSync(dst, JSON.stringify(list, replacer));
      // console.log(`Map ${dst} contains ${list.length.toLocaleString()} parts`);
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
//     src: "../frontend/static/maps/United States/gz_2010_us_050_00_500k.shp",
//     isLabel: false,
//   },
//   {
//     src: "../frontend/static/maps/United States/intrstat.shp",
//     isLabel: false,
//   },
// ];

const configs = [
  {
    src: "../frontend/static/maps/United States/intrstat.shp",
    isLabel: false,
  },
];

configs.forEach((config) => {
  convert(config);
});
