//
//  scope2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { mat4 } from "gl-matrix";
import { Scope } from "./scope";

//
// Use as <Scope data={input} />
//
// Required: input = {t: Float32Array(),
//                    i1: Float32Array(),
//                    q1: Float32Array(),
//                    a1: Float32Array(),
//                    i2: Float32Array(),
//                    q2: Float32Array(),
//                    a2: Float32Array()}:
// t - time
// i1 - channel 1 in-phase component
// q1 - channel 1 quadrature component
// a1 - channel 1 amplitude
// i2 - channel 2 in-phase component
// q2 - channel 2 quadrature component
// a2 - channel 2 amplitude
//
//
// Dimensions: w, h, a, b, c, d
//
//  +---- w ----+
//  |     c     |
//  |   +---+   |
//  |   |   | c |
//  |   +---+   |
//  |     d     h
//  |   +---+   |
//  | a |   |   |
//  |   +---+   |
//  |     b     |
//  +-----------+
//

class Scope2 extends Scope {
  constructor(props) {
    super(props);
    this.geometry = {
      ...this.geometry,
      screen1: mat4.create(),
      screen2: mat4.create(),
      dataport1: { x: 0, y: 0, width: 1, height: 1 },
      dataport2: { x: 0, y: 0, width: 1, height: 1 },
    };
  }

