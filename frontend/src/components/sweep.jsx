//
//  sweep.jsx - Sweep View
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";
import * as common from "./common";
import { mat4, vec3, quat } from "gl-matrix";

import { GLView } from "./glview";
import { Overlay } from "./overlay";
import { Colorbar } from "./colorbar";
import { Caption } from "./caption";
import { Symbol } from "./symbol";
import { Title } from "./title";
//
// Use as <Sweep data={input} />
//
// More later ... I can't see pass here
//

const depth = 361;
const capacity = 512;

class Sweep extends GLView {
  constructor(props) {
    super(props);
    this.overlay = new Overlay(this.regl, props.colors, this.geometry);
    this.offset = (Date.now() % 86400000) / 5000;
    this.state = {
      ...this.state,
      count: 0,
      spin: false,
      useEuler: true,
      title: "-.-° / -.-°",
      info: "Gatewidth: -\nWaveform: -",
      age: "-",
    };
    this.palette = {
      image: null,
      texture: null,
      symbol: "U",
      index: 0,
    };
    this.labelFaceColor = this.props.colors.label.face;
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
    this.overlay.onLoad = props.onOverlayLoad;
    this.assetsComplete = false;
    this.assets = {};
    this.tic = 0;
    console.log(`I am a Sweep GL View`);
  }

  static defaultProps = {
    ...super.defaultProps,
    origin: {
      longitude: -97.422413,
      latitude: 35.25527,
    },
    onOverlayLoad: () => console.log("Sweep.onOverlayLoad()"),
    onColorbarClick: () => {},
    onMiddleViewTap: () => {},
  };

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

  toggleSpin() {
    this.setState((state) => {
      if (!state.spin) this.geometry.fov = 1.0;
      return { spin: !state.spin };
    });
  }

  clearTexture() {
    this.assets.data.subimage({
      width: capacity,
      height: depth,
      data: new Uint8Array(capacity * depth),
    });
    this.assets.row = 0;
    this.setState({ title: "-.-° / -.-°" });
  }

  updateViewPoint() {
    const geo = this.geometry;
    const t = this.offset + 0.0002 * window.performance.now();

    let c = quat.setAxisAngle([], [0, 1, 0], 0.005);
    let m = mat4.fromQuat([], c);

    mat4.multiply(geo.eye.model, m, geo.eye.model);
    mat4.multiply(geo.target.model, m, geo.target.model);

    let v = mat4.getTranslation([], geo.eye.model);

    let s = 1.8 * common.earthRadius + 2000 * (1 + Math.cos(t));
    let d = s - common.earthRadius;
    let b = d * geo.fov;

    vec3.scale(v, v, s / vec3.length(v));
    geo.eye.model[12] = v[0];
    geo.eye.model[13] = v[1];
    geo.eye.model[14] = v[2];
    vec3.set(geo.eye.scale, b, b, d);

    mat4.getTranslation(geo.eye.translation, geo.eye.model);
    mat4.getRotation(geo.eye.quaternion, geo.eye.model);

    mat4.getTranslation(geo.target.translation, geo.target.model);
    mat4.getRotation(geo.target.quaternion, geo.target.model);

    this.geometry.needsUpdate = true;
  }

  componentDidMount() {
    super.componentDidMount();
    this.overlay.load();
    if (this.props.profileGL) {
      const createStatsWidget = require("regl-stats-widget");
      const drawCalls = [
        [this.gogh, "text"],
        [this.picaso, "poly"],
        [this.umbrella, "data"],
      ];
      this.statsWidget = createStatsWidget(drawCalls);
    }
  }

  render() {
    return (
      <div className="fullHeight" ref={(x) => (this.mount = x)}>
        <Colorbar
          {...this.props}
          id="colorbar"
          style={this.style}
          palette={this.palette.image}
          onClick={this.props.onColorbarClick}
          count={this.state.count}
          debug={false}
        />
        <Symbol
          id="symbol"
          text={this.style.name}
          symbol={this.palette.symbol}
          anchor={this.props.gravity == "top" ? "start" : "end"}
          onClick={this.props.onColorbarClick}
        />
        <Title string={this.state.title} />
      </div>
    );
  }

  initAssets() {
    let x, y, z;
    let tics = [];
    let points = [];
    let origins = [];
    let elements = [];
    for (let k = 0; k < depth; k++) {
      tics.push(0.0, 0.0, 0.0, 0.0);
      let as = ((k % 360) * 32768) / 180;
      [x, y, z] = common.unitVectorFromElevationAzimuthInShort(1, as);
      points.push(10.0 * x, 10.0 * y, 10.0 * z);
      points.push(69.0 * x, 69.0 * y, 69.0 * z);
      let ae = (((k + 1) % 360) * 32768) / 180;
      [x, y, z] = common.unitVectorFromElevationAzimuthInShort(1, ae);
      points.push(10.0 * x, 10.0 * y, 10.0 * z);
      points.push(69.0 * x, 69.0 * y, 69.0 * z);
      let v = (k + 0.5) / depth;
      origins.push(0.0, v, 1.0, v);
      origins.push(0.0, v, 1.0, v);
      let o = k * 4 + 2;
      elements.push(o - 2, o - 1, o);
      elements.push(o - 1, o, o + 1);
    }

    this.assets = {
      data: this.regl.texture({
        shape: [capacity, depth],
        data: new Uint8Array(capacity * depth),
        format: "luminance",
        type: "uint8",
        wrap: "clamp",
        min: "nearest",
        mag: "nearest",
      }),
      tics: this.regl.buffer({
        usage: "dynamic",
        type: "float",
        data: tics,
      }),
      points: this.regl.buffer({
        usage: "dynamic",
        type: "float",
        data: points,
      }),
      origins: this.regl.buffer({
        usage: "static",
        type: "float",
        data: origins,
      }),
      elements: this.regl.elements({
        usage: "static",
        type: "uint16",
        data: elements,
      }),
      beam: this.regl.buffer({
        usage: "dynamic",
        type: "float",
        data: [0.0, 0.0, 0.0, 0.0, 10.0, 1.0],
      }),
      toc: 0.0,
      row: 0,
    };
    this.assetsComplete = true;
    if (this.props.debug) {
      console.log(
        `%cProduct.updateAssets()%c` +
          `   palette.symbol = ${this.palette.symbol}` +
          `   assetsComplete = ${this.assetsComplete}`,
        "color: lightseagreen",
        ""
      );
    }
  }

