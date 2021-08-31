import { Polygon } from "./polygon";
import { clamp } from "./common";

class Overlay {
  constructor(regl) {
    this.regl = regl;
    this.layers = [
      {
        polygon: new Polygon(this.regl, "/static/blob/countries-50m.json"),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.5, 4.0],
        linewidth: 1.0,
        opacity: 0.0,
        weight: 1.5,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/states-10m.json"),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.3, 2.5],
        linewidth: 1.0,
        opacity: 0.0,
        weight: 0.5,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/counties-10m.json"),
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [0.5, 1.5],
        linewidth: 0.5,
        opacity: 0.0,
        weight: 0.2,
      },
    ];
  }

  read() {
    this.layers.forEach((layer, k) => {
      setTimeout(() => {
        layer.polygon.update();
      }, k * 500);
    });
  }

  getDrawables(fov) {
    let t;
    if (fov < 0.45) {
      t = [0, 1, 1];
    } else {
      t = [1, 1, 0];
    }
    let c = 0;
    this.layers.forEach((o) => (c += o.opacity > 0.05));
    this.layers.forEach((o, i) => {
      if (o.polygon.ready) {
        if (c < 2 || t[i] == 0) o.targetOpacity = t[i];
        o.opacity = clamp(o.opacity + (o.targetOpacity ? 0.05 : -0.05), 0, 1);
        o.linewidth = clamp(o.weight / fov, ...o.limits);
      }
    });
    return this.layers;
  }
}

export { Overlay };
