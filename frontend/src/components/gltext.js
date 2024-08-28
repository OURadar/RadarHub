//
//  gltext.js
//  RadarHub
//
//  Created by Boonleng Cheong on 8/7/2024.
//

// Designed for fixed-width fonts, I am not ready to handle proportional fonts yet.

const nameStyle = "background-color: #444; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";

const glyphHead = 32;
const glyphTail = 180;
const glyphCount = glyphTail - glyphHead;

// Use instanced patch to draw text
class GLText {
  constructor(regl) {
    this.regl = regl;
    this.scale = window.devicePixelRatio;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1024 * this.scale;
    this.canvas.height = 1024 * this.scale;
    this.pageWidth = this.canvas.width;
    this.pageHeight = this.canvas.height;
    this.context = this.canvas.getContext("2d", { willReadFrequently: true });
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.translate(0, this.canvas.height);
    this.context.scale(1, -1);
    this.busy = false;
    this.attrs = { 32: {} };
    this.fontface = [];
    this.fontsizes = [];
    this.tic = 0;
    this._x = 1;
    this._y = 1;
    this._lineHeight = 0;

    // Binding methods
    this.makeBuffer = this.makeBuffer.bind(this);
    this.addSize = this.addSize.bind(this);
  }

  addSize(pointSize, faceColor, strokeColor, font, debug) {
    const pixelSize = pointSize * this.scale;
    const lineHeight = Math.ceil(pixelSize * 1.3);
    const context = this.context;
    const strokeWidth = 2.0 * window.devicePixelRatio;
    const colors = ["#ffff00", "#00ff00", "#00ffff", "#ff00ff"];
    this.attrs[String(pointSize)] = {
      pixelSize,
      lineHeight,
      faceColor,
      strokeColor,
      strokeWidth,
      coords: [],
    };
    // Use the font size to measure the width of the letter "W"
    context.font = `${pixelSize}px ${font}`;
    const w = ((letter) => {
      context.lineWidth = strokeWidth;
      context.strokeStyle = strokeColor;
      const measure = context.measureText(letter);
      console.log(`this.scale = ${this.scale}`);
      return Math.ceil(measure.width + 1.5 * strokeWidth);
    })("W");
    // Glyphs are drawn in a grid
    let x = this._x;
    let y = this._y;
    let coords = [];
    this._lineHeight = Math.max(this._lineHeight, lineHeight);
    for (let c = glyphHead; c < glyphTail; c++) {
      const letter = String.fromCharCode(c);
      context.lineWidth = strokeWidth;
      context.strokeStyle = strokeColor;
      const measure = context.measureText(letter);
      if (x + measure.actualBoundingBoxRight - measure.actualBoundingBoxLeft > this.canvas.width - 10) {
        x = 1;
        y = Math.floor(y + this._lineHeight);
      }
      // const o = measure.actualBoundingBoxLeft < 0 ? -Math.ceil(measure.actualBoundingBoxLeft) : 0;
      const o = 0;
      const m = Math.ceil(measure.actualBoundingBoxRight);
      // Outline the glyph if debug is true
      if (debug) {
        context.lineWidth = 1;
        context.strokeStyle = colors[c % colors.length];
        context.globalAlpha = 0.75;
        context.strokeRect(x + 0.5 + o, y + 0.5, m - 1, lineHeight - 1);
        context.globalAlpha = 1.0;
        context.strokeRect(x + 0.5, y + 0.5, w - 1, lineHeight - 1);
      }
      // Draw the glyph
      const i = x + o + strokeWidth;
      const j = y + pixelSize;
      context.lineWidth = strokeWidth;
      context.strokeStyle = strokeColor;
      context.strokeText(letter, i, j);
      context.fillStyle = faceColor;
      context.fillText(letter, i, j);
      coords.push({ x, y, o, w });
      x += w;
    }
    this.attrs[String(pointSize)].coords = coords;
    this.pageHeight = Math.ceil(y + lineHeight);
    this._x = x;
    this._y = y;
  }

  async makeBuffer(sizes = [12, 20, 32], color = "white", outline = "black", font = "TickLabelFont", debug = false) {
    if (Array.isArray(sizes)) {
      sizes.forEach((size) => {
        this.addSize(size, color, outline, font, debug);
      });
    } else {
      this.addSize(sizes, color, outline, font, debug);
    }
    // Reorient the coordinates to be simpler with getDrawables for WebGL later
    console.log(this.attrs);
    Object.values(this.attrs).forEach((attr) => {
      attr.coords = attr.coords.map(({ x, y, w }) => {
        return { x, y: this.pageHeight - attr.lineHeight - y, w };
      });
    });
    if (debug) {
      this.context.lineWidth = 1;
      this.context.strokeStyle = "#ff0000";
      this.context.strokeRect(0.5, 0.5, this.canvas.width - 1, this.pageHeight - 1);
    }
    const coords = [];
    const image = this.context.getImageData(
      0,
      this.canvas.height - this.pageHeight,
      this.canvas.width,
      this.pageHeight
    );
    return {
      image,
      coords,
      height: this.pageHeight,
      width: this.canvas.width,
    };
  }

  getDrawbles(text, pointsize, origin = [0, 0]) {
    const attr = this.attrs[String(pointsize)];
    const height = attr.lineHeight;
    let positions = [];
    let spreads = [];
    let origins = [];
    Array.from(text).forEach((letter) => {
      let index = letter.charCodeAt(0) - glyphHead;
      if (index < 0 || index > glyphCount) {
        index = 0;
      }
      const coord = attr.coords[index];
      positions.push(origin.slice());
      spreads.push([coord.w, height]);
      origins.push([coord.x, coord.y]);
      origin[0] += coord.w;
    });
    return {
      positions,
      origins,
      spreads,
      count: text.length,
    };
  }
}

export { GLText };
