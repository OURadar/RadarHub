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
    this.state = { ...this.state, spin: false };
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
    this.geometry.satI = 0.92 * this.geometry.satI + 0.08 * Math.cos(t);
    this.geometry.satQ = 0.92 * this.geometry.satQ + 0.08 * Math.sin(t);
    this.geometry.satCoordinate[0] = Math.atan2(
      this.geometry.satQ,
      this.geometry.satI
    );
    this.geometry.needsUpdate = true;
    // let q = this.graphics.satQuaternion;
    // let qt = quat.fromEuler(
    //   [],
    //   -common.rad2deg(this.graphics.satCoordinate[1]),
    //   common.rad2deg(t),
    //   0.0
    // );
    // let i = quat.lerp([], q, qt, 0.5);
    // this.graphics.satCoordinate[0] = -Math.atan2(i[1], i[3]) * 2.0;
    // let a = common.rad2deg(this.graphics.satCoordinate[0]);
    // this.setState({
    //   message: `angle = ${a.toFixed(1)}`,
    // });
  }

  componentDidMount() {
    super.componentDidMount();
    this.overlay.read();
    if (this.props.profileGL) {
      const createStatsWidget = require("regl-stats-widget");
      const drawCalls = [
        [this.gogh, "gogh"],
        [this.monet, "monet"],
        [this.picaso, "picaso"],
        [this.sphere, "sphere"],
      ];
      this.statsWidget = createStatsWidget(drawCalls);
    }
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
    const gmatrix = this.geometry;
    // [shader-user mix, tint, unused]
    const mtu = [0, this.props.colors.tint, 0];
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: gmatrix.view,
      projection: gmatrix.projection,
      viewport: gmatrix.viewport,
      color: this.props.colors.grid,
    });
    const layers = this.overlay.getDrawables(gmatrix.fov);
    let message = "linewidths: ";
    let o = [];
    layers.forEach((overlay) => {
      if (overlay.opacity > 0.05) {
        o.push({
          width: overlay.linewidth,
          color: overlay.color,
          quad: [...mtu, overlay.opacity],
          view: gmatrix.view,
          projection: gmatrix.projection,
          resolution: [this.canvas.width, this.canvas.height],
          viewport: gmatrix.viewport,
          points: overlay.polygon.points,
          segments: overlay.polygon.count,
        });
        message += ` ${overlay.linewidth.toFixed(2)}`;
      }
    });
    // this.setState({
    //   message: message,
    // });
    this.picaso(o);
    if (this.state.spin && !this.gesture.panInProgress) {
      this.updateViewPoint();
    }
    let text = this.overlay.getText();
    if (text) {
      this.gogh({
        projection: gmatrix.viewprojection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: gmatrix.viewport,
        scale: 1.5,
        ...text,
      });
    }
    if (this.stats !== undefined) this.stats.update();
    if (this.props.profileGL) this.statsWidget.update(0.01667);
  }

  fitToData() {
    const geo = this.geometry;
    geo.fov = 200.0 / this.constants.radius;
    geo.satCoordinate[0] = common.deg2rad(this.constants.origin.longitude);
    geo.satCoordinate[1] = common.deg2rad(this.constants.origin.latitude);
    geo.needsUpdate = true;
  }
}

export { Product };
