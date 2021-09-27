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
    props[nameKey] = input.properties[nameKey];
    if (weightKey) props[weightKey] = input.properties[weightKey];
    if (populationKey) props[populationKey] = input.properties[populationKey];
    const label = {
      geometry: {
        coordinates: input.geometry.coordinates,
      },
      properties: props,
    };
    if (k++ < 3) {
      console.log(input);
      console.log(label);
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
      console.log(poly);
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

//

// const src = "../frontend/static/maps/United States/citiesx020.shp";
// const keys = {
//   name: "NAME",
//   population: "POP_2000",
// };
// const isLabel = true;

// const src = "../frontend/static/maps/World/cities.shp";
// const keys = {
//   name: "CITY_NAME",
//   weight: "POP_RANK",
// };
// const isLabel = true;

const src = "../frontend/static/maps/United States/gz_2010_us_050_00_500k.shp";
const keys = {
  name: "NAME",
  weight: "CENSUSAREA",
};
const isLabel = false;

const dst = src.concat(".json");
console.log(`Generating ${dst} ...`);

require("../frontend/node_modules/shapefile")
  .open(src)
  .then((source) => handleShapefile(source, keys, isLabel))
  // .then((list) => sortByWeight(list))
  .then((list) => {
    const fs = require("fs");
    fs.writeFileSync(
      dst,
      JSON.stringify(list, function (key, val) {
        return val.toFixed ? Number(val.toFixed(6)) : val;
      })
    );
    console.log(`list contains ${list.length.toLocaleString()} parts`);
  });
