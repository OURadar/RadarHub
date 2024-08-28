//
//  scope-b.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4 } from "gl-matrix";

import * as theme from "./theme";
import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { SectionHeader } from "./section-header";
import { Gesture } from "./gesture";
import { Texture } from "./texture";

import { Colorbar } from "./colorbar";
import { Symbol } from "./symbol";
import { Title } from "./title";

import { GLText } from "./gltext";

//
// Use as <Scope fifo={input} />
//
//
//
// Dimensions: w, h, t, r, b, l
//
//  +---- w ----+
//  |     t     |
//  |   +---+   |
//  | l |   | r h
//  |   +---+   |
//  |     b     |
//  +-----------+
//

const depth = 128;
const capacity = 512;

class ScopeB extends Component {
  constructor(props) {
    super(props);
    this.ratio = window.devicePixelRatio;
    this.gravity = props.gravity;
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
      count: 0,
      message: "b-scope",
      title: "-.-° / -.-°",
    };
    this.palette = {
      image: null,
      texture: null,
      symbol: "U",
      index: 0,
    };
    this.fontmap = {
      image: null,
      texture: null,
      height: 0,
      width: 0,
    };
    this.style = {
      name: "",
      ticks: [],
      index: 0,
    };
    var image = new Image();
    image.src = "/static/images/colormap.png";
    image.addEventListener("load", () => {
      this.palette = {
        image: image,
        texture: this.regl.texture({
          data: image,
          wrapS: "clamp",
          wrapT: "clamp",
          premultiplyAlpha: true,
        }),
        symbol: "-",
        index: 0.5 / image.height,
      };
      this.updateColorbar("Z");
    });
    // scaleX, scaleY - scale component of view matrix
    // offsetX, offsetY - offset component of view matrix
    // v2dx, v2dy - data view to display view scaling
    // screen - projection matrix to screen space
    // projection - model-view-projection matrix for the shaders
    this.geometry = {
      scaleX: 1.0,
      scaleY: 1.0,
      offsetX: 0.0,
      offsetY: 0.0,
      v2dx: 1.0,
      v2dy: 1.0,
      view: mat4.identity([]),
      screen: mat4.identity([]),
      modelview: mat4.identity([]),
      projection: mat4.identity([]),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      dataport: { x: 0, y: 0, width: 1, height: 1 },
      spline: new Float32Array(8),
      pane: new Float32Array(8),
      grid: [],
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
    console.log("geometry", this.geometry);
    // Our artists
    this.monet = artists.basic(this.regl);
    this.picaso = artists.simplifiedInstancedLines(this.regl);
    this.raphael = artists.texturedElements2D(this.regl);
    this.basic3 = artists.basic3(this.regl);
    this.rect2 = artists.rect2(this.regl);
    this.gogh = artists.instancedPatches2D(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleDoubleTap = this.taptap;
    // Other built-in assets
    this.textEngine = new Texture(this.regl, props.textureScale, props.debugGL);
    this.assets = ((regl) => {
      // Vertex positions for the two triangles
      // NOTE: vertices (0) and (2) are at the same position but cannot be shared
      //       because they have different texture coordinates. Same for (1) and (3).
      //
      //     (4)  ┌───────────┐ (5)
      //  (0, 1)  │ \         │ (1, 1)
      //          │   \       │
      //          │     \     │
      //          │       \   │
      //          │         \ │
      //  (0) (2) ├───────────┤ (1) (3)
      //   (0, v) │ \         │ (1, v)
      //          │   \       │
      //          │     \     │
      //          │       \   │
      //          │         \ │
      //   (6)    └───────────┘ (7)
      //   (0, 0)               (1, 0)
      //
      let positions = [];
      let elements = [];
      let origins = [];
      let v = 0.5;
      // Eight vertices
      positions.push(0.0, v);
      positions.push(1.0, v);
      positions.push(0.0, v);
      positions.push(1.0, v);
      positions.push(0.0, 1.0);
      positions.push(1.0, 1.0);
      positions.push(0.0, 0.0);
      positions.push(1.0, 0.0);
      // Two triangles
      elements.push(6, 7, 0);
      elements.push(7, 0, 1);
      elements.push(2, 3, 4);
      elements.push(3, 4, 5);
      // Eight origins
      origins.push(0.0, 0.0);
      origins.push(1.0, 0.0);
      origins.push(0.0, 1.0);
      origins.push(1.0, 1.0);
      origins.push(0.0, v);
      origins.push(1.0, v);
      origins.push(0.0, v);
      origins.push(1.0, v);
      return {
        data: regl.texture({
          shape: [capacity, depth],
          data: new Uint8Array(capacity * depth),
          format: "luminance",
          type: "uint8",
          min: "nearest",
          mag: "nearest",
        }),
        positions: regl.buffer({
          usage: "dynamic",
          type: "float",
          data: positions,
        }),
        elements: regl.elements({
          usage: "static",
          type: "uint16",
          data: elements,
        }),
        origins: regl.buffer({
          usage: "dynamic",
          type: "float",
          data: origins,
        }),
        row: 0,
      };
    })(this.regl);
    this.textEngine = new GLText(this.regl);
    this.textEngine.makeBuffer().then((buffer) => {
      this.fontmap = {
        image: buffer.image,
        texture: this.regl.texture({
          height: buffer.image.height,
          width: buffer.image.width,
          data: buffer.image.data,
          min: "nearest",
          mag: "nearest",
          premultiplyAlpha: true,
        }),
        height: buffer.height,
        width: buffer.width,
        bound: [buffer.width, buffer.height],
      };
      this.annotation = (({ positions, origins, spreads, count }) => {
        return {
          points: this.regl.buffer({
            usage: "static",
            type: "float",
            data: positions.flat(),
          }),
          origins: this.regl.buffer({
            usage: "static",
            type: "float",
            data: origins.flat(),
          }),
          spreads: this.regl.buffer({
            usage: "static",
            type: "float",
            data: spreads.flat(),
          }),
          count: count,
          bound: this.fontmap.bound,
          texture: this.fontmap.texture,
        };
      })(this.textEngine.getDrawbles("EL 180.0° / AZ 216.9°", 20, [100, 100]));
    });
    this.tic = 0;
  }

  static defaultProps = {
    t: 70,
    r: 320,
    b: 200,
    l: 150,
    debug: false,
    debugGL: false,
    profileGL: false,
    showStats: false,
    colors: theme.colorDict(),
    linewidth: 1.4,
    textureScale: 1.0,
    gravity: "right",
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
    return (
      <div className="fill" ref={(x) => (this.mount = x)}>
        <Colorbar
          {...this.props}
          id="colorbar"
          style={this.style}
          palette={this.palette.image}
          onClick={this.props.onColorbarClick}
          count={this.state.count}
        />
        <Title string={this.state.title} />
      </div>
    );
  }

  updateColorbar(symbol = "Z") {
    this.style = ((symbol) => {
      let ticks = [];
      if (symbol == "R") {
        // # Special case, values are mapped to indices
        // sticklabels = np.array([0.73, 0.83, 0.93, 0.96, 0.99, 1.02, 1.05])
        // sticks = rho2ind(sticklabels)
        const vv = [0.73, 0.83, 0.93, 0.96, 0.99, 1.02, 1.05];
        vv.forEach((v) => {
          let pos = rho2ind(v);
          let text = v.toFixed(2);
          ticks.push({ pos: pos, text: text });
        });
        return {
          name: "RhoHV (unitless)",
          ticks: ticks,
          index: 5,
        };
      } else if (symbol == "P") {
        // slim = (-180.0, +180.0)
        // sticklabels = np.arange(-135, 151, 45)
        // sticks = sticklabels * 128.0 / 180.0 + 128.0
        for (let v = -135; v < 151; v += 45) {
          let pos = (v * 128.0) / 180.0 + 128.0;
          let text = v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        }
        return {
          name: "PhiDP (degrees)",
          ticks: ticks,
          index: 4,
        };
      } else if (symbol == "D") {
        // slim = (-10.0, +15.6)
        // sticklabels = np.arange(-9, 15, 3)
        // sticks = sticklabels * 10.0 + 100.0
        for (let v = -9; v < 15; v += 3) {
          let pos = v * 10.0 + 100.0;
          let text = v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        }
        return {
          name: "ZDR (dB)",
          ticks: ticks,
          index: 3,
        };
      } else if (symbol == "W") {
        // # I realize there is an offset of 1 but okay
        // slim = (0, 12.80)
        // sticklabels = np.arange(0, 13, 2)
        // sticks = sticklabels * 20.0
        for (let v = 2; v < 13; v += 2) {
          let pos = v * 20;
          let text = v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        }
        return {
          name: "Spectrum Width (m/s)",
          ticks: ticks,
          index: 2,
        };
      } else if (symbol == "V" || symbol == "U") {
        // slim = (-64, +64.0)
        // sticklabels = np.arange(-60, 61, 15)
        // sticks = sticklabels * 128.0 / 64.0 + 128.0
        for (let v = -60; v < 61; v += 15) {
          let pos = v * 2.0 + 128.0;
          let text = v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        }
        return {
          name: (symbol == "U" ? "Unfolded " : "") + "Velocity (m/s)",
          ticks: ticks,
          index: 1,
        };
      } else if (symbol == "I") {
        // slim = [0, 1, 2, 3, 4, 5]
        // sticklabels = [void, -2, -1, 0, +1, +2]
        for (let v = -3; v < 3; v++) {
          let pos = (v + 2.5) * 42 + 46;
          let text = v == -3 ? "None" : (v > 0 ? "+" : "") + v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        }
        return {
          name: "Labels",
          ticks: ticks,
          index: 6,
        };
      } else {
        // slim = (-32.0, +96.0)
        // sticklabels = np.arange(-25, 81, 15)
        // sticks = sticklabels * 2.0 + 64.0
        let ticks = [];
        // for (let v = -25; v < 81; v += 15) {
        // for (let v = -10; v < 91; v += 10) {
        //   let pos = v * 2.0 + 64.0;
        //   let text = v.toFixed(0);
        //   ticks.push({ pos: pos, text: text });
        // }
        let vv = [-15, 0, 10, 20, 30, 40, 50, 60, 70, 80];
        vv.forEach((v) => {
          let pos = v * 2.0 + 64.0;
          let text = v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        });
        // ticks = vv.map((v) => {pos: v * 2.0 + 64.0, text: v.toFixed(0)})
        return {
          name: "Reflectivity (dBZ)",
          ticks: ticks,
          index: 0,
        };
      }
    })(symbol);
    if (this.palette.texture) {
      this.palette.index = (this.style.index + 0.5) / this.palette.texture.height;
      this.palette.symbol = symbol;
    }
    this.setState((state) => ({ count: state.count + 1 }));
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth * this.ratio;
    this.canvas.height = this.mount.offsetHeight * this.ratio;
    const geo = this.geometry;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this.props.t;
    const r = this.props.r;
    const b = this.props.b;
    const l = this.props.l;
    const ww = Math.floor(w - l - r);
    const hh = Math.floor(h - t - b);
    const x0 = l;
    const y0 = b;
    const x1 = x0 + ww;
    const y1 = y0 + hh;
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
    // Directly change the view matrix's coefficients
    geo.view[0] = geo.scaleX * w;
    geo.view[5] = geo.scaleY * h;
    geo.view[12] = geo.offsetX;
    geo.view[13] = geo.offsetY;
    geo.screen = mat4.ortho([], 0, w, 0, h, 1, -1);
    geo.projection = mat4.multiply([], geo.screen, geo.view);
    geo.dataport = { x: l, y: b, width: ww, height: hh };
    geo.viewport = { x: 0, y: 0, width: w, height: h };
    geo.fontport = { x: l, y: b, width: this.fontmap.width, height: this.fontmap.height };
    geo.needsUpdate = false;
    console.log("geo.spline", geo.spline);
  }

  draw() {
    if (this.mount === null || this.palette.texture === null) return;
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth * this.ratio ||
      this.canvas.height != this.mount.offsetHeight * this.ratio
    ) {
      this.updateProjection();
    }
    const geo = this.geometry;
    this.regl.clear({
      color: this.props.colors.glview,
    });
    this.monet({
      primitive: "triangle strip",
      color: this.props.colors.pane,
      projection: geo.screen,
      viewport: geo.viewport,
      points: geo.pane,
      count: 4,
    });
    // Update data buffer: dequeue the rays from FIFO, up to 6 rays
    let ray = null;
    for (let k = 0; k < 6 && this.props.fifo.hasData(); k++) {
      ray = this.props.fifo.dequeue();
      if (ray.viewNeedsClear) {
        this.assets.data.subimage({
          width: capacity,
          height: depth,
          data: new Uint8Array(capacity * depth),
        });
      }
      this.assets.data.subimage(
        {
          width: Math.min(capacity, ray.values.length),
          height: 1,
          data: ray.values,
        },
        0,
        this.assets.row
      );
      this.assets.row = (this.assets.row + 1) % depth;
    }
    if (ray) {
      const v = this.assets.row / depth;
      this.assets.positions.subdata([0.0, v, 1.0, v, 0.0, v, 1.0, v]);
      this.assets.origins.subdata([0.0, v, 1.0, v, 0.0, v, 1.0, v], 8 * Float32Array.BYTES_PER_ELEMENT);
      this.setState({ title: `EL ${ray.elevation}° / AZ ${ray.azimuth}°` });
    }
    if (this.palette.texture) {
      const { positions, elements, origins, data } = this.assets;
      this.raphael({
        projection: geo.projection,
        viewport: geo.dataport,
        colormap: this.palette.texture,
        index: this.palette.index,
        positions: positions,
        elements: elements,
        origins: origins,
        data: data,
      });
    }
    if (this.fontmap.texture) {
      if (ray) {
        const { positions, origins, spreads, count } = this.textEngine.getDrawbles(
          `EL ${ray.elevation}° / AZ ${ray.azimuth}°`,
          32,
          [100, 100]
        );
        this.annotation.points.subdata(positions);
        this.annotation.origins.subdata(origins);
        this.annotation.spreads.subdata(spreads);
        this.annotation.count = count;
      }
      // this.rect2({
      //   projection: geo.projection,
      //   viewport: geo.fontport,
      //   texture: this.fontmap.texture,
      // });
      this.gogh({
        ...this.annotation,
        projection: geo.screen,
        viewport: geo.viewport,
        scale: 1.0,
      });
    }
    // Finish up with the spline
    this.monet({
      primitive: "line loop",
      color: this.props.colors.spline,
      projection: geo.screen,
      viewport: geo.viewport,
      points: geo.spline,
      count: 4,
    });
    if (this.stats !== undefined) this.stats.update();
    this.tic++;
  }

  pan(x, y) {
    console.log(`pan ${x}, ${y}`);
    const geo = this.geometry;
    geo.offsetX += x * geo.v2dx;
    geo.offsetY += y * geo.v2dy;
    geo.needsUpdate = true;
  }

  taptap(x, y) {
    //this.fitToData();
  }

  magnify(mx, my, _d, _x, _y) {
    const geo = this.geometry;
    const scaleX = common.clamp(geo.scaleX * mx, 1 / 10000, 1 / 10);
    const scaleY = common.clamp(geo.scaleY * my, 1 / 70000, 1 / 10);
    geo.scaleX = scaleX;
    geo.scaleY = scaleY;
    geo.needsUpdate = true;
  }

  fitToData() {
    console.log("fitToData");
  }
}

export { ScopeB };
