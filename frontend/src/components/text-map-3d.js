//
//  text-map-3d.js
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
//  text = {
//    labels: ['label-1', 'label-2', ...]
//    positions: [[x0, y0, z0], [x1, y1, z1], ... ]
//    alignments: [[u0, v0], [u1, v1], ...]
//    colors: ['#808080', 'black', ...]
//    fonts: ['font-1', 'font-2', ...]
//  }
//
//  label = [{
//    text: string,
//    coord: {lon: number, lat: number},
//    align: {u: number, v: number},
//    color: '#800000',
//    font: string
//  }, {
//    text: string,
//    coord: {lon: number, lat: number},
//    align: {u: number, v: number},
//    color: '#800000',
//    font: string
//  }, ...];
//
//  callback = a callback function when the texture is ready
//
//  NOTE: slices and attributes must have the same length
//

import * as common from "./common";

class TextMap3D {
  constructor(regl, debug = false) {
    this.regl = regl;
    this.scale = window.devicePixelRatio;
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
    this.busy = true;
    this.canvas.width = 512 * this.scale;
    this.canvas.height = 128 * this.scale;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // if (this.debug) {
    //   context.fillStyle = "#dddddd";
    //   context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // }
    const p = this.constants.padding;
    let f = 0,
      x = 0.5,
      y = 0.5;
    let points = [],
      origins = [],
      spreads = [];
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
      if (x + ww > this.canvas.width) {
        x = 0.5;
        y += Math.ceil(f + 2 * p);
      }
      origins.push(x, y);
      let lat = common.deg2rad(label.coord.lat);
      let lon = common.deg2rad(label.coord.lon);
      let clat = Math.cos(lat);
      let slat = Math.sin(lat);
      let clon = Math.cos(lon);
      let slon = Math.sin(lon);
      points.push([6375 * clat * slon, 6375 * slat, 6375 * clat * clon]);
      spreads.push(ww / this.scale, hh / this.scale);
      if (this.debug) {
        context.strokeStyle = "skyblue";
        context.strokeRect(x + p, y + p, w, h);
        context.strokeStyle = "orange";
        context.strokeRect(x, y, ww, hh);
      }
      context.fillStyle = label?.color || "gray";
      context.fillText(
        label.text,
        x + p,
        y + p + (this.hasDetails ? measure.actualBoundingBoxAscent : h)
      );
      x += ww + 1;
      //console.log(label, context.font);
    });
    console.log(points, origins);
    return {
      points: points,
      origins: origins,
      spreads: spreads,
      texture: this.regl.texture({
        data: this.canvas,
        min: "linear",
        mag: "linear",
      }),
    };
  }
}

export { TextMap3D };
