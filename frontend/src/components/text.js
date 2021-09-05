//
//  text-engine.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/1/2021.
//

import { coord2point, polar2point } from "./common";

//
//  Initialize as:
//  obj = TextMap3D(regl)
//
//  Update as:
//  obj.update(text, callback)
//
//  where
//
//  label = [{
//    text: string,
//    point: [x, y, z],
//    color: '#800000',
//    font: string
//  }, {
//    text: string,
//    point: [x, y, z],
//    color: '#800000',
//    font: string
//  }, ...];
//
//
//  NOTE: slices and attributes must have the same length
//

class Text {
  constructor(regl, debug = false) {
    this.regl = regl;
    this.scale = 1.5;
    this.debug = debug;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 4096;
    this.canvas.height = 4096;
    this.context = this.canvas.getContext("2d");
    this.context.translate(0, this.canvas.height);
    this.context.scale(1, -1);
    this.padding = 3 * this.scale;
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
    this.update = this.update.bind(this);
    this.makeBuffer = this.makeBuffer.bind(this);
    this.handleJSON = this.handleJSON.bind(this);
    this.handleShapefile = this.handleShapefile.bind(this);

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

  async update(name, model, colors) {
    if (this.busy) {
      console.log("Calling Text.update() too frequent.");
      return;
    }
    if (name === undefined) {
      console.log("Input undefined.");
      return;
    }
    const ext = name.split(".").pop();
    if (name.includes("@")) {
      return this.builtInLabels(name, model, colors)
        .then((labels) => this.makeBuffer(name, labels))
        .catch((error) => console.error(error.stack));
    } else if (ext == "shp") {
      const indices = [0, 6];
      return require("shapefile")
        .open(name)
        .then((source) => this.handleShapefile(source, indices, colors))
        .then((labels) => this.makeBuffer(name, labels))
        .catch((error) => console.error(error.stack));
    }
  }

  async builtInLabels(name, model, colors) {
    if (name == "@demo") {
      // Points radar-centric polar coordinate
      let labels = [
        {
          text: "Origin",
          point: polar2point(0, 0, 0, model),
          color: colors.label.face,
          stroke: colors.label.stroke,
        },
      ];
      // Points from (lat, lon) pairs
      labels.push({
        text: "LatLon-1",
        point: coord2point(-90, 20),
        color: colors.label.face,
        stroke: colors.label.stroke,
      });
      labels.push({
        text: "LatLon-2",
        point: coord2point(-100, 30),
        color: colors.label.face,
        stroke: colors.label.stroke,
      });
      labels.push({
        text: "LatLon-3",
        point: coord2point(-110, 40),
        color: colors.label.face,
        stroke: colors.label.stroke,
      });
      // More radar-centric points
      labels.push({
        text: "R-250 km",
        point: polar2point(0.5, 45, 250, model),
        color: colors.label.face,
        stroke: colors.label.stroke,
      });
      labels.push({
        text: "R-250 km",
        point: polar2point(0.5, -135, 250, model),
        color: colors.label.face2,
        stroke: colors.label.stroke,
      });
      return labels;
    }
    return [];
  }

  async makeBuffer(file, labels) {
    const name = file.includes("@") ? file : file.split("/").pop();
    const context = this.context;
    const p = Math.ceil(1.5 * this.padding);
    const q = Math.ceil(this.padding);
    this.busy = true;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let f = 0;
    let u = 0.5;
    let v = 0.5;
    let points = [];
    let origins = [];
    let spreads = [];
    labels.forEach((label) => {
      const size = label?.size || 17;
      context.font = `${this.scale * size}px LabelFont`;
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
      points.push(label.point);
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
      context.lineWidth = 4.5 * this.scale;
      context.strokeStyle = label?.stroke || "#000000";
      context.strokeText(label.text, x, y);
      context.fillStyle = label?.color || "#888888";
      context.fillText(label.text, x, y);
      u += ww + 1;
      // console.log(label.text, measure.actualBoundingBoxDescent);
    });
    this.usage = (v / this.canvas.height) * 100;
    // console.log(`u = ${u}  v = ${v}  ${v / this.canvas.height}`);

    // console.log(points, origins);
    const buffer = {
      bound: [this.canvas.width, this.canvas.height],
      texture: this.regl.texture({
        data: this.canvas,
        min: "linear",
        mag: "linear",
      }),
      color: this.debug ? [0, 0, 1, 0.3] : [0, 0, 0, 0],
      points: this.regl.buffer({
        usage: "static",
        type: "float",
        data: points,
      }),
      origins: this.regl.buffer({
        usage: "static",
        type: "float",
        data: origins,
      }),
      spreads: this.regl.buffer({
        usage: "static",
        type: "float",
        data: spreads,
      }),
      raw: {
        points: points,
        origins: origins,
        spreads: spreads,
      },
      count: points.length,
    };

    const cString = buffer.count.toLocaleString();
    const xString = (buffer.count * 7).toLocaleString();
    const mString = (
      buffer.count *
      7 *
      Float32Array.BYTES_PER_ELEMENT
    ).toLocaleString();
    const wString = `${buffer.bound[0].toLocaleString()} x ${buffer.bound[0].toLocaleString()}`;
    const vString = (buffer.bound[0] * buffer.bound[1] * 4).toLocaleString();
    console.log(
      `Text: %c${name} %c${cString} patches %c(${xString} floats = ${mString} bytes)` +
        `%c / texture (%c${wString} RGBA = ${vString} bytes)` +
        `%c / usage ${this.usage.toFixed(2)} %%`,
      "font-weight: bold",
      "font-weight: normal",
      "color: blue",
      "font-weight: normal; color: black",
      "color: blue",
      "font-weight: normal; color: black"
    );
    this.busy = false;
    return buffer;
  }

  handleJSON(dict) {}

  handleShapefile(source, fields, colors) {
    let raw = [];
    let stringKey = "";
    let weightKey = "";

    const digest = () => {
      raw.sort((a, b) => {
        if (a.weight < b.weight) return +1;
        if (a.weight > b.weight) return -1;
        return 0;
      });
      // console.log(`raw has ${raw.length.toLocaleString()} elements`);
      raw = raw.slice(-2000);
      return raw;
    };

    const handleLabel = (label) => {
      if (stringKey == "") {
        const keys = Object.keys(label.properties);
        stringKey = keys[fields[0]];
        weightKey = keys[fields[1]];
        console.log(`${stringKey}, ${weightKey}`);
      }
      const lon = label.geometry.coordinates[0][0];
      const lat = label.geometry.coordinates[0][1];
      raw.push({
        text: label.properties[stringKey],
        weight: label.properties[weightKey],
        point: coord2point(lon, lat),
        color: colors.label.face,
        stroke: colors.label.stroke,
      });
    };
    return source.read().then(function retrieve(result) {
      if (result.done) {
        return digest();
      }
      handleLabel(result.value);
      return source.read().then(retrieve);
    });
  }
}

export { Text };
