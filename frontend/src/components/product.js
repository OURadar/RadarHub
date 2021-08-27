//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Texture } from "./texture";
import { GLView } from "./glview";
import { Overlay } from "./overlay";
import { mat4, vec3 } from "gl-matrix";

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
    this.graphics.satCoordinate[0] = this.getTimedLongitude();
  }

  getTimedLongitude() {
    return 0.0003 * (1630077685393 - new Date().getTime());
  }

  componentDidMount() {
    super.componentDidMount();
    setTimeout(() => {
      this.overlay.update();
    }, 500);
    // const createStatsWidget = require("regl-stats-widget");
    // var drawCalls = [
    //   [this.andy, "andy"],
    //   [this.hope, "hope"],
    //   [this.sphere, "sphere"],
    // ];
    // this.statsWidget = createStatsWidget(drawCalls);
  }

  draw() {
    if (this.mount === null) {
      return;
    }
    if (
      this.graphics.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    const graph = this.graphics;
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: graph.view,
      projection: graph.projection,
      viewport: graph.viewport,
    });
    this.monet({
      width: 5,
      color: [0.5, 0.5, 0.5, 0.7],
      model: graph.model,
      view: graph.view,
      projection: graph.projection,
      resolution: [this.canvas.width, this.canvas.height],
      viewport: graph.viewport,
      points: this.rings.points,
      segments: this.rings.count,
    });
    if (this.overlay.ready) {
      this.picaso({
        width: 1.8,
        color: [0.7, 0.5, 0.5, this.overlay.opacity],
        view: graph.view,
        projection: graph.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: graph.viewport,
        points: this.overlay.points,
        segments: this.overlay.count,
      });
      this.overlay.opacity =
        0.97 * this.overlay.opacity + 0.03 * this.overlay.targetOpacity;
    }

    if (!this.gesture.panInProgress) {
      graph.satCoordinate[0] =
        0.97 * graph.satCoordinate[0] + 0.03 * this.getTimedLongitude();
    }
    if (this.stats !== undefined) this.stats.update();
    // this.statsWidget.update(0.017);
  }
}

export { Product };
