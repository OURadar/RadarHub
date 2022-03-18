//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Colorbar {
  constructor(debug = false) {
    this.debug = debug;
    this.scale = window.devicePixelRatio > 1 ? 2 : 1;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 200 * this.scale;
    this.canvas.height = 600 * this.scale;
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
      console.log("Colorbar.load() is busy.");
      return;
    }
    if (configs === undefined) {
      console.log("Input undefined.");
      return;
    }
    if (this.tic++ == 0) {
      //console.log(`this.tic = ${this.tic}`);
      return fetch("/static/blob/helveticaneue/HelveticaNeueMed.ttf").then(
        () => {
          return this.makeBuffer(configs, colors);
        }
      );
    }
    return this.makeBuffer(configs, colors);
  }

  async makeBuffer(configs, colors) {
    const context = this.context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    context.shadowColor = this.debug ? "#ff992288" : colors.label.stroke;
    context.shadowBlur = 10;
    this.draw(configs, {
      blank: true,
      face: this.debug ? "#ff992288" : colors.label.stroke,
      stroke: this.debug ? "#ff992288" : colors.label.stroke,
      width: this.stroke,
    });
    context.shadowBlur = 0;

    this.draw(configs, {
      blank: false,
      face: colors.label.face,
      stroke: colors.label.stroke,
      width: this.stroke,
    });

    if (this.debug) {
      context.lineWidth = 2 * this.scale;
      context.strokeStyle = "rgba(255, 160, 0, 0.7)";
      context.strokeRect(
        0.5 * context.lineWidth,
        0.5 * context.lineWidth,
        this.canvas.width - context.lineWidth,
        this.canvas.height - context.lineWidth
      );
    }

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

  draw(configs, theme) {
    const scale = this.scale;
    const context = this.context;

    let x;
    let y;
    let meas;

    // Colorbar dimension: 20 x 255
    const yscale = Math.round(2.0 * scale);
    const height = Math.round(255 * yscale);
    const width = Math.round(20 * scale);
    const originX = Math.round(this.canvas.width - 120 * scale);
    const originY = Math.round(this.canvas.height - 50 * scale);
    const tickOffset = yscale - 1;
    context.translate(originX, originY);
    context.font = `${16 * scale}px LabelFont`;
    configs.style.ticks.forEach((tick) => {
      y = 0.5 * scale - tick.pos * yscale + tickOffset;
      context.strokeStyle = theme.face;
      // console.log(`tick.pos = ${tick.pos}   y = ${y}`);
      if (theme.blank) {
        context.lineWidth = theme.width;
      } else {
        context.lineWidth = scale;
      }
      context.beginPath();
      context.moveTo(22.5 * scale, y);
      context.lineTo(27.5 * scale, y);
      context.closePath();
      context.stroke();

      context.lineWidth = theme.width;
      let meas = this.context.measureText(tick.text);
      let xx = 34 * scale;
      let yy = y + 0.5 * meas.actualBoundingBoxAscent;
      context.fillStyle = theme.face;
      context.strokeStyle = theme.stroke;
      context.strokeText(tick.text, xx, yy);
      context.fillText(tick.text, xx, yy);
    });

    // Colorbar shades. The first shade is transparent.
    context.lineWidth = theme.width;
    context.rotate(-0.5 * Math.PI);
    context.imageSmoothingEnabled = false;
    if (theme.blank) {
      context.fillStyle = theme.face;
      context.strokeRect(0, 0, height, width);
      context.fillRect(0, 0, height, width);
    } else {
      context.clearRect(0, 0, height, width);
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
    }
    context.lineWidth = scale;
    context.strokeStyle = theme.face;
    context.strokeRect(
      -1.5 * context.lineWidth,
      -1.5 * context.lineWidth,
      height + 3 * scale,
      width + 3 * scale
    );

    context.font = `${20 * scale}px LabelFont`;
    context.lineWidth = theme.width;
    context.fillStyle = theme.face;
    context.strokeStyle = theme.stroke;
    meas = this.context.measureText(configs.style.name);
    x = 0.5 * (height - meas.width);
    context.strokeText(configs.style.name, x, -18 * scale);
    context.fillText(configs.style.name, x, -18 * scale);

    context.setTransform(1, 0, 0, 1, 0, 0);

    context.lineWidth = scale;
    context.strokeStyle = theme.stroke;
    context.strokeRect(
      originX - 0.5 * context.lineWidth,
      originY - 0.5 * context.lineWidth - height,
      width + scale,
      height + scale
    );
  }
}

export { Colorbar };
