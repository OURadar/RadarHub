//
//  text-engine.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/1/2021.
//
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

class TextEngine {
  constructor(regl, debug = false) {
    this.regl = regl;
    this.scale = 1.5;
    this.debug = debug;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1024;
    this.canvas.height = 1024;
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

    if (this.debug) {
      const o = document.getElementById("test");
      if (o) o.appendChild(this.canvas);
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

  async update(text) {
    if (this.busy) return;
    if (text === undefined) {
      console.log("Input undefined.");
      return;
    }
    while (!this.fontLoaded && this.tic++ < 100) {
      await this.waitBriefly();
    }
    const context = this.context;
    const p = this.padding;
    this.busy = true;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let f = 0;
    let u = 0.5;
    let v = 0.5;
    let points = [];
    let origins = [];
    let spreads = [];
    text.forEach((label) => {
      const size = label?.size || 18;
      context.font = `${this.scale * size}px LabelFont`;
      const measure = context.measureText(label.text);
      const w = Math.ceil(measure.width);
      const h = Math.ceil(
        this.hasDetails
          ? measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent
          : 0.8 * size
      );
      const ww = w + 2 * p;
      const hh = h + 2 * p;
      f = Math.max(f, h);
      // Move to the next row if we nearing the end of the texture
      if (u + ww > this.canvas.width) {
        u = 0.5;
        v += Math.ceil(f + p + 1);
      }
      points.push(label.point);
      origins.push([u - 0.5, v - 0.5]);
      spreads.push([ww + 1, hh + 1]);
      if (this.debug) {
        context.lineWidth = 1;
        context.strokeStyle = "skyblue";
        context.strokeRect(u + p, this.canvas.height - v - p - h, w, h);
        context.strokeStyle = "orange";
        context.strokeRect(u, this.canvas.height - v - hh, ww, hh);
      }
      const o = this.hasDetails ? measure.actualBoundingBoxDescent : 0;
      const x = u + p;
      const y = this.canvas.height - v - p - o;
      context.lineWidth = 4.5 * this.scale;
      context.strokeStyle = label?.stroke || "#000000";
      context.strokeText(label.text, x, y);
      context.fillStyle = label?.color || "#888888";
      context.fillText(label.text, x, y);
      u += ww + 1;
      // console.log(label.text, measure.actualBoundingBoxDescent);
    });
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
    const name = "@builtIn";
    const cString = buffer.count.toLocaleString();
    const xString = (buffer.count * 7).toLocaleString();
    const mString = (
      buffer.count *
      7 *
      Float32Array.BYTES_PER_ELEMENT
    ).toLocaleString();
    const wString = `${buffer.bound[0].toLocaleString()} x ${buffer.bound[0].toLocaleString()}`;
    const vString = (
      buffer.bound[0] *
      buffer.bound[1] *
      4 *
      Float32Array.BYTES_PER_ELEMENT
    ).toLocaleString();
    console.log(
      `Text: %c${name} %c${cString} patches %c(${xString} floats = ${mString} bytes)` +
        `%c / texture (%c${wString} RGBA = ${vString} bytes)`,
      "font-weight: bold",
      "font-weight: normal",
      "color: blue",
      "font-weight: normal; color: black",
      "color: blue"
    );
    this.busy = false;
    return buffer;
  }
}

export { TextEngine };
