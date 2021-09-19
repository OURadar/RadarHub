//
//  text.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/1/2021.
//

import { deg } from "./common";

//
//  Initialize as:
//  obj = Text()
//
//  Update as:
//  buffer = obj.update(files, model, colors)
//

class Text {
  constructor(debug = false) {
    this.debug = debug;
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;
    this.scale = this.ratio > 1 ? 1 : 1.5;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.ceil((2048 * this.scale * this.ratio) / 256) * 256;
    this.canvas.height = this.canvas.width;
    this.context = this.canvas.getContext("2d");
    this.context.translate(0, this.canvas.height);
    this.context.scale(1, -1);
    this.padding = 3 * this.scale * this.ratio;
    this.texts = [];
    this.busy = false;
    this.fontLoaded = false;
    this.context.font = "14px LabelFont";
    let meas = this.context.measureText("bitcoin");
    this.initWidth = meas.width;
    this.hasDetails =
      undefined !== meas.actualBoundingBoxAscent &&
      undefined !== meas.actualBoundingBoxDescent;
    this.tic = 0;
    // Binding methods
    this.update = this.load.bind(this);
    this.makeBuffer = this.makeBuffer.bind(this);

    const o = document.getElementById("test");
    if (o) {
      if (debug) o.appendChild(this.canvas);
      else o.style.display = "none";
    }

    let font = new FontFace(
      "LabelFont",
      "url(/static/blob/helveticaneue/HelveticaNeueMed.ttf)"
    );
    font.load().then(() => {
      this.fontLoaded = true;
    });
  }

  waitBriefly() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("waited");
      }, 10);
    });
  }

  async load(configs, colors) {
    if (this.busy > 2) {
      console.log("Calling Text.load() too frequent.");
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
      if (config.name.includes("@")) {
        allLabels.push(...labels);
      } else {
        labels.forEach((label) => {
          const index = texts.indexOf(label.text);
          if (index > 0) {
            const d = distance(label.point, points[index]);
            if (d < 5) {
              if (this.debug) {
                console.log(
                  `Duplicate %c${label.text}%c  range = ${d.toFixed(2)} km`,
                  "color: purple",
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

    // I Love You 3,000 -Morgan Stark
    allLabels = allLabels.slice(0, 3000);

    // var item = Object.entries(allLabels).find((a) => a[1].text == "Criner");
    // console.log(item);
    // var item = Object.entries(allLabels).find((a) => a[1].text == "Norman")[1];
    // console.log(item);
    // var item = Object.entries(allLabels).find((a) => a[1].text == "Hall Park")[1];
    // console.log(item);
    return this.makeBuffer(allLabels);
  }

  async makeBuffer(labels) {
    const context = this.context;
    const p = Math.ceil(1.5 * this.padding);
    const q = Math.ceil(this.padding);
    this.busy = true;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let f = 0;
    let u = 0.5;
    let v = 0.5;
    let coords = [];
    let points = [];
    let weights = [];
    let origins = [];
    let spreads = [];
    labels.forEach((label) => {
      const size = Math.round((label.size ?? 15) * this.scale * this.ratio);
      context.font = `${size}px LabelFont`;
      const measure = context.measureText(label.text);
      const w = Math.ceil(measure.width);
      const h = Math.ceil(
        this.hasDetails
          ? measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent
          : 0.8 * size
      );
      const ww = w + 2 * p;
      const hh = h + 2 * q;
      f = Math.max(f, h);
      // Move to the next row if we nearing the end of the texture
      if (u + ww > this.canvas.width) {
        v += Math.ceil(f + 2 * q + 1);
        u = 0.5;
        f = 0;
      }
      coords.push(label.coord);
      points.push(label.point);
      weights.push(label.weight);
      origins.push([u - 0.5, v - 0.5]);
      spreads.push([ww + 1, hh + 1]);
      if (this.debug) {
        context.lineWidth = 1;
        context.strokeStyle = "skyblue";
        context.strokeRect(u + p, this.canvas.height - v - q - h, w, h);
        context.strokeStyle = "orange";
        context.strokeRect(u, this.canvas.height - v - hh, ww, hh);
      }
      const o = this.hasDetails ? measure.actualBoundingBoxDescent : 0;
      const x = u + p;
      const y = this.canvas.height - v - q - o;
      context.lineWidth = 4.5 * this.scale * this.ratio;
      context.strokeStyle = label.stroke || "#000000";
      context.strokeText(label.text, x, y);
      context.fillStyle = label.color || "#888888";
      context.fillText(label.text, x, y);
      u += ww + 1;
      // console.log(label.text, measure.actualBoundingBoxDescent);
    });
    this.usage = (v / this.canvas.height) * 100;
    // console.log(`u = ${u}  v = ${v}  ${v / this.canvas.height}`);

    // console.log(points, origins);
    const buffer = {
      canvas: this.canvas,
      coords: coords,
      points: points,
      weights: weights,
      origins: origins,
      spreads: spreads,
      extents: spreads.map((x) => [x[0] / this.scale, x[1] / this.scale]),
      count: points.length,
    };

    const width = this.canvas.width;
    const height = this.canvas.height;
    const wordsize = Float32Array.BYTES_PER_ELEMENT;
    const cString = buffer.count.toLocaleString();
    const xString = (buffer.count * 11).toLocaleString();
    const mString = (buffer.count * 11 * wordsize).toLocaleString();
    const wString = `${width.toLocaleString()} x ${height.toLocaleString()}`;
    const vString = ((width * height * 4) / 1024 / 1024).toLocaleString();
    console.log(
      `Text: %c${cString} patches %c(${xString} floats = ${mString} bytes)` +
        `%c / texture (%c${wString} RGBA = ${vString} MB)` +
        `%c / ${this.usage.toFixed(2)} %%`,
      "font-weight: initial",
      "color: darkorange",
      "font-weight: initial; color: inherit",
      "color: darkorange",
      "font-weight: initial; color: inherit"
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
  const maximumWeight = keys.maximumWeight ?? 999;
  const origin = keys.origin ?? false;
  const theta = Math.cos((3.0 / 180) * Math.PI);
  const o = deg.coord2point(origin.longitude, origin.latitude, 1.0);
  // console.log(`filter = ${filterByDistance}  o = ${o}  th = ${th}`);

  array.forEach((label) => {
    const lon = label.geometry.coordinates.flat()[0];
    const lat = label.geometry.coordinates.flat()[1];
    const weight = weightKey
      ? label.properties[weightKey]
      : pop2weight(label.properties[populationKey]);
    if (weight > maximumWeight) return;
    if (origin) {
      const p = deg.coord2point(lon, lat, 1.0);
      const dot = o[0] * p[0] + o[1] * p[1] + o[2] * p[2];
      if (dot < theta) return;
    }
    const text = label.properties[nameKey];
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
