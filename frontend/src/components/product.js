//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import * as common from "./common";
import { GLView } from "./glview";
import { Overlay } from "./overlay";
import { Colorbar } from "./colorbar";
import { mat4, vec3, quat } from "gl-matrix";
//
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends GLView {
  constructor(props) {
    super(props);
    this.overlay = new Overlay(this.regl, props.colors, this.geometry);
    this.colorbar = new Colorbar();
    this.geometry.dashport.width = this.colorbar.canvas.width;
    this.geometry.dashport.height = this.colorbar.canvas.height;
    this.offset = (Date.now() % 86400000) / 5000;
    this.state = {
      ...this.state,
      spin: false,
      useEuler: true,
    };

    this.labelFaceColor = this.props.colors.label.face;
    this.assets = {
      time: 0,
      index: 0,
      symbol: null,
      palette: null,
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
      this.assets.palette = image;
      if (this.assets.colormap) {
        this.assets.colormap.destroy();
      }
      this.assets.colormap = this.regl.texture({
        data: image,
        wrapS: "clamp",
        wrapT: "clamp",
        premultiplyAlpha: true,
      });
      this.assets.index = 0.5 / this.assets.colormap.height;
      if (this.assets.data != null) this.assets.complete = true;
      this.loadDashboard();
    });

    this.overlay.onload = props.onOverlayLoaded;
  }

  static defaultProps = {
    ...super.defaultProps,
    sweep: null,
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
    let c = sweep.name.split("-");
    let symbol = c[4].split(".")[0];
    console.log(`symbol = ${symbol}`);
    if (symbol == this.assets.symbol) {
      return;
    }
    this.assets.style = this.makeStyle(symbol);
    this.assets.index =
      (this.assets.style.index + 0.5) / this.assets.colormap.height;
    this.colorbar
      .load(
        {
          palette: this.assets.palette,
          style: this.assets.style,
          time: sweep ? sweep.timeString : "-",
        },
        this.props.colors
      )
      .then((buffer) => {
        this.dashboardTexture = {
          bound: [buffer.image.width, buffer.image.height],
          texture: this.regl.texture({
            height: buffer.image.height,
            width: buffer.image.width,
            data: buffer.image.data,
            min: "linear",
            mag: "linear",
            flipY: true,
            premultiplyAlpha: true,
          }),
        };
      });
    this.assets.symbol = symbol;
  }

  toggleSpin() {
    this.setState((state) => {
      if (!state.spin) this.geometry.fov = 1.0;
      return { spin: !state.spin };
    });
  }

  updateViewPoint() {
    const t = this.offset + 0.0002 * window.performance.now();
    const a = t % (2.0 * Math.PI);
    // console.log(` = ${t.toFixed(3)}   a = ${a.toFixed(2)}`);
    if (this.state.useEuler) {
      this.geometry.satI = 0.92 * this.geometry.satI + 0.08 * Math.sin(a);
      this.geometry.satQ = 0.92 * this.geometry.satQ + 0.08 * Math.cos(a);
      this.geometry.satCoordinate[0] = Math.atan2(
        this.geometry.satQ,
        this.geometry.satI
      );
      this.geometry.message = "";
    } else {
      // Not fully tested
      const q = this.graphics.satQuaternion;
      const qt = quat.fromEuler(
        [],
        -this.graphics.satCoordinate[1],
        common.rad2deg(a),
        0.0
      );
      const i = quat.slerp([], q, qt, 0.5);
      this.graphics.satCoordinate[0] = -Math.atan2(i[1], i[3]) * 2.0;
      const b = this.geometry.satCoordinate[0];
      this.geometry.message = `angle = ${b.toFixed(1)}`;
    }
    this.geometry.fov += 0.001 * Math.cos(t);
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
      return;
    }
    // Could update this.geometry.origin
    const viewOrigin = this.geometry.origin;
    const origin = {
      longitude: this.props.sweep.longitude,
      latitude: this.props.sweep.latitude,
    };
    if (
      Math.abs(viewOrigin.longitude - origin.longitude) > 0.001 ||
      Math.abs(viewOrigin.latitude - origin.latitude) > 0.001
    ) {
      const satCoordinate = vec3.fromValues(
        common.deg2rad(origin.longitude),
        common.deg2rad(origin.latitude),
        2.0 * common.earthRadius
      );
      const satPosition = common.rad.coord2point(satCoordinate);
      console.log(`New lon/lat = ${origin.longitude}, ${origin.latitude}`);
      localStorage.setItem("glview-origin", JSON.stringify(origin));
      let model = mat4.create();
      model = mat4.rotateY([], model, common.deg2rad(origin.longitude));
      model = mat4.rotateX([], model, common.deg2rad(-origin.latitude));
      model = mat4.translate([], model, [0, 0, common.earthRadius]);
      this.geometry.origin = origin;
      this.geometry.satCoordinate = satCoordinate;
      this.geometry.satPosition = satPosition;
      this.geometry.satQuaternion = quat.fromEuler(
        [],
        -origin.latitude,
        origin.longitude,
        0
      );
      this.geometry.model = model;
      this.geometry.needsUpdate = true;
      this.overlay.purge();
      this.overlay.load();
    }

    this.assets.data = this.regl.texture({
      shape: [this.props.sweep.nr, this.props.sweep.na],
      data: this.props.sweep.values,
      format: "luminance",
      type: "uint8",
    });
    this.assets.points = this.regl.buffer({
      usage: "static",
      type: "float",
      data: this.props.sweep.points,
    });
    this.assets.origins = this.regl.buffer({
      usage: "static",
      type: "float",
      data: this.props.sweep.origins,
    });
    this.assets.elements = this.regl.elements({
      usage: "static",
      type: "uint16",
      data: this.props.sweep.elements,
    });
    this.assets.time = this.props.sweep.time;
    if (this.assets.colormap) this.assets.complete = true;
    if (this.props.debug)
      console.log("product.updateData()", this.assets.complete);
  }

  draw() {
    if (this.mount === null) return;
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    if (this.labelFaceColor != this.props.colors.label.face) {
      this.labelFaceColor = this.props.colors.label.face;
      this.overlay.updateColors(this.props.colors);
      this.loadDashboard();
    }
    if (
      (this.props.sweep === null && this.assets.data !== null) ||
      (this.props.sweep !== null &&
        (this.assets.time != this.props.sweep.time ||
          this.assets.symbol != this.props.sweep.symbol))
    ) {
      this.updateData();
      this.loadDashboard(this.props.sweep);
      console.log("loadDashboard()");
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
    if (this.dashboardTexture) {
      this.michelangelo({
        projection: this.geometry.orthoprojection,
        viewport: this.geometry.dashport,
        texture: this.dashboardTexture.texture,
      });
    }
    if (this.state.spin && !this.gesture.panInProgress) {
      this.updateViewPoint();
    }
    this.statsWidget?.update(0.01667);
    this.stats?.update();
  }

  fitToData() {
    const geo = this.geometry;
    if (this.props.sweep) {
      const sweep = this.props.sweep;
      const r = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
      const d = Math.sqrt(1 + geo.aspect ** 2);
      // console.log(`r = ${r}   d = ${d}`);
      geo.fov = (2.5 * r) / d / common.earthRadius;
    } else {
      geo.fov = 0.028;
    }
    geo.satCoordinate[0] = common.deg2rad(geo.origin.longitude);
    geo.satCoordinate[1] = common.deg2rad(geo.origin.latitude);
    geo.needsUpdate = true;
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
