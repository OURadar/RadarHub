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
    this.offset = Date.now();
    this.state = {
      ...this.state,
      spin: false,
      useEuler: true,
    };
    this.labelFaceColor = this.props.colors.label.face;
    window.addEventListener("keyup", (e) => {
      if (e.key == "s") {
        this.toggleSpin();
      }
    });
  }

  toggleSpin() {
    this.setState((state) => {
      return { spin: !state.spin };
    });
  }

  updateViewPoint() {
    let t = (0.0002 * (this.offset - window.performance.now())) % (2 * Math.PI);
    if (this.state.useEuler) {
      this.geometry.satI = 0.92 * this.geometry.satI + 0.08 * Math.cos(t);
      this.geometry.satQ = 0.92 * this.geometry.satQ + 0.08 * Math.sin(t);
      this.geometry.satCoordinate[0] = Math.atan2(
        this.geometry.satQ,
        this.geometry.satI
      );
      this.geometry.message = "";
    } else {
      const q = this.graphics.satQuaternion;
      const qt = quat.fromEuler(
        [],
        -common.rad2deg(this.graphics.satCoordinate[1]),
        common.rad2deg(t),
        0.0
      );
      const i = quat.slerp([], q, qt, 0.5);
      this.graphics.satCoordinate[0] = -Math.atan2(i[1], i[3]) * 2.0;
      const a = common.rad2deg(this.geometry.satCoordinate[0]);
      this.geometry.message = `angle = ${a.toFixed(1)}`;
    }
    this.geometry.needsUpdate = true;
  }

  componentDidMount() {
    super.componentDidMount();
    this.overlay.load(this.props.colors);
    if (this.props.profileGL) {
      const createStatsWidget = require("regl-stats-widget");
      const drawCalls = [
        [this.gogh, "gogh"],
        [this.picaso, "picaso"],
        [this.sphere, "sphere"],
      ];
      this.statsWidget = createStatsWidget(drawCalls);
    }
  }

  draw() {
    if (this.mount === null) return;
    let message = "";
    let show = false;
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
      message += " lines:";
      show = true;
    }
    if (this.labelFaceColor != this.props.colors.label.face) {
      this.labelFaceColor = this.props.colors.label.face;
      this.overlay.updateLabels(this.props.colors);
    }
    const gmatrix = this.geometry;
    // [shader-user mix, tint, unused]
    // const mtu = [, this.props.colors.tint, 0];
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: gmatrix.view,
      projection: gmatrix.projection,
      viewport: gmatrix.viewport,
      color: this.props.colors.grid,
    });
    const shapes = this.overlay.getDrawables();
    if (shapes.poly) this.picaso(shapes.poly);
    if (shapes.text) this.gogh(shapes.text);
    if (this.stats !== undefined) this.stats.update();
    if (this.props.profileGL) this.statsWidget.update(0.01667);
    if (this.state.spin && !this.gesture.panInProgress) {
      this.updateViewPoint();
    }
  }

  fitToData() {
    const geo = this.geometry;
    geo.fov = 200.0 / this.constants.radius;
    geo.satCoordinate[0] = common.deg2rad(this.constants.origin.longitude);
    geo.satCoordinate[1] = common.deg2rad(this.constants.origin.latitude);
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
    if (x > 0.8 * this.canvas.width && y < 0.2 * this.canvas.height) {
      return this.toggleSpin();
    } else {
      this.fitToData();
    }
  }
}

export { Product };
