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
    this.scale = 1.5;
    this.debug = debug;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.ceil(3200 / 64) * 64;
    this.canvas.height = this.canvas.width;
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

  async update(names, model, colors) {
    if (this.busy) {
      console.log("Calling Text.update() too frequent.");
      return;
    }
    if (names === undefined) {
      console.log("Input undefined.");
      return;
    }
    let allLabels = [];
    for (const name of names) {
      const labels = await this.getLabel(name, model, colors);
      allLabels.push(...labels);
    }
    return this.makeBuffer(allLabels);
  }

  async getLabel({ name, model, indices }, colors) {
    const ext = name.split(".").pop();
    if (name.includes("@")) {
      return this.builtInLabels(name, model, colors).catch((error) =>
        console.error(error.stack)
      );
    } else if (ext == "shp") {
      // const indices = [0, 6];
      // const indices = [2, 4];
      console.log(name, indices, model, colors);
      return require("shapefile")
        .open(name)
        .then((source) => this.handleShapefile(source, indices, colors))
        .catch((error) => console.error(error.stack));
    }
  }

  async updateV1(name, model, colors) {
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
        .then((labels) => this.makeBuffer(labels))
        .catch((error) => console.error(error.stack));
    } else if (ext == "shp") {
      const indices = [0, 6];
      return require("shapefile")
        .open(name)
        .then((source) => this.handleShapefile(source, indices, colors))
        .then((labels) => this.makeBuffer(labels))
        .catch((error) => console.error(error.stack));
    }
  }

  async builtInLabels(name, model, colors) {
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
        weight: 0,
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
    } else if (name.includes("@ring")) {
      // Parse out the radius from name
      const radii = name.split("/").slice(1);
      radii.forEach((radius) => {
        labels.push({
          text: `${radius} km`,
          point: deg.polar2point(0, -135, radius, model),
          color: colors.label.face2,
          stroke: colors.label.stroke,
          weight: 5,
        });
        labels.push({
          text: `${radius} km`,
          point: deg.polar2point(0, 45, radius, model),
          color: colors.label.face2,
          stroke: colors.label.stroke,
          weight: 5,
        });
      });
    }
    return labels;
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
      const size = label?.size || 15;
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
      context.lineWidth = 4.5 * this.scale;
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

    const bytes_per_float = 4;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cString = buffer.count.toLocaleString();
    const xString = (buffer.count * 11).toLocaleString();
    const mString = (buffer.count * 11 * bytes_per_float).toLocaleString();
    const wString = `${width.toLocaleString()} x ${height.toLocaleString()}`;
    const vString = (width * height * 4).toLocaleString();
    console.log(
      `Text: %c${cString} patches %c(${xString} floats = ${mString} bytes)` +
        `%c / texture (%c${wString} RGBA = ${vString} bytes)` +
        `%c / usage ${this.usage.toFixed(2)} %%`,
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
        if (a.weight > b.weight) return +1;
        if (a.weight < b.weight) return -1;
        return 0;
      });
      raw = raw.slice(-2500);
      return raw;
    };

    const handleLabel = (label) => {
      if (stringKey == "") {
        const keys = Object.keys(label.properties);
        stringKey = keys[fields[0]];
        weightKey = keys[fields[1]];
        console.log(keys);
        console.log(`${stringKey}, ${weightKey}`);
      }
      // if (label.properties[weightKey] >= 7) return;
      const lon = label.geometry.coordinates[0][0];
      const lat = label.geometry.coordinates[0][1];
      raw.push({
        text: label.properties[stringKey],
        weight: label.properties[weightKey],
        point: deg.coord2point(lon, lat),
        color: colors.label.face,
        stroke: colors.label.stroke,
        size: 11 + (7 - label.properties[weightKey]),
      });
    };
    let k = 0;

    return source.read().then(function retrieve(result) {
      if (result.done) {
        return digest();
      }
      if (k++ == 0) {
        console.log(result.value);
      }
      handleLabel(result.value);
      return source.read().then(retrieve);
    });
  }
}

export { Text };
