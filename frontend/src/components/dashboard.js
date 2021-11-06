//
//  dashboard.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Dashboard {
  constructor(debug = false) {
    this.debug = debug;
    this.scale = window.devicePixelRatio > 1 ? 2 : 1;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 500 * this.scale;
    this.canvas.height = 1000 * this.scale;
    this.context = this.canvas.getContext("2d");
    this.stroke = 3.5 * this.scale;
    this.busy = false;
    this.context.font = "12px LabelFont";
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
    const scale = this.scale;
    const context = this.context;
    context.lineWidth = this.stroke;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    context.font = `${32 * scale}px LabelFont`;
    let meas = context.measureText(configs.title);
    let x = this.canvas.width - meas.width - 50 * scale;
    let y = this.canvas.height - meas.actualBoundingBoxDescent - 50 * scale;
    console.log(`config.title = ${configs.title}   ${colors.label.face}`);
    context.strokeStyle = colors.label.stroke;
    context.fillStyle = colors.label.face;
    context.strokeText(configs.title, x, y);
    context.fillText(configs.title, x, y);

    if (this.debug) {
      context.lineWidth = 2 * scale;
      context.strokeStyle = "rgba(255, 160, 0, 0.7)";
      context.strokeRect(
        0.5 * context.lineWidth,
        0.5 * context.lineWidth,
        this.canvas.width - context.lineWidth,
        this.canvas.height - context.lineWidth
      );
    }

    // console.log(configs.palette);

    // Colorbar dimension: 20 x 255
    const pull = 1.5;
    const width = Math.round(20 * scale);
    const height = Math.round(255 * scale * pull);
    const originX = Math.round(this.canvas.width - 120 * scale);
    const originY = Math.round(this.canvas.height - 150 * scale);
    const tickOffset = (pull - 1) * scale;
    context.translate(originX, originY);
    context.font = `${14 * scale}px LabelFont`;
    configs.style.ticks.forEach((tick) => {
      // console.log(`y = ${y}`);
      context.lineWidth = scale;
      context.strokeStyle = colors.label.face;
      y = 0.5 * context.lineWidth - tick.pos * scale * pull + tickOffset;
      context.beginPath();
      context.moveTo(22 * scale, y);
      context.lineTo(27 * scale, y);
      context.closePath();
      context.stroke();

      context.lineWidth = this.stroke;
      let meas = this.context.measureText(tick.text);
      let xx = 34 * scale;
      let yy = y + 0.5 * meas.actualBoundingBoxAscent;
      context.strokeStyle = colors.label.stroke;
      context.fillStyle = colors.label.face;
      context.strokeText(tick.text, xx, yy);
      context.fillText(tick.text, xx, yy);
    });

    // Colorbar shades. The first shade is transparent.
    console.log(`scale = ${scale}`);
    context.lineWidth = scale;
    context.strokeStyle = colors.label.face;
    context.rotate(-Math.PI / 2);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      configs.palette,
      1,
      configs.style.index,
      255,
      1,
      0,
      0,
      height,
      width
    );
    context.strokeRect(
      -1.5 * context.lineWidth,
      -1.5 * context.lineWidth,
      height + 3 * scale,
      width + 3 * scale
    );

    context.font = `${20 * scale}px LabelFont`;
    context.lineWidth = this.stroke;
    meas = this.context.measureText(configs.product);
    x = 0.5 * (height - meas.width);
    context.strokeStyle = colors.label.stroke;
    context.fillStyle = colors.label.face;
    context.strokeText(configs.product, x, -18 * scale);
    context.fillText(configs.product, x, -18 * scale);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.lineWidth = scale;
    context.strokeStyle = "white";
    context.strokeRect(
      originX - 0.5 * context.lineWidth,
      originY - 0.5 * context.lineWidth - height,
      width + scale,
      height + scale
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
