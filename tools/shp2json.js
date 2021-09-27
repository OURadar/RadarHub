//
//  shp2json.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/9/2021.
//

function handleShapefile(source, keys, asLabel = true) {
  let k = 0;
  let raw = [];
  const nameKey = keys.name;
  const weightKey = keys.weight ?? false;
  const populationKey = keys.population ?? false;

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

function convert({ src, keys, isLabel }) {
  const dst = src.concat(".json");
  console.log(`Generating ${dst} ...`);

  require("../frontend/node_modules/shapefile")
    .open(src)
    .then((source) => handleShapefile(source, keys, isLabel))
    // .then((list) => sortByWeight(list))
    .then((list) => {
      const fs = require("fs");
      fs.writeFileSync(dst, JSON.stringify(list, replacer));
      console.log(`Map ${dst} contains ${list.length.toLocaleString()} parts`);
    });
}

const configs = [
  {
    src: "../frontend/static/maps/World/cities.shp",
    keys: {
      name: "CITY_NAME",
      weight: "POP_RANK",
    },
    isLabel: true,
  },
  {
    src: "../frontend/static/maps/United States/citiesx020.shp",
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
