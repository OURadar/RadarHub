//
//  text.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/1/2021.
//

import { common } from "@mui/material/colors";
import { deg, earthRadius } from "./common";

//
//  Initialize as:
//  obj = Text()
//
//  Update as:
//  buffer = obj.load(files, model, colors)
//

class Text {
  constructor(debug = false) {
    this.debug = debug;
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;
    this.scale = this.ratio > 1 ? 1 : 1.2;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 4096;
    this.canvas.height = 4096;
    this.context = this.canvas.getContext("2d");
    this.context.translate(0, this.canvas.height);
    this.context.scale(1, -1);
    this.stroke = 3.5 * this.scale * this.ratio;
    this.busy = false;
    this.context.font = "14px LabelFont";
    let meas = this.context.measureText("bitcoin");
    this.initWidth = meas.width;
    this.hasDetails =
      undefined !== meas.actualBoundingBoxAscent &&
      undefined !== meas.actualBoundingBoxDescent;
    this.tic = 0;

    // Binding methods
    this.load = this.load.bind(this);
    this.makeBuffer = this.makeBuffer.bind(this);

    if (debug) {
      const o = document.getElementById("test");
      if (o) {
        o.appendChild(this.canvas);
      }
    }
  }

  async load(configs, colors) {
    if (this.busy) {
      console.log("Text.load() is busy.");
      return;
    }
    if (configs === undefined) {
      console.log("Input undefined.");
      return;
    }
    let texts = [];
    let points = [];
    let allLabels = [];
    for (const config of configs) {
      const labels = await makeLabels(config, colors);
      if (!Array.isArray(labels)) continue;
      if (config.name.includes("@")) {
        allLabels.push(...labels);
      } else {
        if (this.debug) console.log(config.name, labels.length);
        labels.forEach((label) => {
          const index = texts.indexOf(label.text);
          if (index > 0) {
            const d = distance(label.point, points[index]);
            if (d < 5) {
              if (this.debug) {
                console.log(
                  `Duplicate %c${label.text}%c  range = ${d.toFixed(2)} km`,
                  "color: mediumpurple",
                  "color: normal"
                );
                console.log(label);
                var item = Object.entries(allLabels).find(
                  (x) => x[1].text == label.text
                )[1];
                console.log(item);
              }
              return;
            }
          }
          texts.push(label.text);
          points.push(label.point);
          allLabels.push(label);
        });
      }
    }
    allLabels.sort((a, b) => a.weight - b.weight);

    // var item = Object.entries(allLabels).find((a) => a[1].text == "Criner");
    // console.log(item);
    // var item = Object.entries(allLabels).find((a) => a[1].text == "Norman")[1];
    // console.log(item);
    // var item = Object.entries(allLabels).find((a) => a[1].text == "Hall Park")[1];
    // console.log(item);

    // I Love You 3,000 -Morgan Stark
    allLabels = allLabels.slice(0, 3000);
    return this.makeBuffer(allLabels);
  }

