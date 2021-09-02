import { Polygon } from "./polygon";
import { TextEngine } from "./text-engine";
import { clamp, deg2rad } from "./common";
import { vec3 } from "gl-matrix";

function coord2point(lon, lat) {
  const r = 6358.0;
  const rlon = deg2rad(lon);
  const rlat = deg2rad(lat);
  const clat = Math.cos(rlat);
  const slat = Math.sin(rlat);
  const clon = Math.cos(rlon);
  const slon = Math.sin(rlon);
  return [r * clat * slon, r * slat, r * clat * clon];
}

function polar2point(e, a, r, model) {
  const re = deg2rad(e);
  const ra = deg2rad(a);
  const ce = Math.cos(re);
  const se = Math.sin(re);
  const ca = Math.cos(ra);
  const sa = Math.sin(ra);
  const p = [r * ce * sa, r * ce * ca, r * se];
  const q = vec3.transformMat4([], p, model);
  return q;
}

class Overlay {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
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