  static defaultProps = {
    ...super.defaultProps,
    d: 10,
    title: "Dual-Channel",
    class: "scopeDouble",
  };

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    const geo = this.geometry;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const a = this.props.a;
    const b = this.props.b;
    const c = this.props.c;
    const d = this.props.d;
    const h2 = Math.floor(h / 2);
    const ww = Math.floor(w - a - c);
    const hh = Math.floor((h - b - c - d) / 2);
    const x0 = a;
    const y0 = b;
    const x1 = x0 + ww;
    const y1 = y0 + hh;
    // const y2 = y1 + d;
    const y2 = h - hh;
    const minX = -geo.offsetX / w / geo.scaleX;
    const maxX = (w - geo.offsetX) / w / geo.scaleX;
    const minY = (-h2 - geo.offsetY) / h / geo.scaleY;
    const maxY = (h - h2 - geo.offsetY) / h / geo.scaleY;
    geo.v2dx = w / ww;
    geo.v2dy = h / hh;
    geo.spline[0] = x1 - 0.5;
    geo.spline[1] = y0 + 0.5;
    geo.spline[2] = x1 - 0.5;
    geo.spline[3] = y1 - 0.5;
    geo.spline[4] = x0 + 0.5;
    geo.spline[5] = y1 - 0.5;
    geo.spline[6] = x0 + 0.5;
    geo.spline[7] = y0 + 0.5;
    geo.pane[0] = x0;
    geo.pane[1] = y0;
    geo.pane[2] = x1;
    geo.pane[3] = y0;
    geo.pane[4] = x0;
    geo.pane[5] = y1;
    geo.pane[6] = x1;
    geo.pane[7] = y1;
    // Ticks in viewport's coordinate
    geo.grid = this.makeGrid(x0, x1, minX, maxX, y0, y1, minY, maxY);
    // Directly change the view matrix's coefficients
    geo.view[0] = geo.scaleX * w;
    geo.view[5] = geo.scaleY * h;
    geo.view[12] = geo.offsetX;
    geo.view[13] = geo.offsetY + h2;
    geo.screen1 = mat4.ortho([], 0, w, 0, h, 0, -1);
    geo.screen2 = translateY([], geo.screen1, y2 - b);
    geo.projection = mat4.multiply([], geo.screen1, geo.view);
    geo.dataport1 = { x: a, y: y2, width: ww, height: hh };
    geo.dataport2 = { x: a, y: y0, width: ww, height: hh };
    geo.viewport = { x: 0, y: 0, width: w, height: h };
    geo.needsUpdate = false;
  }

  draw() {
    if (this.mount === undefined) return;
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight ||
      this.geometry.labelParameters.foreground != this.props.colors.foreground
    ) {
      this.updateProjection();
    }
    const geo = this.geometry;
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.monet([
      {
        primitive: "triangle strip",
        color: this.props.colors.pane,
        projection: geo.screen1,
        viewport: geo.viewport,
        points: geo.pane,
        count: geo.pane.length / 2,
      },
      {
        primitive: "triangle strip",
        color: this.props.colors.pane,
        projection: geo.screen2,
        viewport: geo.viewport,
        points: geo.pane,
        count: geo.pane.length / 2,
      },
    ]);
    if (this.props.data.t !== null) {
      const segments = this.props.data.t.length - 1;
      this.picaso([
        {
          dataX: this.props.data.t,
          dataY: this.props.data.ch1.a,
          width: this.props.linewidth,
          color: this.props.colors.lines[0],
          projection: geo.projection,
          resolution: [geo.dataport1.width, geo.dataport1.height],
          segments: segments,
          viewport: geo.dataport1,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.ch1.i,
          width: this.props.linewidth,
          color: this.props.colors.lines[5],
          projection: geo.projection,
          resolution: [geo.dataport1.width, geo.dataport1.height],
          segments: segments,
          viewport: geo.dataport1,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.ch1.q,
          width: this.props.linewidth,
          color: this.props.colors.lines[6],
          projection: geo.projection,
          resolution: [geo.dataport1.width, geo.dataport1.height],
          segments: segments,
          viewport: geo.dataport1,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.ch2.a,
          width: this.props.linewidth,
          color: this.props.colors.lines[0],
          projection: geo.projection,
          resolution: [geo.dataport2.width, geo.dataport2.height],
          segments: segments,
          viewport: geo.dataport2,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.ch2.i,
          width: this.props.linewidth,
          color: this.props.colors.lines[3],
          projection: geo.projection,
          resolution: [geo.dataport2.width, geo.dataport2.height],
          segments: segments,
          viewport: geo.dataport2,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.ch2.q,
          width: this.props.linewidth,
          color: this.props.colors.lines[4],
          projection: geo.projection,
          resolution: [geo.dataport2.width, geo.dataport2.height],
          segments: segments,
          viewport: geo.dataport2,
        },
      ]);
    }
    this.monet([
      {
        primitive: "lines",
        color: this.props.colors.grid,
        projection: geo.screen1,
        viewport: geo.viewport,
        points: geo.grid,
        count: geo.grid.length / 2,
      },
      {
        primitive: "lines",
        color: this.props.colors.grid,
        projection: geo.screen2,
        viewport: geo.viewport,
        points: geo.grid,
        count: geo.grid.length / 2,
      },
      {
        primitive: "line loop",
        color: this.props.colors.spline,
        projection: geo.screen1,
        viewport: geo.viewport,
        points: geo.spline,
        count: geo.spline.length / 2,
      },
      {
        primitive: "line loop",
        color: this.props.colors.spline,
        projection: geo.screen2,
        viewport: geo.viewport,
        points: geo.spline,
        count: geo.spline.length / 2,
      },
    ]);
    if (geo.label.texture !== null) {
      let origin = 2 * geo.labelParameters.countX;
      let ypoints = geo.label.position.slice(origin);
      let yorigin = geo.label.origin.slice(origin);
      let yspread = geo.label.spread.slice(origin);
      this.gogh([
        {
          projection: geo.screen1,
          viewport: geo.viewport,
          scale: this.props.textureScale,
          color: this.props.debugGL ? [0, 0, 0.6, 0.7] : [0, 0, 0, 0],
          bound: [this.textEngine.canvas.width, this.textEngine.canvas.height],
          texture: geo.label.texture,
          points: geo.label.position,
          origin: geo.label.origin,
          spread: geo.label.spread,
          count: geo.label.position.length / 2,
        },
        {
          projection: geo.screen2,
          viewport: geo.viewport,
          scale: this.props.textureScale,
          color: this.props.debugGL ? [0, 0, 0.6, 0.7] : [0, 0, 0, 0],
          bound: [this.textEngine.canvas.width, this.textEngine.canvas.height],
          texture: geo.label.texture,
          points: ypoints,
          origin: yorigin,
          spread: yspread,
          count: ypoints.length / 2,
        },
      ]);
    }
    if (this.stats !== undefined) this.stats.update();
  }
}

export { Scope2 };

function translateY(out, a, y) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13] + a[5] * y;
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
