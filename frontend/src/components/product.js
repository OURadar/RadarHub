//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";
import * as common from "./common";
import { mat4, vec3, quat } from "gl-matrix";

import { GLView } from "./glview";
import { Overlay } from "./overlay";
// import { Colorbar } from "./colorbar-v1";
import { Colorbar } from "./colorbar";
import { Caption } from "./caption";
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
    // this.colorbar = new Colorbar(props.style);
    // this.geometry.dashport.y = 100;
    // this.geometry.dashport.width = this.colorbar.canvas.width;
    // this.geometry.dashport.height = this.colorbar.canvas.height;
    this.offset = (Date.now() % 86400000) / 5000;
    this.state = {
      ...this.state,
      spin: false,
      useEuler: true,
      ageString: "",
      titleString: "",
      palette: null,
      index: 0.5 / 6,
    };
    this.labelFaceColor = this.props.colors.label.face;
    this.assets = {
      age: 0,
      time: 0,
      symbol: "Z",
      colormap: null,
      style: null,
      data: null,
      points: null,
      origins: null,
      elements: null,
      complete: false,
      needsUpdate: false,
    };
    var image = new Image();
    image.src = "/static/images/colormap.png";
    image.addEventListener("load", () => {
      if (this.assets.colormap) {
        this.assets.colormap.destroy();
      }
      this.assets.colormap = this.regl.texture({
        data: image,
        wrapS: "clamp",
        wrapT: "clamp",
        premultiplyAlpha: true,
      });
      this.setState({
        palette: image,
        index: 0.5 / this.assets.colormap.height,
      });
      // this.assets.index = 0.5 / this.assets.colormap.height;
      if (this.assets.data != null) this.assets.complete = true;
      this.loadDashboard();
    });
    this.overlay.onload = props.onOverlayLoaded;
  }

  static defaultProps = {
    ...super.defaultProps,
    sweep: null,
    style: "right",
    origin: {
      longitude: -97.422413,
      latitude: 35.25527,
    },
    onOverlayLoaded: () => {},
  };

  makeStyle(symbol = "Z") {
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
      for (let v = -25; v < 81; v += 15) {
        let pos = v * 2.0 + 64.0;
        let text = v.toFixed(0);
        ticks.push({ pos: pos, text: text });
      }
      return {
        name: "Reflectivity (dBZ)",
        ticks: ticks,
        index: 0,
      };
    }
  }

  loadDashboard(sweep = null) {
    if (sweep && this.assets.symbol != sweep.symbol) {
      this.updateData();
    }
    this.assets.style = this.makeStyle(this.assets.symbol);
    if (this.assets.colormap) {
      // this.assets.index =
      //   (this.assets.style.index + 0.5) / this.assets.colormap.height;
      console.log(
        `state.index -> ${this.assets.style.index} / ${this.assets.symbol}`
      );
      this.setState({
        index: (this.assets.style.index + 0.5) / this.assets.colormap.height,
      });
    }
    // this.colorbar
    //   .load(
    //     {
    //       palette: this.assets.palette,
    //       style: this.assets.style,
    //       time: sweep ? sweep.timeString : "-",
    //     },
    //     this.props.colors
    //   )
    //   .then((buffer) => {
    //     this.dashboardTexture?.texture.destroy();
    //     this.dashboardTexture = {
    //       bound: [buffer.image.width, buffer.image.height],
    //       texture: this.regl.texture({
    //         height: buffer.image.height,
    //         width: buffer.image.width,
    //         data: buffer.image.data,
    //         min: "linear",
    //         mag: "linear",
    //         flipY: true,
    //         premultiplyAlpha: true,
    //       }),
    //     };
    //   });
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
    return (
      <div className="fullHeight">
        <div className="fullHeight" ref={(x) => (this.mount = x)} />
        <Colorbar
          {...this.props}
          palette={this.state.palette}
          index={this.state.index}
        />
        <Caption id="ageString" string={this.props.sweep?.age || ""} />
        <Caption id="infoString" string={this.props.sweep?.infoString || ""} />
        <Title string={this.props.sweep?.timeString || ""} />
      </div>
    );
  }

  updateData() {
    if (this.props.sweep == null) {
      this.assets.complete = false;
      this.assets.data?.destroy();
      this.assets.data = null;
      this.assets.points?.destroy();
      this.assets.points = null;
      this.assets.origins?.destroy();
      this.assets.origins = null;
      this.assets.elements?.destroy();
      this.assets.elements = null;
      this.assets.time = 0;
      this.assets.age = 0;
      return;
    }
    // Could update this.geometry.origin
    const geo = this.geometry;
    const sweep = this.props.sweep;
    if (
      Math.abs(geo.origin.longitude - sweep.longitude) > 0.001 ||
      Math.abs(geo.origin.latitude - sweep.latitude) > 0.001
    ) {
      let x0 = geo.origin.longitude.toFixed(6);
      let y0 = geo.origin.latitude.toFixed(6);
      let x1 = sweep.longitude.toFixed(6);
      let y1 = sweep.latitude.toFixed(6);
      console.log(
        `Product: origin (%c${x0}, ${y0}%c) ← (${x1}, ${y1})`,
        "color: mediumpurple",
        "color: inherit"
      );
      // Perhaps update geo.range to max range
      // const r = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
      // const d = Math.sqrt(1 + geo.aspect ** 2);
      // console.log(`r = ${r}   d = ${d}`);
      this.updateOrigin(sweep.longitude, sweep.latitude);
      this.overlay.purge();
      this.overlay.load();
    }

    this.assets.data = this.regl.texture({
      shape: [sweep.nr, sweep.nb],
      data: sweep.values,
      format: "luminance",
      type: "uint8",
    });
    this.assets.points = this.regl.buffer({
      usage: "static",
      type: "float",
      data: sweep.points,
    });
    this.assets.origins = this.regl.buffer({
      usage: "static",
      type: "float",
      data: sweep.origins,
    });
    this.assets.elements = this.regl.elements({
      usage: "static",
      type: "uint16",
      data: sweep.elements,
    });
    this.assets.time = sweep.time;
    this.assets.symbol = sweep.symbol;
    if (this.assets.colormap) {
      this.assets.complete = true;
    }
    if (this.props.debug) {
      console.log(
        `Product.updateData()` +
          `   assets.symbol = ${this.assets.symbol}` +
          `   assets.complete = ${this.assets.complete}`
      );
    }
    this.setState({
      titleString: sweep.timeString,
    });
  }

  draw() {
    if (this.mount === null) return;
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth * this.ratio ||
      this.canvas.height != this.mount.offsetHeight * this.ratio
    ) {
      this.updateProjection();
    }
    if (this.labelFaceColor != this.props.colors.label.face) {
      this.labelFaceColor = this.props.colors.label.face;
      this.overlay.updateColors(this.props.colors);
      this.loadDashboard();
    } else if (
      this.props.sweep !== null &&
      this.assets.symbol != this.props.sweep.symbol
    ) {
      this.loadDashboard(this.props.sweep);
    } else if (
      (this.props.sweep === null && this.assets.data !== null) ||
      (this.props.sweep !== null && this.assets.time != this.props.sweep.time)
    ) {
      this.updateData();
    }
    this.regl.clear({
      color: this.props.colors.glview,
    });
    if (this.assets.complete)
      this.vinci({
        projection: this.geometry.projection,
        modelview: this.geometry.modelview,
        viewport: this.geometry.viewport,
        colormap: this.assets.colormap,
        index: this.assets.index,
        data: this.assets.data,
        // points: this.props.sweep.points,
        // origins: this.props.sweep.origins,
        // elements: this.props.sweep.elements,
        points: this.assets.points,
        origins: this.assets.origins,
        elements: this.assets.elements,
      });
    const shapes = this.overlay.getDrawables();
    if (shapes.poly) this.picaso(shapes.poly);
    if (shapes.text) this.gogh(shapes.text);
    // if (this.dashboardTexture) {
    //   this.michelangelo({
    //     projection: this.geometry.orthoprojection,
    //     viewport: this.geometry.dashport,
    //     texture: this.dashboardTexture.texture,
    //   });
    // }
    if (this.state.spin && !this.gesture.panInProgress) {
      this.updateViewPoint();
    }
    this.statsWidget?.update(0.01667);
    this.stats?.update();
  }

  fitToData() {
    super.fitToData();
    this.setState({
      spin: false,
    });
  }

  taptap(x, y) {
    // console.log(
    //   `taptap: ${x} / ${0.8 * this.canvas.width} : ${y} / ${
    //     0.8 * this.canvas.width
    //   }`
    // );
    if (x > 0.8 * this.mount.clientWidth && y < 0.5 * this.mount.clientHeight) {
      return this.toggleSpin();
    } else {
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
