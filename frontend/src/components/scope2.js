//
//  Scope2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { mat4 } from "gl-matrix";
import { Scope } from "./scope";

import * as common from "./common";

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
  static defaultProps = {
    ...super.defaultProps,
    colors: common.colordict(),
  };

  updateProjection() {
    this.canvas.setAttribute("width", this.mount.offsetWidth);
    this.canvas.setAttribute("height", this.mount.offsetHeight);
    this.setState((state, props) => {
      const a = props.a;
      const b = props.b;
      const c = props.c;
      const d = props.d;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const h2 = Math.floor(h / 2);
      const ww = Math.floor(w - a - c);
      const hh = Math.floor((h - b - c - d) / 2);
      const x0 = a;
      const y0 = b;
      const x1 = x0 + ww;
      const y1 = y0 + hh;
      // const y2 = y1 + d;
      const y2 = h - hh - 1;
      const minX = -state.offsetX / w / state.scaleX;
      const maxX = (w - state.offsetX) / w / state.scaleX;
      const minY = (-h2 - state.offsetY) / h / state.scaleY;
      const maxY = (h - h2 - state.offsetY) / h / state.scaleY;
      const spline = new Float32Array(
        [
          [x1 - 0.5, y0 + 0.5],
          [x1 - 0.5, y1 - 0.5],
          [x0 + 0.5, y1 - 0.5],
          [x0 + 0.5, y0 + 0.5],
        ].flat()
      );
      const pane = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
      const v2dx = w / ww;
      const v2dy = h / hh;

      // Ticks in viewport's coordinate
      const grid = this.makeGrid(
        v2dx,
        x0,
        x1,
        minX,
        maxX,
        v2dy,
        y0,
        y1,
        minY,
        maxY
      );

      const p = mat4.ortho(mat4.create(), 0, w, 0, h, 0, -1);
      // m[0, 0] scale x
      // m[1, 1] scale y
      // m[3, 0] translate x (view coordinate)
      // m[3, 1] translate y (view coordinate)
      const mv = mat4.fromValues(
        state.scaleX * w,
        0,
        0,
        0,
        0,
        state.scaleY * h,
        0,
        0,
        0,
        0,
        1,
        0,
        state.offsetX,
        state.offsetY + h2,
        0,
        1
      );
      const mvp = mat4.multiply([], p, mv);
      const two = mat4.fromTranslation([], [0, y2 - b, 0]);
      const p2 = mat4.multiply([], p, two);
      return {
        screen1: p,
        screen2: p2,
        projection: mvp,
        spline: spline,
        pane: pane,
        grid: grid,
        viewport: { x: 0, y: 0, width: w, height: h },
        dataport1: { x: a, y: y0, width: ww, height: hh },
        dataport2: { x: a, y: y2, width: ww, height: hh },
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        v2dx: v2dx,
        v2dy: v2dy,
      };
    });
  }

  static defaultProps = {
    ...super.defaultProps,
    d: 10,
  };

  draw() {
    if (
      this.mount.offsetWidth != this.canvas.width ||
      this.mount.offsetHeight != this.canvas.height ||
      this.state.labelParameters.foreground != this.props.colors.foreground
    ) {
      this.updateProjection();
    }
    this.setState((state, props) => {
      this.regl.clear({
        color: props.colors.canvas,
      });
      this.monet([
        {
          primitive: "triangle strip",
          color: props.colors.pane,
          projection: state.screen1,
          viewport: state.viewport,
          points: state.pane,
          count: state.pane.length / 2,
        },
        {
          primitive: "triangle strip",
          color: props.colors.pane,
          projection: state.screen2,
          viewport: state.viewport,
          points: state.pane,
          count: state.pane.length / 2,
        },
      ]);
      if (props.data.t !== null) {
        const segments = props.data.t.length - 1;
        this.picaso([
          {
            dataX: props.data.t,
            dataY: props.data.a1,
            width: props.linewidth,
            color: props.colors.lines[0],
            projection: state.projection,
            resolution: [state.dataport1.width, state.dataport1.height],
            segments: segments,
            viewport: state.dataport1,
          },
          {
            dataX: props.data.t,
            dataY: props.data.i1,
            width: props.linewidth,
            color: props.colors.lines[5],
            projection: state.projection,
            resolution: [state.dataport1.width, state.dataport1.height],
            segments: segments,
            viewport: state.dataport1,
          },
          {
            dataX: props.data.t,
            dataY: props.data.q1,
            width: props.linewidth,
            color: props.colors.lines[6],
            projection: state.projection,
            resolution: [state.dataport1.width, state.dataport1.height],
            segments: segments,
            viewport: state.dataport1,
          },
          {
            dataX: props.data.t,
            dataY: props.data.a2,
            width: props.linewidth,
            color: props.colors.lines[0],
            projection: state.projection,
            resolution: [state.dataport2.width, state.dataport2.height],
            segments: segments,
            viewport: state.dataport2,
          },
          {
            dataX: props.data.t,
            dataY: props.data.i2,
            width: props.linewidth,
            color: props.colors.lines[3],
            projection: state.projection,
            resolution: [state.dataport2.width, state.dataport2.height],
            segments: segments,
            viewport: state.dataport2,
          },
          {
            dataX: props.data.t,
            dataY: props.data.q2,
            width: props.linewidth,
            color: props.colors.lines[4],
            projection: state.projection,
            resolution: [state.dataport2.width, state.dataport2.height],
            segments: segments,
            viewport: state.dataport2,
          },
        ]);
      }
      this.monet([
        {
          primitive: "lines",
          color: props.colors.grid,
          projection: state.screen1,
          viewport: state.viewport,
          points: state.grid,
          count: state.grid.length / 2,
        },
        {
          primitive: "lines",
          color: props.colors.grid,
          projection: state.screen2,
          viewport: state.viewport,
          points: state.grid,
          count: state.grid.length / 2,
        },
        {
          primitive: "line loop",
          color: props.colors.spline,
          projection: state.screen1,
          viewport: state.viewport,
          points: state.spline,
          count: state.spline.length / 2,
        },
        {
          primitive: "line loop",
          color: props.colors.spline,
          projection: state.screen2,
          viewport: state.viewport,
          points: state.spline,
          count: state.spline.length / 2,
        },
      ]);
      if (state.label !== undefined) {
        let origin = 2 * state.labelParameters.countX;
        let ypoints = state.label.position.slice(origin);
        let yorigin = state.label.origin.slice(origin);
        let yspread = state.label.spread.slice(origin);
        this.gogh([
          {
            projection: state.screen1,
            viewport: state.viewport,
            scale: props.textureScale,
            color: props.debugGL ? [0, 0, 0.6, 0.7] : [0, 0, 0, 0],
            bound: [this.texture.canvas.width, this.texture.canvas.height],
            texture: state.label.texture,
            points: state.label.position,
            origin: state.label.origin,
            spread: state.label.spread,
            count: state.label.position.length / 2,
          },
          {
            projection: state.screen2,
            viewport: state.viewport,
            scale: props.textureScale,
            color: props.debugGL ? [0, 0, 0.6, 0.7] : [0, 0, 0, 0],
            bound: [this.texture.canvas.width, this.texture.canvas.height],
            texture: state.label.texture,
            points: ypoints,
            origin: yorigin,
            spread: yspread,
            count: ypoints.length / 2,
          },
        ]);
      }
      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }
}

export { Scope2 };
