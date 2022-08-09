//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Colorbar {
  constructor(style = 1, debug = true) {
    this.style = style;
    this.scale = window.devicePixelRatio > 1 ? 2 : 1;
    let w, h;
    if (style == 0) {
      w = 200;
      h = 600;
    } else {
      w = 600;
      h = 200;
    }
    w *= this.scale;
    h *= this.scale;
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.context = this.canvas.getContext("2d");
    this.stroke = 3.5 * this.scale;
    this.busy = false;
    this.context.font = "12px LabelFont";
    let meas = this.context.measureText("bitcoin");
    this.initWidth = meas.width;
    this.hasDetails =
      undefined !== meas.actualBoundingBoxAscent &&
      undefined !== meas.actualBoundingBoxDescent;
    this.debug = debug;
    this.tic = 0;

    // Binding methods
    this.load = this.load.bind(this);
    this.makeBuffer = this.makeBuffer.bind(this);

    if (this.debug) {
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
    context.shadowColor = "rgba(128, 128, 128, 0)";
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

    if (this.style == 0) {
      // Colorbar dimension: 20 x 255
      const yscale = Math.round(2.0 * scale);
      const height = Math.round(255 * yscale);
      const width = Math.round(20 * scale);
      const originX = Math.round(this.canvas.width - 110 * scale);
      const originY = Math.round(this.canvas.height - 60 * scale);
      const tickOffset = yscale - 1;
      context.translate(originX, originY);
      context.font = `${16 * scale}px LabelFont`;
      configs.style.ticks.forEach((tick) => {
        y = 0.5 * scale - tick.pos * yscale + tickOffset;
        context.strokeStyle = theme.face;
        // console.log(`tick.pos = ${tick.pos}   y = ${y}`);
        if (theme.blank) {
          context.lineWidth = theme.width;
          context.beginPath();
          context.moveTo(22.5 * scale, y);
          context.lineTo(28.5 * scale, y);
          context.closePath();
          context.stroke();
        } else {
          context.lineWidth = scale;
          context.beginPath();
          context.moveTo(22.5 * scale, y);
          context.lineTo(27.5 * scale, y);
          context.closePath();
          context.stroke();
        }

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
        context.strokeRect(-1.5, -1.5, height + 3, width + 3);
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
    } else if (this.style == 1) {
      // Colorbar dimension: 255 x 20
      const tscale = Math.round(2.0 * scale);
      const height = Math.round(20 * tscale);
      const width = Math.round(255 * scale);
      const originX = Math.round(this.canvas.width - 60 * scale);
      const originY = Math.round(this.canvas.height - 110 * scale);
      const tickOffset = tscale - 1;
      context.translate(originX, originY);
      context.font = `${16 * scale}px LabelFont`;
      configs.style.ticks.forEach((tick) => {
        x = 0.5 * scale - tick.pos * tscale + tickOffset;
        context.strokeStyle = theme.face;
        // console.log(`tick.pos = ${tick.pos}   y = ${y}`);
        if (theme.blank) {
          context.lineWidth = theme.width;
          context.beginPath();
          context.moveTo(x, 22.5 * scale);
          context.lineTo(x, 28.5 * scale);
          context.closePath();
          context.stroke();
        } else {
          context.lineWidth = scale;
          context.beginPath();
          context.moveTo(x, 22.5 * scale);
          context.lineTo(x, 27.5 * scale);
          context.closePath();
          context.stroke();
        }

        context.lineWidth = theme.width;
        let meas = this.context.measureText(tick.text);
        let xx = x;
        let yy = 4 * scale;
        context.fillStyle = theme.face;
        context.strokeStyle = theme.stroke;
        context.strokeText(tick.text, xx, yy);
        context.fillText(tick.text, xx, yy);
      });

      // Colorbar shades. The first shade is transparent.
      context.lineWidth = theme.width;
      // context.rotate(-0.5 * Math.PI);
      context.imageSmoothingEnabled = false;
      if (theme.blank) {
        context.fillStyle = theme.face;
        context.strokeRect(-1.5, -1.5, width + 3, height + 3);
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
        context.drawImage(
          configs.palette,
          1,
          configs.style.index,
          255,
          1,
          0,
          0,
          width,
          height
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
}

export { Colorbar };