  async makeBuffer(labels) {
    this.busy = true;
    const scratch = { data: [], height: 0, width: this.canvas.width };
    const p = Math.ceil(this.stroke);
    const q = Math.ceil(this.stroke - 1.0);
    let f = 0;
    let u = 0.5;
    let v = 0.5;
    let coords = [];
    let points = [];
    let weights = [];
    let origins = [];
    let spreads = [];
    let originOffset = 0;

    const context = this.context;
    context.lineWidth = this.stroke;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // const t1 = Date.now();

    const len = labels.length;
    const scale = this.scale * this.ratio;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const useDetails = this.hasDetails;
    for (let k = 0; k < len; k++) {
      const label = labels[k];
      const size = Math.round((label.size ?? 15) * scale);
      context.font = `${size}px LabelFont`;
      const measure = context.measureText(label.text);
      const w = Math.ceil(measure.width);
      const h = Math.ceil(
        useDetails
          ? measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent
          : size
      );
      const ww = w + 2 * p;
      const hh = h + 2 * q;
      f = Math.max(f, h);
      // Move to the next row if we nearing the end of the texture
      if (u + ww > width) {
        v += Math.ceil(f + 2 * q + 1);
        if (v > height - f - 2 * q) {
          // Wrap this context, save the image data, clean up the canvas
          const ph = Math.ceil(v - 1);
          const piece = context.getImageData(0, 0, width, ph);
          if (originOffset) {
            //scratch.data = [...scratch.data, ...piece.data];
            const carr = scratch.data;
            const clen = scratch.data.length;
            const parr = piece.data;
            const plen = piece.data.length;
            scratch.data.length = clen + piece.data.length;
            for (let j = 0; j < plen; j++) carr[clen + j] = parr[j];
          } else {
            // scratch.data = [...piece.data];
            const carr = scratch.data;
            const parr = piece.data;
            const plen = piece.data.length;
            scratch.data.len = piece.data.length;
            for (let j = 0; j < plen; j++) carr[j] = parr[j];
          }
          scratch.height += piece.height;
          context.clearRect(0, 0, width, height);
          originOffset += ph;
          v = 0.5;
        }
        u = 0.5;
        f = 0;
      }
      coords.push(label.coord);
      points.push(label.point);
      weights.push(label.weight);
      origins.push([u - 0.5, originOffset + v - 0.5]);
      spreads.push([ww + 1, hh + 1]);
      if (this.debug) {
        context.lineWidth = 1;
        context.strokeStyle = "skyblue";
        context.strokeRect(u + p, height - v - q - h, w, h);
        context.strokeStyle = "orange";
        context.strokeRect(u, height - v - hh, ww, hh);
        context.lineWidth = this.stroke;
      }
      const x = u + p;
      const y = height - v - q - (measure.actualBoundingBoxDescent ?? 0);
      context.strokeStyle = label.stroke || "#000000";
      context.fillStyle = label.color || "#888888";
      context.strokeText(label.text, x, y);
      context.fillText(label.text, x, y);
      // if (label.text == "Alva") {
      //   console.log(`k = ${k}`);
      //   console.log(label);
      // }
      u += ww + 1;
    }

    // const t1 = Date.now();

    const pageHeight = Math.ceil(v + f + 2 * q);
    let image;
    if (originOffset) {
      const piece = context.getImageData(0, 0, width, pageHeight);

      // Recommended way but slow
      // scratch.data = [...scratch.data, ...piece.data];

      // Naive push. The fastest. Weird
      const carr = scratch.data;
      const clen = scratch.data.length;
      const parr = piece.data;
      const plen = piece.data.length;
      scratch.data.length = clen + piece.data.length;
      for (let j = 0; j < plen; j++) carr[clen + j] = parr[j];

      scratch.height += piece.height;

      image = new ImageData(
        new Uint8ClampedArray(scratch.data),
        width,
        scratch.height
      );
    } else {
      image = context.getImageData(0, 0, width, pageHeight);
    }

    // const t0 = Date.now();
    // console.log(`time = ${(t0 - t1).toFixed(1)} ms`);

    // console.log(image);

    const buffer = {
      image: image,
      coords: coords,
      points: points,
      weights: weights,
      origins: origins,
      spreads: spreads,
      extents: spreads.map((x) => [x[0] / this.scale, x[1] / this.scale]),
      count: points.length,
      scale: this.scale,
    };

    const wordsize = Float32Array.BYTES_PER_ELEMENT;
    const cString = buffer.count.toLocaleString();
    const xString = (buffer.count * 11).toLocaleString();
    const mString = (buffer.count * 11 * wordsize).toLocaleString();
    const wString = `${width.toLocaleString()} x ${image.height.toLocaleString()}`;
    const vString = (width * image.height * 4).toLocaleString();
    console.log(
      `Text: %c${cString} patches %c(${xString} floats = ${mString} bytes)` +
        `%c / texture %c(${wString} RGBA = ${vString} bytes)`,
      "font-weight: initial",
      "color: lightseagreen",
      "color: inherit",
      "color: mediumpurple"
    );
    this.busy = false;
    return buffer;
  }
}

async function makeLabels({ name, model, keys }, colors) {
  const ext = name.split(".").pop();
  if (name.includes("@")) {
    return builtInLabels(name, model, colors).catch((error) =>
      console.error(error.stack)
    );
  } else if (name.includes(".shp.json")) {
    return handleShapefileJSON(name)
      .then((array) => parseArray(array, keys, colors))
      .catch((error) => console.error(error.stack));
  } else if (ext == "shp") {
    return handleShapefile(name)
      .then((array) => parseArray(array, keys, colors))
      .catch((error) => console.error(error.stack));
  } else {
    console.log(`%cUnable to handle ${name}`, "color: red");
    return [];
  }
}

