//
//  product.js - Product View
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
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends GLView {
  constructor(props) {
    super(props);
    this.overlay = new Overlay(this.regl, props.colors, this.geometry);
    this.offset = (Date.now() % 86400000) / 5000;
    this.state = {
      ...this.state,
      spin: false,
      useEuler: true,
      phase: 0,
      count: 0,
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
    this.assets = [];
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
      this.loadStyle("Z");
    });

    this.overlay.onLoad = props.onOverlayLoad;
    this.assetsComplete = false;
    this.tic = 0;
  }

  static defaultProps = {
    ...super.defaultProps,
    sweeps: [],
    origin: {
      longitude: -97.422413,
      latitude: 35.25527,
    },
    gravity: "right",
    onOverlayLoad: () => console.log("Product.onOverlayLoad()"),
    onColorbarTouch: () => {},
    onColorbarClick: () => {},
    onMiddleViewTap: () => {},
  };

  loadStyle(symbol = "Z") {
    const symbolToStyle = (symbol) => {
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
      } else if (symbol == "V") {
        // slim = (-64, +64.0)
        // sticklabels = np.arange(-60, 61, 15)
        // sticks = sticklabels * 128.0 / 64.0 + 128.0
        for (let v = -60; v < 61; v += 15) {
          let pos = v * 2.0 + 128.0;
          let text = v.toFixed(0);
          ticks.push({ pos: pos, text: text });
        }
        return {
          name: "Velocity (m/s)",
          ticks: ticks,
          index: 1,
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
    };
    this.style = symbolToStyle(symbol);
    console.log("symbolToSTyle ->", this.style);
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
    const sweep = this.props.sweeps.length ? this.props.sweeps[this.state.phase] : null;
    return (
      <div className="fullHeight">
        <div className="fullHeight" ref={(x) => (this.mount = x)} />
        <Colorbar
          {...this.props}
          id="colorbar"
          style={this.style}
          palette={this.palette.image}
          onTouch={this.props.onColorbarTouch}
          onClick={this.props.onColorbarClick}
          count={this.state.count}
          debug={false}
        />
        <Caption id="ageString" phase={this.state.phase} string={sweep?.age || ""} />
        <Caption id="infoString" phase={this.state.phase} string={sweep?.infoString || "Gatewidth: -\nWaveform: -"} />
        <Symbol
          id="symbol"
          text={this.style.name}
          symbol={this.palette.symbol}
          onTouch={this.props.onColorbarTouch}
          onClick={this.props.onColorbarClick}
        />
        <Title string={sweep?.titleString || "----/--/-- --:--:-- UTC"} />
      </div>
    );
  }

  updateAssets() {
    if (this.props.sweeps.length == 0) {
      return;
    }

    this.assetsComplete = false;
    this.assets.forEach((x) => {
      x.data?.destroy();
      x.points?.destroy();
      x.origins?.destroy();
      x.elements?.destroy();
    });
    this.assets = [];

    // Could update this.geometry.origin
    const geo = this.geometry;
    const sweep = this.props.sweeps[0];
    if (
      Math.abs(geo.origin.longitude - sweep.longitude) > 0.001 ||
      Math.abs(geo.origin.latitude - sweep.latitude) > 0.001
    ) {
      let x0 = geo.origin.longitude.toFixed(6);
      let y0 = geo.origin.latitude.toFixed(6);
      let x1 = sweep.longitude.toFixed(6);
      let y1 = sweep.latitude.toFixed(6);
      console.log(`Product: origin (%c${x0}, ${y0}%c) ← (${x1}, ${y1})`, "color: mediumpurple", "color: inherit");
      // Perhaps update geo.range to max range
      // const r = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
      // const d = Math.sqrt(1 + geo.aspect ** 2);
      // console.log(`r = ${r}   d = ${d}`);
      this.updateOrigin(sweep.longitude, sweep.latitude);
      this.overlay.purge();
      this.overlay.load();
    }

    this.assets = this.props.sweeps.map((sweep) => ({
      time: sweep.time,
      data: this.regl.texture({
        shape: [sweep.nr, sweep.nb],
        data: sweep.values,
        format: "luminance",
        type: "uint8",
      }),
      points: this.regl.buffer({
        usage: "static",
        type: "float",
        data: sweep.points,
      }),
      origins: this.regl.buffer({
        usage: "static",
        type: "float",
        data: sweep.origins,
      }),
      elements: this.regl.elements({
        usage: "static",
        type: "uint16",
        data: sweep.elements,
      }),
    }));
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
    if (
      this.props.sweeps.length != this.assets.length ||
      (this.props.sweeps.length > 0 && this.assets.length > 0 && this.props.sweeps[0].time != this.assets[0].time)
    ) {
      this.updateAssets();
    } else if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth * this.ratio ||
      this.canvas.height != this.mount.offsetHeight * this.ratio
    ) {
      this.updateProjection();
    } else if (this.labelFaceColor != this.props.colors.label.face) {
      this.labelFaceColor = this.props.colors.label.face;
      this.overlay.updateColors(this.props.colors);
    } else if (this.props.sweeps.length > 0 && this.palette.symbol != this.props.sweeps[0].symbol) {
      this.loadStyle(this.props.sweeps[0].symbol);
      this.updateAssets();
    }
    this.regl.clear({
      color: this.props.colors.glview,
    });
    if (this.assetsComplete) {
      const phase = Math.min(this.props.sweeps.length - 1, ((this.tic / 8) >> 0) % (this.props.sweeps.length + 4));
      if (this.state.phase != phase) {
        this.setState({ phase: phase });
      }
      const { data, points, origins, elements } = this.assets[phase];
      this.vinci({
        projection: this.geometry.projection,
        modelview: this.geometry.modelview,
        viewport: this.geometry.viewport,
        colormap: this.palette.texture,
        index: this.palette.index,
        data: data,
        points: points,
        origins: origins,
        elements: elements,
      });
    }
    const shapes = this.overlay.getDrawables();
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

export { Product };
