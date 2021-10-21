//
//  annotation.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Annotation {
  constructor(debug = true) {
    this.debug = debug;
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;
    this.scale = this.ratio > 1 ? 1 : 1.2;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 500;
    this.canvas.height = 500;
    this.context = this.canvas.getContext("2d");
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
      o.appendChild(this.canvas);
      console.log("Annotation()");
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
    }
  }

  async makeBuffer(assets) {
    const context = this.context;
    context.lineWidth = this.stroke;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const label = "Hello";
    context.font = "14px LabelFont";
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#000000";
    context.strokeText(label, 100, 100);
    context.fillText(label, 100, 100);

    let image = context.getImageData(0, 0, 500, 500);

    const buffer = {
      image: image,
      scale: this.scale,
    };
    console.log("Annotation");
    this.busy = false;
    return buffer;
  }
}

export { Annotation };
