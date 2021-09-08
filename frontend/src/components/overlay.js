//
//  overlay.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { Polygon } from "./polygon";
import { Text } from "./text";
import { clamp } from "./common";
import { mat4, vec4 } from "gl-matrix";

//
// Manages overlays on the earth
//

class Overlay {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
    this.viewprojection = mat4.create();
    this.viewParameters = [
      1.0,
      this.geometry.satCoordinate[0],
      this.geometry.satCoordinate[1],
    ];

    this.polyEngine = new Polygon();
    this.updatingPolygons = 0;

    this.textEngine = new Text();
    this.updatingLabels = false;

    this.handleMessage = this.handleMessage.bind(this);

    const url = new URL("./overlay.worker.js", import.meta.url);
    this.worker = new Worker(url);
    this.worker.onmessage = this.handleMessage;
    this.workerReady = false;

    this.tic = 0;
  }

  handleMessage({ data: { type, payload } }) {
    if (type == "opacity") {
      this.texture.targetOpacity = payload;
    } else if (type == "init") {
      if (payload == "ready") this.workerReady = true;
    }
  }

  async load(colors) {
    if (this.updatingPolygons || this.updatingLabels) return;

    const overlays = [
      {
        file: "@rings/1/60/120",
        color: colors.ring,
        limits: [1.5, 3.0],
        weight: 1.0,
      },
      {
        file: "/static/blob/countries-50m.json",
        color: [0.5, 0.5, 0.5, 0.0],
        limits: [1.3, 3.0],
        weight: 1.7,
      },
      {
        file: "/static/blob/states-10m.json",
        color: colors.state,
        limits: [1.3, 3.0],
        weight: 0.9,
      },
      {
        file: "/static/blob/counties-10m.json",
        color: colors.county,
        limits: [0.5, 2.0],
        weight: 0.4,
      },
    ];

    this.colors = colors;
    this.updatingPolygons = overlays.length;
    this.layers = [];
    overlays.forEach((overlay, k) => {
      setTimeout(() => {
        this.polyEngine
          .update(overlay.file, this.geometry.model)
          .then((buffer) => {
            this.layers[k] = {
              name: buffer.name,
              points: this.regl.buffer({
                usage: "static",
                type: "float",
                data: buffer.data,
              }),
              count: buffer.count,
              color: overlay.color,
              limits: overlay.limits,
              weight: overlay.weight,
              linewidth: 1.0,
              opacity: 0.0,
              targetOpacity: 0.0,
              quad: [0, this.colors.tint, 0, 0],
            };
            this.updatingPolygons--;
            if (this.updatingPolygons == 0) {
              this.updatingPolygons = false;
              this.updateLabels();
            }
          });
      }, 300 * k);
    });
    // const model = this.geometry.model;
    // for (let k = 0; k < overlays.length; k++) {
    //   const overlay = overlays[k];
    //   const buffer = await this.polyEngine.update(overlay.file, model);
    //   this.layers[k] = {
    //     name: buffer.name,
    //     points: this.regl.buffer({
    //       usage: "static",
    //       type: "float",
    //       data: buffer.data,
    //     }),
    //     count: buffer.count,
    //     color: overlay.color,
    //     limits: overlay.limits,
    //     weight: overlay.weight,
    //     linewidth: 1.0,
    //     opacity: 0.0,
    //   };
    // }
    // this.updatingPolygons = false;
    // this.updateLabels();
  }

  updateColors(colors) {
    this.colors = colors;
    this.layers[0].color = colors.ring;
    this.layers[2].color = colors.state;
    this.layers[3].color = colors.county;
    this.layers[0].quad[1] = colors.tint;
    this.layers[1].quad[1] = colors.tint;
    this.layers[2].quad[1] = colors.tint;
    this.layers[3].quad[1] = colors.tint;
    this.texture?.opacity.fill(0);
    this.updateLabels();
  }

  updateLabels() {
    this.updatingLabels = true;
    this.textEngine
      .update(
        ["/static/blob/shapefiles/World/cities.shp", "@rings/60/120"],
        this.geometry.model,
        this.colors
      )
      .then((buffer) => {
        this.texture = {
          bound: [buffer.canvas.width, buffer.canvas.height],
          scale: this.textEngine.scale,
          texture: this.regl.texture({
            data: buffer.canvas,
            min: "linear",
            mag: "linear",
          }),
          points: this.regl.buffer({
            usage: "static",
            type: "float",
            data: buffer.points,
          }),
          origins: this.regl.buffer({
            usage: "static",
            type: "float",
            data: buffer.origins,
          }),
          spreads: this.regl.buffer({
            usage: "static",
            type: "float",
            data: buffer.spreads,
          }),
          targetOpacity: Array(buffer.count).fill(0),
          opacity: Array(buffer.count).fill(0),
          count: buffer.count,
          raw: buffer,
        };
        this.updatingLabels = false;
        this.viewParameters[0] = 0;
        if (this.worker)
          this.worker.postMessage({
            type: "init",
            payload: {
              points: buffer.points,
              weights: buffer.weights,
              extents: buffer.extents,
            },
          });
      });
  }

  getDrawables() {
    const viewParameters = [
      this.geometry.fov,
      this.geometry.satCoordinate[0],
      this.geometry.satCoordinate[1],
    ];

    if (
      this.tic++ % 12 == 0 &&
      (Math.abs(this.viewParameters[0] - viewParameters[0]) > 0.02 ||
        Math.abs(this.viewParameters[1] - viewParameters[1]) > 0.02 ||
        Math.abs(this.viewParameters[2] - viewParameters[2]) > 0.02)
    ) {
      this.viewParameters = viewParameters;

      // Compute deviation from the USA
      const dx = this.geometry.satCoordinate[0] + 1.75;
      const dy = this.geometry.satCoordinate[1] - 0.72;
      const d = Math.sqrt(dx * dx + dy * dy);
      let t;
      if (this.geometry.fov < 0.43 && d < 0.25) {
        // Overlays are rings, countries, states, counties
        t = [1, 0, 1, 1];
      } else {
        t = [1, 1, 1, 0];
      }

      // Quickly go through all poly layers to count up visible layers
      let c = 0;
      this.layers.forEach((o) => (c += o.opacity > 0.05));
      this.layers.forEach((o, k) => {
        if (c < 3 || t[k] == 0) o.targetOpacity = t[k];
        else o.targetOpacity = 1.0;
      });

      // const t1 = window.performance.now();
      if (this.texture) {
        if (this.worker)
          this.worker.postMessage({
            type: "update",
            payload: this.geometry,
          });
        else this.reviseOpacityV1();
      }
      // const t0 = window.performance.now();
      // console.log(`${(t0 - t1).toFixed(2)} ms`);
    }

    let shapes = {
      poly: [],
      text: null,
    };
    this.layers.forEach((o, i) => {
      o.opacity = clamp(o.opacity + (o.targetOpacity ? 0.05 : -0.05), 0, 1);
      if (o.opacity >= 0.05) {
        o.linewidth = clamp(
          o.weight / Math.sqrt(this.geometry.fov),
          ...o.limits
        );
        // quad: [shader-user mix, shader color tint, unused, opacity]
        o.quad[0] = 1.0 * (o.color[3] > 0 && this.geometry.fov < 0.43);
        o.quad[3] = o.opacity;
        shapes.poly.push({
          points: o.points,
          segments: o.count,
          width: o.linewidth,
          color: o.color,
          quad: o.quad,
          view: this.geometry.view,
          projection: this.geometry.projection,
          viewport: this.geometry.viewport,
        });
      }
    });

    if (this.texture) {
      for (let k = 0, l = this.texture.opacity.length; k < l; k++) {
        let o =
          this.texture.opacity[k] +
          (this.texture.targetOpacity[k] ? 0.05 : -0.05);
        if (o > 1.0) o = 1.0;
        this.texture.opacity[k] = o < 0.0 ? 0.0 : o;
      }

      shapes.text = {
        ...this.texture,
        projection: this.geometry.viewprojection,
        viewport: this.geometry.viewport,
      };
    }

    return shapes;
  }

  async reviseOpacityV1() {
    this.busy = true;

    let rectangles = [];
    let visibility = [];
    let s = 1.0 / this.textEngine.scale;
    for (let k = 0; k < this.texture.count; k++) {
      const point = [...this.texture.raw.points[k], 1.0];
      const spread = this.texture.raw.spreads[k];
      const t = vec4.transformMat4([], point, this.geometry.viewprojection);
      const x = t[0] / t[3];
      const y = t[1] / t[3];
      const z = t[2] / t[3];
      if (z > 0.98 || x > 0.95 || x < -0.95 || y > 0.95 || y < -0.95) {
        visibility.push(0);
        rectangles.push([]);
      } else {
        visibility.push(1);
        const p = [
          x * this.geometry.viewport.width,
          y * this.geometry.viewport.height,
        ];
        const r = [
          p[0] - spread[0] * s,
          p[1] - spread[1] * s,
          p[0] + spread[0] * s,
          p[1] + spread[1] * s,
        ];
        rectangles.push(r);
      }
    }

    rectangles.forEach((d, k) => {
      if (k == 0 || visibility[k] == 0) return;
      let v = 1;
      for (let j = 0; j < k; j++) {
        if (visibility[j] && doOverlap(d, rectangles[j])) {
          v = 0;
          break;
        }
      }
      visibility[k] = v;
    });
    this.texture.targetOpacity = visibility;
    this.busy = false;
  }
}

/**
 * Determines if two retangles overlap
 *
 *                     1[2, 3]
 *      +---------------+
 *      |               |   2[2, 3]
 *      |      +--------+------+
 *      |      |        |      |
 *      +------+--------+      |
 *   1[0, 1]   |               |
 *             +---------------+
 *          2[0, 1]
 *
 * @param {Array4} rect1 the 1st rectangle
 * @param {Array4} rect2 the 2nd rectangle
 * @returns {boolean} out
 */
function doOverlap(rect1, rect2) {
  if (
    rect1[2] <= rect2[0] ||
    rect1[0] >= rect2[2] ||
    rect1[3] <= rect2[1] ||
    rect1[1] >= rect2[3]
  )
    return false;
  return true;
}

/**
 * Transforms the vec4 with a mat4.
 * Simplified version where w = 1.0 and z is not calculated
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec4} out
 */
function transformMat4(out, a, m) {
  let x = a[0],
    y = a[1],
    z = a[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = 0.0;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

export { Overlay };
