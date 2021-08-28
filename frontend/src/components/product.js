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
import { Polygon } from "./polygon";
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
    // this.overlay = new Polygon(this.regl, "/static/blob/countries-110m.json");
    this.overlay = new Polygon(
      this.regl,
      "/static/blob/shapefiles/World/ne_50m_admin_0_countries.shp"
    );
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
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: graph.view,
      projection: graph.projection,
      viewport: graph.viewport,
      color: [0.5, 0.5, 0.5, 0.85],
    });
    this.monet({
      width: 2,
      color: this.props.colors.lines[2],
      quad: [0, 0.7, 0, this.overlay.opacity],
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
        width: 1.7,
        color: this.props.colors.lines[3],
        quad: [0, 0.7, 0, this.overlay.opacity],
        view: graph.view,
        projection: graph.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: graph.viewport,
        points: this.overlay.points,
        segments: this.overlay.count,
      });
      this.overlay.opacity =
        0.95 * this.overlay.opacity + 0.05 * this.overlay.targetOpacity;
    }

    if (!this.gesture.panInProgress) {
      graph.satCoordinate[0] =
        0.95 * graph.satCoordinate[0] + 0.05 * this.getTimedLongitude();
    }
    if (this.stats !== undefined) this.stats.update();
    if (this.props.profileGL) this.statsWidget.update(0.0167);
  }

  fitToData() {
    const graph = this.graphics;
    graph.fov = Math.PI / 6;
    graph.satCoordinate = vec3.fromValues(
      this.getTimedLongitude(),
      (this.constants.origin.latitude / 180.0) * Math.PI,
      3 * this.constants.radius
    );
    graph.projectionNeedsUpdate = true;
    if (this.props.debugGL) {
      this.setState({
        lastMagnifyTime: new Date().getTime(),
      });
    }
  }
}

export { Product };
