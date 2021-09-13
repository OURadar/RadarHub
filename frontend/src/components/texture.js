//
//  texture.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/20/2021.
//
//
//  Initialize as:
//  obj = Texture(regl)
//
//  Update as:
//  obj.update(text, callback)
//
//  where
//
//  text = {
//    labels: ['label-1', 'label-2', ...]
//    positions: [[x0, y0], [x1, y1], ... ]
//    alignments: [[u0, v0], [u1, v1], ...]
//    colors: ['#808080', 'black', ...]
//    fonts: ['font-1', 'font-2', ...]
//  }
//  callback = a callback function when the texture is ready
//
//  NOTE: slices and attributes must have the same length
//

class Texture {
  constructor(regl, scale = window.devicePixelRatio, debug = false) {
    this.regl = regl;
    this.scale = scale;
    this.debug = debug;
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

    if (this.debug) {
      const o = document.getElementById("test");
      if (o) o.appendChild(this.canvas);
    } else {
      console.log("Debugging element <div id='test'></div> not found.");
    }

    let font = new FontFace(
      "LabelFont",
      "url(/static/blob/helveticaneue/HelveticaNeueMed.ttf)"
    );
    font.load().then(() => {
      this.fontLoaded = true;
      // this.checkFontLoaded();
    });
  }

  checkFontLoaded() {
    let meas = this.context.measureText("tesla");
    console.log(
      `checkFontLoaded: %cmeas.wdith=${meas.width.toFixed(2)} ${
        meas.width == this.initWidth ? "=" : "/="
      } initWidth=${this.initWidth.toFixed(2)} tic = ${this.tic}`,
      "color:blue"
    );
    if (meas.width != this.initWidth || this.tic++ > 50) {
      this.fontLoaded = true;
    }
  }

  waitBriefly() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("waited");
      }, 10);
    });
  }

  async update(text) {
    if (this.busy) {
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
    if (this.debug) {
      context.fillStyle = "#dddddd";
      context.fillRect(0, 0, 1024, 512);
    }
    const p = this.constants.padding;
    let f = 0;
    let x = 0.5;
    let y = 0.5;
    let points = [];
    let origins = [];
    let spreads = [];
    for (let k = 0; k < text.labels.length; k++) {
      const label = text.labels[k];
      const position = text.positions[k];
      const alignment = Array.isArray(text.alignments)
        ? text.alignments[k]
        : text.alignments;
      const color = Array.isArray(text.colors) ? text.colors[k] : text.colors;
      const size = Array.isArray(text.sizes) ? text.sizes[k] : text.sizes;
      // Measure the label extent
      context.font = size * this.scale + "px LabelFont";
      const meas = context.measureText(label);
      const w = Math.ceil(meas.width);
      const h = this.hasDetails
        ? meas.actualBoundingBoxAscent + meas.actualBoundingBoxDescent
        : Math.ceil(0.8 * size);
      const ww = w + 2 * p;
      const hh = h + 2 * p;
      f = Math.max(f, h);
      // Move to the next row if we nearing the end of the texture
      if (x + ww > this.canvas.width) {
        x = 0.5;
        y += Math.ceil(f + 2 * p);
      }
      const xx = position[0] + alignment[0] * w;
      const yy = position[1] + alignment[1] * h;
      origins.push(x - 0.5, y - 0.5);
      spreads.push(ww + 1, hh + 1);
      points.push(xx, yy);
      if (this.debug) {
        context.strokeStyle = "skyblue";
        context.strokeRect(x + p, y + p, w, h);
        context.strokeStyle = "orange";
        context.strokeRect(x, y, ww, hh);
      }
      //context.strokeStyle = "white";
      context.fillStyle = color;
      context.fillText(
        label,
        x + p,
        y + p + (this.hasDetails ? meas.actualBoundingBoxAscent : h)
      );
      x += ww + 1;
      if (this.debug) await this.waitBriefly();
    }
    this.busy = false;
    return {
      position: points,
      origin: origins,
      spread: spreads,
      texture: this.regl.texture({
        data: this.canvas,
        min: "linear",
        mag: "linear",
      }),
      count: text.labels.length,
    };
  }
}

export { Texture };
