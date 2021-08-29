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
    // let file = "/static/blob/counties-10m.json";
    // let file = "/static/blob/countries-50m.json";
    // let file = "/static/blob/countries-110m.json";
    // let file = "/static/blob/shapefiles/World/ne_50m_admin_0_countries.shp";
    this.overlay = [
      new Polygon(this.regl, "/static/blob/countries-50m.json"),
      new Polygon(this.regl, "/static/blob/states-10m.json"),
      new Polygon(this.regl, "/static/blob/counties-10m.json"),
    ];
    this.timeOrigin = 1630207559000 - Date.now();
    this.graphics.satCoordinate[0] = this.getTimedLongitude();
  }

  getTimedLongitude() {
    return 0.0002 * (this.timeOrigin - window.performance.now());
  }

  componentDidMount() {
    super.componentDidMount();
    setTimeout(() => {
      this.overlay.forEach((o) => o.update());
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
    this.picaso([
      {
        width: common.clamp(0.8 / graph.fov, 1.5, 4.5),
        color: this.props.colors.lines[3],
        quad: [...mtu, this.overlay[0].opacity],
        view: graph.view,
        projection: graph.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: graph.viewport,
        points: this.overlay[0].points,
        segments: this.overlay[0].count,
      },
      {
        width: common.clamp(0.6 / graph.fov, 1.5, 3.5),
        color: this.props.colors.lines[3],
        quad: [...mtu, this.overlay[1].opacity],
        view: graph.view,
        projection: graph.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: graph.viewport,
        points: this.overlay[1].points,
        segments: this.overlay[1].count,
      },
      {
        width: 1.0,
        color: this.props.colors.lines[3],
        quad: [...mtu, this.overlay[2].opacity],
        view: graph.view,
        projection: graph.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: graph.viewport,
        points: this.overlay[2].points,
        segments: this.overlay[2].count,
      },
    ]);
    this.overlay.forEach((o) => {
      if (o.ready) {
        o.opacity = 0.92 * o.opacity + 0.08 * o.targetOpacity;
      }
    });
    if (!this.gesture.panInProgress) {
      const x = this.getTimedLongitude();
      if (x - graph.satCoordinate[0] < -10) {
        graph.satCoordinate[0] = x;
        this.overlay.forEach((o) => {
          o.opacity = 0.0;
        });
      } else {
        graph.satCoordinate[0] = 0.92 * graph.satCoordinate[0] + 0.08 * x;
      }
    }
    if (this.stats !== undefined) this.stats.update();
    if (this.props.profileGL) this.statsWidget.update(0.0167);
  }

  fitToData() {
    const graph = this.graphics;
    graph.fov = Math.PI / 6;
    graph.satCoordinate[0] = this.getTimedLongitude();
    graph.satCoordinate[1] = (this.constants.origin.latitude / 180.0) * Math.PI;
    graph.projectionNeedsUpdate = true;
  }
}

export { Product };
