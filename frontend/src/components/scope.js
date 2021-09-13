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
import { SectionHeader } from "./section-header";
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
    if (props.profileGL) {
      this.regl = require("regl")({
        canvas: this.canvas,
        extensions: ["ANGLE_instanced_arrays", "ext_disjoint_timer_query"],
        profile: true,
      });
    } else {
      this.regl = require("regl")({
        canvas: this.canvas,
        extensions: ["ANGLE_instanced_arrays"],
      });
    }
    if (props.showStats || props.debug || props.profileGL) {
      this.stats = new Stats();
      this.stats.domElement.className = "canvasStats";
    }
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
      tic: 0,
      message: "scope",
    };
    // scaleX, scaleY - scale component of view matrix
    // offsetX, offsetY - offset component of view matrix
    // v2dx, v2dy - data view to display view scaling
    // screen - projection matrix to screen space
    // projection - model-view-projection matrix for the shaders
    this.geometry = {
      scaleX: 1 / 1000,
      scaleY: 1 / 60000,
      offsetX: 0,
      offsetY: 0,
      v2dx: 1,
      v2dy: 1,
      view: mat4.create(),
      screen: mat4.create(),
      projection: mat4.create(),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      dataport: { x: 0, y: 0, width: 1, height: 1 },
      spline: new Float32Array(8),
      pane: new Float32Array(8),
      grid: [],
      label: { texture: null, position: [], origin: [], spread: [], count: 0 },
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
      message: "geometry",
      needsUpdate: true,
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
    // Other built-in assets
    this.textEngine = new Texture(this.regl, props.textureScale, props.debugGL);
  }

  static defaultProps = {
    a: 65,
    b: 30,
    c: 0,
    debug: false,
    debugGL: false,
    profileGL: false,
    showStats: false,
    colors: common.colorDict(),
    linewidth: 1.4,
    textureScale: 1.0,
    title: "Single-Channel",
    class: "scopeSingle",
    showHeader: true,
  };

  componentDidMount() {
    this.mount.appendChild(this.canvas);
    if (this.stats !== undefined) {
      this.mount.appendChild(this.stats.domElement);
    }
    this.updateProjection();
    this.regl.frame(this.draw);
  }

  render() {
    const str = this.props.debug
      ? `${this.gesture.message} : ${this.geometry.message} : ${this.state.message}`
      : "";
    return (
      <div>
        {this.props.showHeader && <SectionHeader name="scope" />}
        <div className="scopeWrapper roundCorner">
          <h3>{this.props.title}</h3>
          <div className={this.props.class}>
            <div className="fill" ref={(x) => (this.mount = x)} />
            {this.props.debug && (
              <div className="debug">
                <div className="leftPadded">{str}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    const geo = this.geometry;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const a = this.props.a;
    const b = this.props.b;
    const c = this.props.c;
    const h2 = Math.floor(h / 2);
    const ww = Math.floor(w - a - c);
    const hh = Math.floor(h - b - c);
    const x0 = a;
    const y0 = b;
    const x1 = x0 + ww;
    const y1 = y0 + hh;
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
    geo.screen = mat4.ortho([], 0, w, 0, h, 0, -1);
    geo.projection = mat4.multiply([], geo.screen, geo.view);
    geo.viewport = { x: 0, y: 0, width: w, height: h };
    geo.dataport = { x: a, y: b, width: ww, height: hh };
    geo.needsUpdate = false;
  }

  makeGrid(x0, x1, minX, maxX, y0, y1, minY, maxY) {
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
    const m = this.geometry.scaleX * this.canvas.width;
    xticks.forEach((x) => {
      j = m * x + this.geometry.offsetX;
      j = Math.floor(j / this.geometry.v2dx + x0) + 0.5;
      if (j > x0 + p && j < x1 - p) {
        grid.push([j, y0 + 1, j, y1]);
        labels.push(x.toLocaleString());
        positions.push([j - 0.5, 18]);
        alignments.push([0, 0]);
      }
    });
    const count = labels.length;
    //console.log(positions);
    const w = this.geometry.scaleY * this.canvas.height;
    const b = this.geometry.offsetY + this.canvas.height / 2;
    yticks.forEach((x) => {
      j = w * x + b;
      j = Math.floor(j / this.geometry.v2dy + y0) + 0.5;
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
    this.textEngine.update(labelParameters).then((result) => {
      if (result !== undefined) {
        this.geometry.label = result;
        this.geometry.labelParameters = labelParameters;
      }
    });
    return grid.flat();
  }

  draw() {
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
    this.monet({
      primitive: "triangle strip",
      color: this.props.colors.pane,
      projection: geo.screen,
      viewport: geo.viewport,
      points: geo.pane,
      count: geo.pane.length / 2,
    });
    if (this.props.data.t !== null) {
      const segments = this.props.data.t.length - 1;
      this.picaso([
        {
          dataX: this.props.data.t,
          dataY: this.props.data.a,
          width: this.props.linewidth,
          color: this.props.colors.lines[0],
          projection: geo.projection,
          resolution: [geo.dataport.width, geo.dataport.height],
          segments: segments,
          viewport: geo.dataport,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.i,
          width: this.props.linewidth,
          color: this.props.colors.lines[1],
          projection: geo.projection,
          resolution: [geo.dataport.width, geo.dataport.height],
          segments: segments,
          viewport: geo.dataport,
        },
        {
          dataX: this.props.data.t,
          dataY: this.props.data.q,
          width: this.props.linewidth,
          color: this.props.colors.lines[2],
          projection: geo.projection,
          resolution: [geo.dataport.width, geo.dataport.height],
          segments: segments,
          viewport: geo.dataport,
        },
      ]);
    }
    this.monet([
      {
        primitive: "lines",
        color: this.props.colors.grid,
        projection: geo.screen,
        viewport: geo.viewport,
        points: geo.grid,
        count: geo.grid.length / 2,
      },
      {
        primitive: "line loop",
        color: this.props.colors.spline,
        projection: geo.screen,
        viewport: geo.viewport,
        points: geo.spline,
        count: geo.spline.length / 2,
      },
    ]);
    if (geo.label.texture !== null) {
      this.gogh({
        projection: geo.screen,
        viewport: geo.viewport,
        scale: this.props.textureScale,
        color: this.props.debugGL ? [0, 0, 0.6, 0.7] : [0, 0, 0, 0],
        bound: [this.textEngine.canvas.width, this.textEngine.canvas.height],
        texture: geo.label.texture,
        points: geo.label.position,
        origin: geo.label.origin,
        spread: geo.label.spread,
        count: geo.label.count,
      });
    }
    if (this.stats !== undefined) this.stats.update();
  }

  pan(x, y) {
    const geo = this.geometry;
    geo.offsetX += x * geo.v2dx;
    geo.offsetY += y * geo.v2dx;
    geo.needsUpdate = true;
  }

  magnify(mx, my, _d, x, _y) {
    const geo = this.geometry;
    const scaleX = common.clamp(geo.scaleX * mx, 1 / 10000, 1 / 10);
    const scaleY = common.clamp(geo.scaleY * my, 1 / 70000, 1 / 10);
    const deltaX = (x - geo.offsetX) * (scaleX / geo.scaleX - 1);
    geo.scaleX = scaleX;
    geo.scaleY = scaleY;
    geo.offsetX -= deltaX * geo.v2dx;
    geo.needsUpdate = true;
  }

  fitToData() {
    const geo = this.geometry;
    if (this.props.data.t === null) {
      geo.scaleX = 1 / 1000;
      geo.scaleY = 1 / 60000;
      geo.offsetX = 0;
      geo.offsetY = 0;
      geo.needsUpdate = true;
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
    geo.scaleX = common.clamp(1 / (t[t.length - 1] - t[0]), 1 / 10000, 1 / 10);
    geo.scaleY = common.clamp(0.85 / (ymax - ymin), 1 / 70000, 1 / 10);
    geo.offsetX = 0;
    geo.offsetY = 0;
    geo.needsUpdate = true;
  }
}

export { Scope };
