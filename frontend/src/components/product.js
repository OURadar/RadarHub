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
    //var t = this.offset + 0.0002 * window.performance.now();
    //var a = t % (2.0 * Math.PI);
    //console.log(`offset = ${this.offset}  t = ${t}  a = ${a.toFixed(3)}`);
    this.state = {
      ...this.state,
      spin: false,
      useEuler: true,
    };

    this.labelFaceColor = this.props.colors.label.face;
    this.sweepTime = 0;

    this.textures = {
      data: null,
      colormap: null,
      complete: false,
      needsUpdate: false,
    };

    // fetch("static/images/colormap.png", { cache: "no-cache" })
    //   .then((response) => response.blob())
    //   .then((blob) => {
    //     this.colormap = this.regl.texture({
    //       data: blob,
    //       min: "nearest",
    //       mag: "nearest",
    //       wrapS: "clamp",
    //       wrapT: "clamp",
    //     });
    //     console.log(this.colormap);
    //   });
    var image = new Image();
    image.src = "static/images/colormap.png";
    image.addEventListener("load", () => {
      // console.log("colormap loaded");
      this.textures.colormap = this.regl.texture(image);
      if (this.textures.data != null) this.textures.complete = true;
    });

    window.addEventListener("keyup", (e) => {
      if (e.key == "s") {
        this.toggleSpin();
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
      ];
      this.statsWidget = createStatsWidget(drawCalls);
    }
  }

  updateData() {
    if (this.props.sweep == null) {
      this.textures.complete = false;
      this.textures.data?.destroy();
      this.textures.data = null;
      this.sweepTime = 0;
      return;
    }
    // Could update this.geometry.origin
    this.textures.data = this.regl.texture({
      shape: [this.props.sweep.nr, this.props.sweep.na],
      data: this.props.sweep.values,
      format: "luminance",
    });
    this.sweepTime = this.props.sweep.time;
    if (this.textures.colormap) this.textures.complete = true;
    console.log("product.updateData()", this.textures.complete);
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
      (this.props.sweep === null && this.textures.data) ||
      (this.props.sweep !== null && this.sweepTime != this.props.sweep.time)
    ) {
      this.updateData();
    }
    this.regl.clear({
      color: this.props.colors.glview,
    });
    if (this.textures.complete)
      this.umbrella({
        modelview: this.geometry.modelview,
        projection: this.geometry.projection,
        viewport: this.geometry.viewport,
        colormap: this.textures.colormap,
        points: this.props.sweep.points,
        elements: this.props.sweep.indices,
        origins: this.props.sweep.origins,
        data: this.textures.data,
        index: 0.5 / 16,
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
