import { Polygon } from "./polygon";
import { TextEngine } from "./text-engine";
import { clamp, coord2point, polar2point } from "./common";

class Overlay {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
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
  }

  read() {
    this.layers.forEach((layer, k) => {
      setTimeout(() => {
        layer.polygon.update();
      }, k * 500);
    });
    // Points from (lat, lon) pairs
    let labels = [
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
    labels.push({
      text: "Origin",
      point: polar2point(0, 0, 0, this.geometry.model),
      color: this.colors.label.face,
      stroke: this.colors.label.stroke,
    });
    labels.push({
      text: "R-250 km",
      point: polar2point(0.5, 45, 250, this.geometry.model),
      color: this.colors.label.face,
      stroke: this.colors.label.stroke,
    });
    labels.push({
      text: "R-250 km",
      point: polar2point(0.5, -135, 250, this.geometry.model),
      color: "#66eeff",
      stroke: this.colors.label.stroke,
    });
    this.textEngine.update(labels).then((texture) => (this.texture = texture));
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
    // Compute visibility, ...
    return this.texture;
  }
}

export { Overlay };
