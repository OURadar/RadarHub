import { Polygon } from "./polygon";
import { TextEngine } from "./text-engine";
import { clamp, coord2point, polar2point } from "./common";
import { vec4, mat4 } from "gl-matrix";

function doOverlap(rect1, rect2) {
  //
  //                  1[2, 3]
  //     +---------------+
  //     |               |   2[2, 3]
  //     |      +--------+------+
  //     |      |        |      |
  //     +------+--------+      |
  //  1[0, 1]   |               |
  //            +---------------+
  //         2[0, 1]
  //
  if (
    rect1[2] <= rect2[0] ||
    rect1[0] >= rect2[2] ||
    rect1[3] <= rect2[1] ||
    rect1[1] >= rect2[3]
  )
    return false;
  return true;
}

class Overlay {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
    this.viewprojection = mat4.create();
    this.layers = [
      {
        polygon: new Polygon(this.regl, "@rings/1/60/120/250", geometry),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [2.0, 2.0],
        linewidth: 2.0,
        opacity: 0.0,
        weight: 1.0,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/countries-50m.json"),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.2, 3.0],
        linewidth: 1.0,
        opacity: 0.0,
        weight: 1.7,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/states-10m.json"),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.3, 3.0],
        linewidth: 1.0,
        opacity: 0.0,
        weight: 0.9,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/counties-10m.json"),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [0.5, 2.0],
        linewidth: 0.5,
        opacity: 0.0,
        weight: 0.4,
      },
    ];
    this.textEngine = new TextEngine(this.regl);
    this.updatingLabels = false;

    this.updatePolygons = this.updatePolygons.bind(this);
    this.updateLabels = this.updateLabels.bind(this);
  }

  updatePolygons(colors) {
    this.colors = colors;
    this.layers.forEach((layer, k) => {
      setTimeout(() => {
        layer.polygon.update();
      }, k * 500);
    });
    // Go through the layers and update the color from ${colors}
    // ...
  }

  updateLabels(colors) {
    if (this.updatingLabels) {
      return;
    }
    this.colors = colors;
    this.updatingLabels = true;
    // Points from (lat, lon) pairs
    this.labels = [
      {
        text: "LatLon-1",
        point: coord2point(-90, 20),
        color: this.colors.label.face,
        stroke: this.colors.label.stroke,
      },
      {
        text: "LatLon-2",
        point: coord2point(-100, 30),
        color: this.colors.label.face,
        stroke: this.colors.label.stroke,
      },
      {
        text: "LatLon-3",
        point: coord2point(-110, 40),
        color: this.colors.label.face,
        stroke: this.colors.label.stroke,
      },
    ];
    // Points radar-centric polar coordinate
    this.labels.push({
      text: "Origin",
      point: polar2point(0, 0, 0, this.geometry.model),
      color: this.colors.label.face,
      stroke: this.colors.label.stroke,
    });
    this.labels.push({
      text: "R-250 km",
      point: polar2point(0.5, 45, 250, this.geometry.model),
      color: this.colors.label.face,
      stroke: this.colors.label.stroke,
    });
    this.labels.push({
      text: "R-250 km",
      point: polar2point(0.5, -135, 250, this.geometry.model),
      color: this.colors.label.face2,
      stroke: this.colors.label.stroke,
    });
    this.textEngine.update(this.labels).then((texture) => {
      this.texture = texture;
      this.updatingLabels = false;
    });
  }

  getDrawables(fov) {
    let t;
    if (fov < 0.45) {
      t = [1, 0, 1, 1];
    } else {
      t = [1, 1, 1, 0];
    }
    let c = 0;
    this.layers.forEach((o) => (c += o.opacity > 0.05));
    this.layers.forEach((o, i) => {
      if (o.polygon.ready) {
        if (c < 3 || t[i] == 0) o.targetOpacity = t[i];
        o.opacity = clamp(o.opacity + (o.targetOpacity ? 0.05 : -0.05), 0, 1);
        o.linewidth = clamp(o.weight / Math.sqrt(fov), ...o.limits);
      }
    });
    return this.layers;
  }

  getText() {
    if (this.texture === undefined) {
      return;
    }
    if (!mat4.equals(this.viewprojection, this.geometry.viewprojection)) {
      this.viewprojection = this.geometry.viewprojection;

      const s = 2.0 / this.textEngine.scale;
      let rectangles = [];
      this.labels.forEach((label, k) => {
        const point = [...this.texture.raw.points[k], 1.0];
        const spread = this.texture.raw.spreads[k];
        const p = vec4.transformMat4([], point, this.viewprojection);
        const w = (spread[0] / this.geometry.viewport.width) * s * p[3];
        const h = (spread[1] / this.geometry.viewport.height) * s * p[3];
        rectangles.push([p[0], p[1], p[0] + w, p[1] + h]);
      });

      let visibility = [];
      rectangles.forEach((d, k) => {
        if (k == 0) return visibility.push(1);
        rectangles.slice(0, k).forEach((s, j) => {
          const o = doOverlap(s, d);
          if (visibility[j] && o) return visibility.push(0);
        });
        return visibility.push(1);
      });
    }
    return this.texture;
  }
}

export { Overlay };
