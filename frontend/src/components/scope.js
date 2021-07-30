//
//  scope.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4 } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Gesture } from "./gesture";
import { Texture } from "./texture";

//
// Use as <Scope data={input} />
//
// Required: input = {t: Float32Array(),
//                    i: Float32Array(),
//                    q: Float32Array(),
//                    a: Float32Array()}:
// t - time
// i - in-phase component
// q - quadrature component
// a - amplitude
//
//
// Dimensions: w, h, a, b, c
//
//  +---- w ----+
//  |     c     |
//  |   +---+   |
//  | a |   | c h
//  |   +---+   |
//  |     b     |
//  +-----------+
//

class Scope extends Component {
  constructor(props) {
    super(props);
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.regl = require("regl")({
      canvas: this.canvas,
      extensions: ["ANGLE_instanced_arrays"],
    });
    if (props.showStats === true || props.debug === true) {
      this.stats = new Stats();
      this.stats.domElement.className = "canvasStats";
    }
    this.texture = new Texture(
      this.regl,
      this.props.textureScale,
      props.debugGL
    );
    this.constants = {
      rangeX: common.tickChoices(0.1, 5),
      rangeY: common.tickChoices(1, 5),
      bounds: {
        top: props.c,
        right: props.c,
        bottom: props.b,
        left: props.a,
      },
    };
    this.state = {
      v2dx: 1,
      v2dy: 1,
      scaleX: 1 / 1000,
      scaleY: 1 / 60000,
      offsetX: 0,
      offsetY: 0,
      screen: mat4.create(),
      projection: mat4.create(),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      grid: [0, 0],
      labelParameters: {
        labels: [],
        positions: [],
        alignments: [],
        foreground: props.colors.foreground,
        colors: [],
        sizes: [],
        countX: 0,
        countY: 0,
      },
    };
    // Our artists
    this.picaso = instanced.noninterleavedStripRoundCapJoin(this.regl, 8);
    this.monet = artists.basic(this.regl);
    this.gogh = artists.sprite(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.makeGrid = this.makeGrid.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleDoubleTap = this.fitToData;
  }

  static defaultProps = {
    a: 65,
    b: 30,
    c: 0,
    debug: false,
    debugGL: false,
    showStats: false,
    colors: common.colorDict(),
    linewidth: 1.4,
    textureScale: 1.0,
  };

  componentDidMount() {
    this.mount.appendChild(this.canvas);
    if (this.stats !== undefined) {
      this.mount.appendChild(this.stats.domElement);
    }
    this.updateProjection();
    this.regl.frame(this.draw);
  }

  componentWillUnmount() {
    console.log("Record something at home server or something ...");
  }

  render() {
    if (this.props.debug === true) {
      const str = this.gesture.message;
      return (
        <div className="fill">
          <div className="fill" ref={(x) => (this.mount = x)} />
          <div className="debug">
            <div className="leftPadded">{str}</div>
          </div>
        </div>
      );
    }
    return <div className="fill" ref={(x) => (this.mount = x)} />;
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    this.setState((state, props) => {
      const a = props.a;
      const b = props.b;
      const c = props.c;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const h2 = Math.floor(h / 2);
      const ww = Math.floor(w - a - c);
      const hh = Math.floor(h - b - c);
      const x0 = a;
      const y0 = b;
      const x1 = x0 + ww;
      const y1 = y0 + hh;
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
      // The model-view matrix
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
      return {
        screen: p,
        projection: mvp,
        spline: spline,
        pane: pane,
        grid: grid,
        viewport: { x: 0, y: 0, width: w, height: h },
        dataport: { x: a, y: b, width: ww, height: hh },
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        v2dx: v2dx,
        v2dy: v2dy,
      };
    });
  }

  makeGrid(v2dx, x0, x1, minX, maxX, v2dy, y0, y1, minY, maxY) {
    // Across the width, we want to allow about 120px in between grid lines
    const p = 6;
    const n = Math.round(this.canvas.width / 100);
    const xticks = common.ticksInRange(n, minX, maxX, this.constants.rangeX);
    const yticks = common.ticksInRange(5, minY, maxY, this.constants.rangeY);
    let j;
    let grid = [];
    let labels = [];
    let positions = [];
    let alignments = [];
    const m = this.state.scaleX * this.canvas.width;
    xticks.forEach((x) => {
      j = m * x + this.state.offsetX;
      j = Math.floor(j / v2dx + x0) + 0.5;
      if (j > x0 + p && j < x1 - p) {
        grid.push([j, y0 + 1, j, y1]);
        labels.push(x.toLocaleString());
        positions.push([j - 0.5, 18]);
        alignments.push([0, 0]);
      }
    });
    const count = labels.length;
    //console.log(positions);
    const w = this.state.scaleY * this.canvas.height;
    const b = this.state.offsetY + this.canvas.height / 2;
    yticks.forEach((x) => {
      j = w * x + b;
      j = Math.floor(j / v2dy + y0) + 0.5;
      if (j > y0 + p && j < y1 - p) {
        grid.push([x0 + 1, j, x1, j]);
        labels.push(x.toLocaleString());
        positions.push([this.props.a - 4.0, j - 0.5]);
        alignments.push([-0.5 * this.props.textureScale, 0]);
      }
    });
    // Make labels from those ticks, asynchronously
    const labelParameters = {
      labels: labels,
      positions: positions,
      alignments: alignments,
      foreground: this.props.colors.foreground,
      colors: common.array2rgba(this.props.colors.foreground),
      sizes: 14,
      countX: count,
      countY: labels.length - count,
    };
    // Update texture asynchronously
    this.texture.update(labelParameters).then((labelTexture) => {
      if (labelTexture !== undefined) {
        this.setState({
          label: labelTexture,
          labelParameters: labelParameters,
        });
      }
    });
    return grid.flat();
  }

  draw() {
    if (
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight ||
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
          projection: state.screen,
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
            dataY: props.data.a,
            width: props.linewidth,
            color: props.colors.lines[0],
            projection: state.projection,
            resolution: [state.dataport.width, state.dataport.height],
            segments: segments,
            viewport: state.dataport,
          },
          {
            dataX: props.data.t,
            dataY: props.data.i,
            width: props.linewidth,
            color: props.colors.lines[1],
            projection: state.projection,
            resolution: [state.dataport.width, state.dataport.height],
            segments: segments,
            viewport: state.dataport,
          },
          {
            dataX: props.data.t,
            dataY: props.data.q,
            width: props.linewidth,
            color: props.colors.lines[2],
            projection: state.projection,
            resolution: [state.dataport.width, state.dataport.height],
            segments: segments,
            viewport: state.dataport,
          },
        ]);
      }
      this.monet([
        {
          primitive: "lines",
          color: props.colors.grid,
          projection: state.screen,
          viewport: state.viewport,
          points: state.grid,
          count: state.grid.length / 2,
        },
        {
          primitive: "line loop",
          color: props.colors.spline,
          projection: state.screen,
          viewport: state.viewport,
          points: state.spline,
          count: state.spline.length / 2,
        },
      ]);
      if (state.label !== undefined) {
        this.gogh([
          {
            projection: state.screen,
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
        ]);
      }
      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }

  pan(x, y) {
    this.setState((state) => ({
      offsetX: state.offsetX + x * state.v2dx,
      offsetY: state.offsetY + y * state.v2dy,
    }));
    this.updateProjection();
  }

  magnify(mx, my, x, _y) {
    this.setState((state) => {
      const scaleX = common.clamp(state.scaleX * mx, 1 / 10000, 1 / 10);
      const scaleY = common.clamp(state.scaleY * my, 1 / 70000, 1 / 10);
      const deltaX = (x - state.offsetX) * (scaleX / state.scaleX - 1);
      //const deltaY = (y - state.offsetY) * (scaleY / state.scaleY - 1);
      return {
        scaleX: scaleX,
        scaleY: scaleY,
        offsetX: state.offsetX - deltaX * state.v2dx,
        lastMagnifyTime: new Date().getTime(),
      };
    });
    this.updateProjection();
  }

  fitToData() {
    if (this.props.data.t === null) {
      this.setState({
        scaleX: 1 / 1000,
        scaleY: 1 / 60000,
        offsetX: 0,
        offsetY: 0,
      });
      this.updateProjection();
      return;
    }
    const t = this.props.data.t;
    const i = this.props.data.i || this.props.data.ch1.i;
    const q = this.props.data.q || this.props.data.ch1.q;
    const ymin = Math.min(
      i.reduce((x, y) => Math.min(x, y)),
      q.reduce((x, y) => Math.min(x, y))
    );
    const ymax = Math.max(
      i.reduce((x, y) => Math.max(x, y)),
      q.reduce((x, y) => Math.max(x, y))
    );
    this.setState({
      scaleX: common.clamp(1 / (t[t.length - 1] - t[0]), 1 / 10000, 1 / 10),
      scaleY: common.clamp(0.85 / (ymax - ymin), 1 / 70000, 1 / 10),
      offsetX: 0,
      offsetY: 0,
    });
    this.updateProjection();
  }
}

export { Scope };
