//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import * as common from "./common";
import { GLView } from "./glview";
import { Overlay } from "./overlay";

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
    };

    this.labelFaceColor = this.props.colors.label.face;

    this.assets = {
      time: 0,
      index: 0,
      colormap: null,
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
      this.assets.colormap = this.regl.texture({
        data: image,
        flipY: true,
        wrapS: "clamp",
        wrapT: "clamp",
        premultiplyAlpha: true,
      });
      this.assets.index = 0.5 / this.assets.colormap.height;
      if (this.assets.data != null) this.assets.complete = true;
    });

    window.addEventListener("keyup", (e) => {
      if (e.key == "s") {
        this.toggleSpin();
      } else if (e.key == "c") {
        const h = this.assets.colormap.height;
        const m = h - 1;
        this.assets.index =
          this.assets.index > m / h ? 0.5 / h : this.assets.index + 1.0 / h;
        console.log(`this.textures.index = ${this.assets.index}`);
      }
    });
  }

  static defaultProps = {
    ...super.defaultProps,
    sweep: null,
  };

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
    this.overlay.load(this.props.colors);
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
      data: this.props.sweep.elements,
    });
    console.log(this.assets);
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
    }
    if (
      (this.props.sweep === null && this.assets.data !== null) ||
      (this.props.sweep !== null && this.assets.time != this.props.sweep.time)
    ) {
      this.updateData();
    }
    this.regl.clear({
      color: this.props.colors.glview,
    });
    if (this.assets.complete)
      this.umbrella({
        modelview: this.geometry.modelview,
        projection: this.geometry.projection,
        viewport: this.geometry.viewport,
        colormap: this.assets.colormap,
        data: this.assets.data,
        index: this.assets.index,
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

export { Product };
