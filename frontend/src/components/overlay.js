import { Polygon } from "./polygon";
import { clamp } from "./common";

class Overlay {
  constructor(regl) {
    this.regl = regl;
    this.layers = [
      {
        polygon: new Polygon(this.regl, "/static/blob/countries-50m.json"),
        color: [],
        weight: 1.5,
        limits: [1.5, 4.5],
        linewidth: 1.0,
        opacity: 0.0,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/states-10m.json"),
        color: [],
        weight: 1.0,
        limits: [1.3, 3.5],
        linewidth: 1.0,
        opacity: 0.0,
      },
      {
        polygon: new Polygon(this.regl, "/static/blob/counties-10m.json"),
        color: [],
        limits: [1.0, 1.5],
        linewidth: 1.0,
        opacity: 0.0,
        weight: 0.6,
      },
    ];
  }

  read() {
    setTimeout(() => {
      this.layers.forEach((layer) => layer.polygon.update());
    }, 500);
  }

  getDrawables(fov) {
    let t;
    if (fov < 0.25) {
      t = [0, 1, 1];
    } else {
      t = [1, 1, 0];
    }
    let c = 0;
    this.layers.forEach((o) => (c += o.opacity > 0.05));
    this.layers.forEach((o, i) => {
      if (o.polygon.ready) {
        if (c < 2 || t[i] == 0) o.targetOpacity = t[i];
        o.opacity = 0.92 * o.opacity + 0.08 * o.targetOpacity;
        o.linewidth = clamp(o.weight / fov, ...o.limits);
      }
    });
    return this.layers;
  }
}

export { Overlay };
