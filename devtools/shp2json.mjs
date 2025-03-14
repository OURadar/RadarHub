//
//  shp2json.mjs
//  RadarHub
//
//  Created by Boonleng Cheong on 7/22/2024.
//

import { readFileSync, writeFileSync } from "fs";
import shp from "shpjs";

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

function replacer(key, val) {
  if (key[0] == "P" && val == -99999) return 0;
  return val.toFixed ? Number(val.toFixed(5)) : val;
}

async function convert({ src, keys, isLabel }) {
  const dst = src.split(".").slice(0, -1).join(".").concat(".stq.json");
  console.log(`Generating ${dst} ...`);
  try {
    const data = readFileSync(src);
    const geojson = await shp(data);
    if (!isLabel) {
      let dict = shapefile2TransformJSON(geojson.features);
      let count = dict.arcs.length.toLocaleString();
      console.log(`Transformed map ${dst} contains ${count} lines`);
      writeFileSync(dst, JSON.stringify(dict));
    } else {
      const nameKey = keys?.name;
      const weightKey = keys?.weight ?? false;
      const populationKey = keys?.population ?? false;
      const dict = geojson.features.map((feature) => {
        let props = { N: feature.properties[nameKey] };
        if (weightKey) props["W"] = feature.properties[weightKey];
        if (populationKey) props["P"] = feature.properties[populationKey];
        return { G: { C: feature.geometry.coordinates }, P: props };
      });
      console.log(dict.slice(0, 21));
      writeFileSync(dst, JSON.stringify(dict, replacer));
    }
  } catch (error) {
    console.error("Error loading shapefile:", error);
  }
}

//
//   M a i n
//

const configs = [
  {
    src: "../frontend/static/maps/United States/gz_2010_us_040_00_500k.zip",
    isLabel: false,
  },
  {
    src: "../frontend/static/maps/United States/gz_2010_us_050_00_500k.zip",
    isLabel: false,
  },
  {
    src: "../frontend/static/maps/United States/intrstat.zip",
    isLabel: false,
  },
  {
    src: "../frontend/static/maps/United States/citiesx020.zip",
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