  draw() {
    if (this.mount === null) return;
    if (!this.assetsComplete) {
      this.initAssets();
    }
    // Update data buffer: dequeue the rays from FIFO, up to 6 rays
    let ray = null;
    for (let k = 0; k < 6 && this.palette && this.props.fifo.hasData(); k++) {
      ray = this.props.fifo.dequeue();
      if (ray.viewNeedsClear) {
        this.assets.data.subimage({
          width: capacity,
          height: depth,
          data: new Uint8Array(capacity * depth),
        });
      }
      this.assets.points.subdata(ray.points, this.assets.row * Float32Array.BYTES_PER_ELEMENT * 12);
      this.assets.data.subimage(
        {
          width: Math.min(capacity, ray.values.length),
          height: 1,
          data: ray.values,
        },
        0,
        this.assets.row
      );
      this.assets.tics.subdata(ray.tics, this.assets.row * Float32Array.BYTES_PER_ELEMENT * 4);
      this.assets.row = (this.assets.row + 1) % depth;
    }
    if (ray) {
      this.assets.beam.subdata([
        vec3.transformMat4([], ray.points.slice(6, 9), this.geometry.model),
        vec3.transformMat4([], ray.points.slice(9, 12), this.geometry.model),
      ]);
      this.assets.toc = ray.toc;
      this.setState({
        title: `EL ${ray.elevation}° / AZ ${ray.azimuth}°`,
      });
    }
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth * this.ratio ||
      this.canvas.height != this.mount.offsetHeight * this.ratio
    ) {
      this.updateProjection();
    } else if (this.labelFaceColor != this.props.colors.label.face) {
      this.labelFaceColor = this.props.colors.label.face;
      this.overlay.updateColors(this.props.colors);
      // this.updateColorbar(this.props.sweeps[0].symbol);
    }
    this.regl.clear({
      color: this.props.colors.glview,
    });
    const shapes = this.overlay.getDrawables();
    if (this.assetsComplete && this.palette.texture) {
      const { data, tics, points, origins, elements, beam, toc } = this.assets;
      // console.log(`Drawing ${this.assets.row} sweeps`);
      this.raphael({
        projection: this.geometry.projection,
        modelview: this.geometry.modelview,
        viewport: this.geometry.viewport,
        colormap: this.palette.texture,
        index: this.palette.index,
        toc: toc,
        tics: tics,
        data: data,
        points: points,
        origins: origins,
        elements: elements,
      });
      // console.log(beam);
      this.picaso({
        projection: this.geometry.projection,
        viewport: this.geometry.viewport,
        view: this.geometry.view,
        points: beam,
        segments: 1,
        width: 2.0 * this.ratio,
        color: [1.0, 1.0, 1.0, 1.0],
        quad: [1.0, 1.0, 1.0, 1.0],
        depth: false,
      });
    }
    // console.log(shapes.poly[0].points.slice(0, 6), shapes.poly[0].quad);
    if (shapes.poly) this.picaso(shapes.poly);
    if (shapes.text) this.gogh(shapes.text);
    if (this.state.spin && !this.gesture.panInProgress) {
      this.updateViewPoint();
    }
    this.statsWidget?.update(0.01667);
    this.stats?.update();
    this.tic++;
  }

  fitToData() {
    super.fitToData();
    this.setState({
      spin: false,
    });
  }

  tap(x, y) {
    if (
      x > 0.3 * this.mount.clientWidth &&
      x < 0.7 * this.mount.clientWidth &&
      y > 0.3 * this.mount.clientHeight &&
      y < 0.7 * this.mount.clientHeight
    ) {
      this.props.onMiddleViewTap();
    }
  }

  taptap(x, y) {
    // console.log(`taptap ${x} / ${this.mount.clientWidth} = ${x / this.mount.clientWidth}`);
    if (x > 0.8 * this.mount.clientWidth && y < 0.5 * this.mount.clientHeight) {
      return this.toggleSpin();
    } else if (x > 0.2 * this.mount.clientWidth && x < 0.7 * this.mount.clientWidth) {
      this.fitToData();
    }
  }
}

function rho2ind(value) {
  if (value > 0.93) return Math.round(value * 1000.0 - 824.0);
  if (value > 0.7) return Math.round(value * 300.0 - 173.0);
  return Math.round(value * 52.8751);
}

export { Sweep };
