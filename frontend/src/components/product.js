//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import * as common from "./common";
import { Texture } from "./texture";
import { GLView } from "./glview";
import { Overlay } from "./overlay";
import { quat } from "gl-matrix";

//
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends GLView {
  constructor(props) {
    super(props);
    this.texture = new Texture(
      this.regl,
      this.props.textureScale,
      props.debugGL
    );
    this.overlay = new Overlay(this.regl);
    this.now = 1630207559000 - Date.now();
    this.state = { ...this.state, spin: true };
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
    let t = (0.0002 * (this.now - window.performance.now())) % (2 * Math.PI);
    this.graphics.satI = 0.92 * this.graphics.satI + 0.08 * Math.cos(t);
    this.graphics.satQ = 0.92 * this.graphics.satQ + 0.08 * Math.sin(t);
    this.graphics.satCoordinate[0] = Math.atan2(
      this.graphics.satQ,
      this.graphics.satI
    );
    this.graphics.projectionNeedsUpdate = true;
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
      var drawCalls = [
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
      this.graphics.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    const graph = this.graphics;
    // [shader-user mix, tint, unused]
    const mtu = [0, this.props.colors.tint, 0];
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: graph.view,
      projection: graph.projection,
      viewport: graph.viewport,
      color: this.props.colors.grid,
    });
    this.monet({
      width: 2,
      color: this.props.colors.lines[2],
      quad: [...mtu, 1.0],
      model: graph.model,
      view: graph.view,
      projection: graph.projection,
      resolution: [this.canvas.width, this.canvas.height],
      viewport: graph.viewport,
      points: this.rings.points,
      segments: this.rings.count,
    });
    let o = [];
    let layers = this.overlay.getDrawables(graph.fov);
    layers.forEach((overlay) => {
      if (overlay.opacity > 0.05) {
        o.push({
          width: overlay.linewidth,
          color: this.props.colors.lines[3],
          quad: [...mtu, overlay.opacity],
          view: graph.view,
          projection: graph.projection,
          resolution: [this.canvas.width, this.canvas.height],
          viewport: graph.viewport,
          points: overlay.polygon.points,
          segments: overlay.polygon.count,
        });
      }
    });
    this.picaso(o);
    if (this.state.spin && !this.gesture.panInProgress) {
      this.updateViewPoint();
    }
    if (this.stats !== undefined) this.stats.update();
    if (this.props.profileGL) this.statsWidget.update(0.01667);
  }

  fitToData() {
    const graph = this.graphics;
    graph.fov = 200.0 / this.constants.radius;
    graph.satCoordinate[0] = common.deg2rad(this.constants.origin.longitude);
    graph.satCoordinate[1] = common.deg2rad(this.constants.origin.latitude);
    graph.projectionNeedsUpdate = true;
  }
}

export { Product };
