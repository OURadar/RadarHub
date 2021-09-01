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
    this.scale = 1.0;
    this.debug = debug;
    console.log(this.scale, this.debug);
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
    this.constants = {
      padding: 2,
    };
    this.busy = false;
    this.fontLoaded = false;
    this.context.font = "14px LabelFont";
    let meas = this.context.measureText("bitcoin");
    this.initWidth = meas.width;
    this.hasDetails =
      undefined !== meas.actualBoundingBoxAscent &&
      undefined !== meas.actualBoundingBoxDescent;
    this.tic = 0;

    if (this.debug) document.getElementById("test").appendChild(this.canvas);

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
    const p = this.constants.padding;
    this.busy = true;
    this.canvas.width = 512 * this.scale;
    this.canvas.height = 128 * this.scale;
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
      const h = this.hasDetails
        ? measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent
        : Math.ceil(0.8 * size);
      const ww = w + 2 * p;
      const hh = h + 2 * p;
      f = Math.max(f, h);
      // Move to the next row if we nearing the end of the texture
      if (u + ww > this.canvas.width) {
        u = 0.5;
        v += Math.ceil(f + 2 * p);
      }
      origins.push(u, v);
      points.push(label.point);
      spreads.push(ww / this.scale, hh / this.scale);
      if (this.debug) {
        context.strokeStyle = "skyblue";
        context.strokeRect(u + p, v + p, w, h);
        context.strokeStyle = "orange";
        context.strokeRect(u, v, ww, hh);
      }
      context.fillStyle = label?.color || "#888888";
      context.fillText(
        label.text,
        u + p,
        v + p + (this.hasDetails ? measure.actualBoundingBoxAscent : h)
      );
      u += ww + 1;
      //console.log(label, context.font);
    });
    console.log(points, origins);
    return {
      bound: [this.canvas.width, this.canvas.height],
      texture: this.regl.texture({
        data: this.canvas,
        min: "linear",
        mag: "linear",
      }),
      color: this.debug ? [0, 0, 1, 0.3] : [0, 0, 0, 0],
      points: points,
      origins: origins,
      spreads: spreads,
      count: points.length,
    };
  }
}

export { TextEngine };
