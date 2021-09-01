import { Polygon } from "./polygon";
import { TextMap3D } from "./text-map-3d";
import { clamp } from "./common";

class Overlay {
  constructor(regl, colors) {
    this.regl = regl;
    this.colors = colors;
    this.layers = [
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
    this.textEngine = new TextMap3D(this.regl, true);
  }

  read() {
    this.layers.forEach((layer, k) => {
      setTimeout(() => {
        layer.polygon.update();
      }, k * 500);
    });
    let labels = [
      {
        text: "Label-1",
        coord: { lon: 0, lat: 0 },
        align: { u: 0, v: 0 },
        color: "blue",
      },
      {
        text: "Label-2",
        coord: { lon: -10, lat: 10 },
        align: { u: 0, v: 0 },
        color: "red",
      },
      {
        text: "Label-3",
        coord: { lon: -20, lat: 20 },
        align: { u: 0, v: 0 },
        color: this.colors.label.face,
      },
    ];
    this.textEngine.update(labels).then((texture) => (this.texture = texture));
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