async function builtInLabels(name, model, colors) {
  // Points radar-centric polar coordinate
  let labels = [];
  if (name == "@demo") {
    labels.push({
      text: "Origin",
      point: deg.polar2point(0, 0, 0, model),
      color: colors.label.face,
      stroke: colors.label.stroke,
      weight: 0,
    });
    // Points from (lat, lon) pairs
    labels.push({
      text: "LatLon-1",
      weight: 0,
      point: deg.coord2point(-90, 20),
      color: colors.label.face,
      stroke: colors.label.stroke,
    });
    labels.push({
      text: "LatLon-2",
      weight: 0,
      point: deg.coord2point(-100, 30),
      color: colors.label.face,
      stroke: colors.label.stroke,
    });
    labels.push({
      text: "LatLon-3",
      weight: 0,
      point: deg.coord2point(-110, 40),
      color: colors.label.face,
      stroke: colors.label.stroke,
    });
    // More radar-centric points
    labels.push({
      text: "R-250 km",
      weight: 0,
      point: deg.polar2point(0.5, 45, 250, model),
      color: colors.label.face,
      stroke: colors.label.stroke,
      weight: 0,
    });
    labels.push({
      text: "R-250 km",
      weight: 0,
      point: deg.polar2point(0.5, -135, 250, model),
      color: colors.label.face2,
      stroke: colors.label.stroke,
    });
  } else if (name.includes("@rings")) {
    // Parse out the radii from the name
    const radii = name.split("/").slice(1);
    radii.forEach((radius) => {
      labels.push({
        text: `${radius} km`,
        point: deg.polar2point(0, -135, radius, model),
        color: colors.label.ring,
        stroke: colors.label.stroke,
        weight: 5,
      });
      labels.push({
        text: `${radius} km`,
        point: deg.polar2point(0, 45, radius, model),
        color: colors.label.ring,
        stroke: colors.label.stroke,
        weight: 5,
      });
    });
  }
  return labels;
}

async function handleShapefileJSON(name) {
  return fetch(name).then((text) => text.json());
}

async function handleShapefile(name) {
  return require("shapefile")
    .open(name)
    .then((source) => {
      let array = [];
      return source.read().then(function retrieve(result) {
        if (result.done) {
          return array;
        }
        array.push(result.value);
        return source.read().then(retrieve);
      });
    });
}

function parseArray(array, keys, colors) {
  let labels = [];
  const nameKey = keys.name;
  const weightKey = keys.weight ?? false;
  const populationKey = keys.population ?? false;
  const geometryKey = keys.geometry ?? "geometry";
  const propertiesKey = keys.properties ?? "properties";
  const coordinatesKey = keys.coordinates ?? "coordinates";
  const maximumWeight = keys.maximumWeight ?? 999;
  const origin = keys.origin ?? false;
  const theta = keys.theta ?? Math.cos((3.0 / 180) * Math.PI);
  const theta2 = Math.cos(150 / earthRadius);
  const o = deg.coord2point(origin.longitude, origin.latitude, 1.0);
  // console.log(`filter = ${filterByDistance}  o = ${o}  th = ${th}`);
  // console.log(
  //   `nameKey = ${nameKey}` +
  //     `  geometryKey = ${geometryKey}` +
  //     `  propertiesKey = ${propertiesKey}` +
  //     `  coordinatesKey = ${coordinatesKey}`
  // );
  array.forEach((label) => {
    const [lon, lat] = label[geometryKey][coordinatesKey].flat();
    const properties = label[propertiesKey];
    const weight = weightKey
      ? properties[weightKey]
      : pop2weight(properties[populationKey]);
    if (weight > maximumWeight) return;
    if (origin) {
      const p = deg.coord2point(lon, lat, 1.0);
      const dot = o[0] * p[0] + o[1] * p[1] + o[2] * p[2];
      if (dot < theta) return;
      if (dot < theta2 && weight == 9) return;
    }
    const text = properties[nameKey];
    labels.push({
      text: text,
      weight: weight,
      point: deg.coord2point(lon, lat),
      color: colors.label.face,
      stroke: colors.label.stroke,
      size: weight > 6 ? 13 : 19 - weight,
    });
  });

  // console.log(`list contains ${labels.length.toLocaleString()} labels`);
  return labels;
}

function pop2weight(pop) {
  if (pop < 50) return 9;
  if (pop < 500) return 8;
  if (pop < 5000) return 7;
  if (pop < 50000) return 6;
  if (pop < 500000) return 5;
  if (pop < 5000000) return 4;
  if (pop < 10000000) return 3;
  if (pop < 20000000) return 2;
  return 1;
}

function distance(p, q) {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export { Text };
