//
//  dashboard.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Dashboard {
  constructor(debug = true) {
    this.debug = debug;
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;
    this.scale = this.ratio > 1 ? 1 : 1.2;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1000;
    this.canvas.height = 1000;
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
      if (o) o.appendChild(this.canvas);
    }
  }

  async load(configs, colors) {
    if (this.busy) {
      console.log("Dashboard.load() is busy.");
      return;
    }
    if (configs === undefined) {
      console.log("Input undefined.");
      return;
    }

    console.log("Dashboard.config()", configs);
    // Compute colorbar tics, label text, etc.
    // let texts = [];
    // let points = [];
    // let assets = [];
    // for (const config of configs) {
    // }

    return this.makeBuffer(configs, colors);
  }

  async makeBuffer(configs, colors) {
    const context = this.context;
    context.lineWidth = this.stroke;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    console.log(`config.title = ${configs.title}   ${colors.label.face}`);
    const label = configs.title;
    context.font = "28px LabelFont";
    context.strokeStyle = colors.label.stroke;
    context.fillStyle = colors.label.face;
    context.strokeText(label, 50, 50);
    context.fillText(label, 50, 50);

    context.lineWidth = 2;
    context.strokeStyle = "red";
    context.strokeRect(
      0.5 * context.lineWidth,
      0.5 * context.lineWidth,
      this.canvas.width - context.lineWidth,
      this.canvas.height - context.lineWidth
    );

    const width = 20;
    const height = 256;
    const originX = 100;
    const originY = 400;
    context.lineWidth = 1;
    context.strokeStyle = colors.label.face;
    for (let k = 0; k < 5; k++) {
      const y = originY + 0.5 * context.lineWidth - k * 50;
      // console.log(`y = ${y}`);
      context.beginPath();
      context.moveTo(originX - 5, y);
      context.lineTo(originX, y);
      context.closePath();
      context.stroke();
    }
    context.strokeRect(
      originX + 0.5 * context.lineWidth,
      originY + 0.5 * context.lineWidth - height,
      width,
      height
    );

    let image = context.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    const buffer = {
      image: image,
      scale: this.scale,
    };
    this.busy = false;
    return buffer;
  }
}

export { Dashboard };
