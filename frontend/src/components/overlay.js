//
//  overlay.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { Polygon } from "./polygon";
import { Text } from "./text";
import { clamp, deg2rad } from "./common";
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
    this.targetOpacity = [0, 0, 0, 0, 0, 0];

    this.polyEngine = new Polygon();
    this.updatingPolygons = 0;

    this.textEngine = new Text();
    this.updatingLabels = false;

    this.handleMessage = this.handleMessage.bind(this);

    const url = new URL("./overlay.worker.js", import.meta.url);
    this.worker = new Worker(url);
    this.worker.onmessage = this.handleMessage;
    this.workerReady = false;

    // this.worker.postMessage({
    //   type: "read",
    //   payload: "bitcoin",
    // });

    this.tic = 0;
  }

  handleMessage({ data: { type, payload } }) {
    if (type == "opacity") {
      this.texture.targetOpacity = payload;
    } else if (type == "init") {
      if (payload == "ready") this.workerReady = true;
    } else if (type == "read") {
      console.log(`read() ->`);
      console.log(payload);
    }
  }

  async load(colors) {
    if (this.updatingPolygons || this.updatingLabels) return;

    const overlays = [
      {
        file: "@rings/1/30/60/120",
        color: colors.ring,
        limits: [0.8, 2.0],
        weight: 0.4,
      },
      {
        file: "/static/maps/World/countries-50m.json",
        color: [0.5, 0.5, 0.5, 0.0],
        limits: [1.3, 3.0],
        weight: 1.7,
      },
      {
        file: "/static/maps/United States/states-10m.json",
        color: colors.state,
        limits: [1.3, 3.0],
        weight: 0.9,
      },
      {
        file: "/static/maps/United States/counties-10m.json",
        color: colors.county,
        limits: [0.5, 2.0],
        weight: 0.4,
      },
      {
        file: "/static/maps/United States/gz_2010_us_050_00_500k.shp",
        color: colors.county,
        limits: [0.5, 2.0],
        weight: 0.4,
      },
      {
        file: "/static/maps/United States/intrstat.shp",
        color: colors.highway,
        limits: [0.5, 2.0],
        weight: 0.4,
      },
    ];

    this.colors = colors;
    this.updatingPolygons = overlays.length;
    this.layers = [];
    overlays.forEach((overlay, k) => {
      setTimeout(() => {
        this.polyEngine.load(overlay.file, this.geometry).then((buffer) => {
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
          this.viewParameters[0] = 0;
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
      .load(
        [
          {
            name: "/static/maps/World/cities.shp.json",
            keys: {
              name: "CITY_NAME",
              weight: "POP_RANK",
              maximumWeight: 4,
            },
          },
          {
            name: "/static/maps/United States/citiesx020.shp.json",
            keys: {
              name: "NAME",
              population: "POP_2000",
              origin: this.geometry.origin,
            },
          },
          {
            name: "@rings/30/60/120",
            model: this.geometry.model,
          },
        ],
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
      (Math.abs(this.viewParameters[0] / viewParameters[0] - 1.0) > 0.1 ||
        Math.abs(this.viewParameters[1] - viewParameters[1]) > 0.01 ||
        Math.abs(this.viewParameters[2] - viewParameters[2]) > 0.01)
    ) {
      this.viewParameters = viewParameters;

      // Compute deviation from the USA
      // const dx = this.geometry.satCoordinate[0] + 1.745;
      // const dy = this.geometry.satCoordinate[1] - 0.698;
      const dx =
        this.geometry.satCoordinate[0] -
        deg2rad(this.geometry.origin.longitude);
      const dy =
        this.geometry.satCoordinate[1] - deg2rad(this.geometry.origin.latitude);
      const d = Math.sqrt(dx * dx + dy * dy);
      // console.log(`fov = ${this.geometry.fov.toFixed(3)}  d = ${d.toFixed(2)}`);
      // Overlays are rings, countries, states, counties, hi-res counties, highways
      if (this.geometry.fov < 0.06 && d < 0.1) {
        this.targetOpacity = [1, 0, 0, 0, 1, 1];
      } else if (this.geometry.fov < 0.42 && d < 0.3) {
        this.targetOpacity = [1, 0, 1, 1, 0, 0];
      } else {
        this.targetOpacity = [1, 1, 1, 0, 0, 0];
      }

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

    // Quickly go through all poly layers to count up visible layers
    let c = 0;
    let allSame = true;
    this.layers.forEach((o, k) => {
      allSame &= o.opacity == this.targetOpacity[k];
      c += o.opacity >= 0.05;
    });
    if (!allSame) {
      this.layers.forEach((o, k) => {
        if (this.targetOpacity[k] == 0) {
          o.targetOpacity = 0;
        } else if (c < 3) {
          if (o.targetOpacity == 0) c++;
          o.targetOpacity = 1;
        }
        o.opacity = clamp(o.opacity + (o.targetOpacity ? 0.05 : -0.05), 0, 1);
      });
    }

    let shapes = {
      poly: [],
      text: null,
    };
    this.layers.forEach((o) => {
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
    if (shapes.poly.length > 3) {
      console.log(`does not work shapes.poly.length = ${shapes.poly.length}`);
      console.log(
        `${this.layers[0].opacity.toFixed(2)}` +
          ` ${this.layers[1].opacity.toFixed(2)}` +
          ` ${this.layers[2].opacity.toFixed(2)}` +
          ` ${this.layers[3].opacity.toFixed(2)}` +
          ` ${this.layers[4].opacity.toFixed(2)}` +
          ` ${this.layers[5].opacity.toFixed(2)}`
      );
    }

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
