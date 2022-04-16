//
//  overlay.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { Polygon } from "./polygon";
import { Text } from "./text";
import { clamp, deg } from "./common";
import { mat4, vec4 } from "gl-matrix";

//
// Manages overlays
//

class Overlay {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
    this.viewprojection = mat4.create();
    this.viewParameters = [
      1.0,
      geometry.origin.longitude,
      geometry.origin.latitude,
    ];
    this.targetOpacity = [];
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;

    this.polyEngine = new Polygon();
    this.textEngine = new Text();
    this.layers = [];
    this.cities = null;
    this.loaded = false;

    this.handleMessage = this.handleMessage.bind(this);

    // const url = new URL("./overlay.worker.js", import.meta.url);
    const url = "/static/frontend/opacity.js";
    this.worker = new Worker(url);
    this.worker.onmessage = this.handleMessage;
    this.workerReady = false;

    this.onload = () => {};

    this.tic = 0;
  }

  handleMessage({ data: { type, payload } }) {
    if (type == "opacity") {
      this.cities.targetOpacity = payload;
    } else if (type == "init") {
      if (payload == "ready") this.workerReady = true;
    }
  }

  async load() {
    const ratio = this.ratio > 1 ? 0.8 * this.ratio : this.ratio;

    // Overlays are grid, rings, highways, hi-res counties, lo-res counties, states, countries
    //
    // file: filename / built-in name
    // color: an array of [r, g, b, a]
    // limits: linewidth limits
    // weight: linewidth scaling weight
    // origin: depends on origin / filter by origin
    // fixed: fixed to color (else use surface normal in fragment shader)
    //
    const overlays = [
      {
        file: "@grid",
        color: this.colors.grid,
        limits: [1.0, 1.5 * ratio],
        weight: 0.4 * ratio,
        origin: false,
        fixed: true,
      },
      {
        file: "@rings/1/30/60/120",
        color: this.colors.ring,
        limits: [0.8, 2.0 * ratio],
        weight: 0.4 * ratio,
        origin: true,
        fixed: true,
      },
      {
        file: "/static/maps/United States/intrstat.shp",
        color: this.colors.street,
        limits: [0.5, 2.5 * ratio],
        weight: 0.4 * ratio,
        origin: true,
        fixed: false,
      },
      {
        file: "/static/maps/United States/gz_2010_us_050_00_500k.shp",
        color: this.colors.county,
        limits: [0.5, 2.0 * ratio],
        weight: 0.4 * ratio,
        origin: true,
        fixed: false,
      },
      {
        file: "/static/maps/United States/counties-10m.json",
        color: this.colors.county,
        limits: [0.5, 2.0 * ratio],
        weight: 0.4 * ratio,
        origin: false,
        fixed: false,
      },
      {
        file: "/static/maps/United States/states-10m.json",
        color: this.colors.state,
        limits: [1.3, 5.0 * ratio],
        weight: 0.9 * ratio,
        origin: false,
        fixed: false,
      },
      {
        file: "/static/maps/World/countries-50m.json",
        color: this.colors.state,
        limits: [1.3, 5.0 * ratio],
        weight: 1.7 * ratio,
        origin: false,
        fixed: false,
      },
    ];

    for (let k = 0; k < overlays.length; k++) {
      const overlay = overlays[k];
      if (this.layers[k] === undefined || overlay.origin) {
        const buffer = await this.polyEngine.load(overlay.file, this.geometry);
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
          opacity: k < 2 ? 1.0 : 0.0,
          targetOpacity: k < 2 ? 1.0 : 0.0,
          quad: [overlay.fixed, 0, this.colors.tint, 0],
        };
      }
      this.viewParameters[0] = 0;
      if (k == 2) {
        // load the labels after the rings and grid are loaded
        // this.loadDashboard();
        this.loadLabels();
      }
    }
    this.loaded = true;
    this.onload();
  }

  loadLabels() {
    this.textEngine
      .load(
        [
          // {
          //   name: "/static/maps/World/cities.shp",
          //   keys: {
          //     name: "CITY_NAME",
          //     weight: "POP_RANK",
          //     maximumWeight: 5,
          //   },
          // },
          {
            name: "/static/maps/World/cities.shp.json",
            keys: {
              name: "N",
              geometry: "G",
              properties: "P",
              coordinates: "C",
              weight: "W",
              maximumWeight: 5,
            },
          },
          // {
          //   name: "/static/maps/United States/citiesx020.shp",
          //   keys: {
          //     name: "NAME",
          //     population: "POP_2000",
          //     origin: this.geometry.origin,
          //     theta: Math.cos((3.0 / 180) * Math.PI),
          //   },
          // },
          {
            name: "/static/maps/United States/citiesx020.shp.json",
            keys: {
              name: "N",
              geometry: "G",
              properties: "P",
              coordinates: "C",
              population: "P",
              origin: this.geometry.origin,
              theta: Math.cos((3.0 / 180) * Math.PI),
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
        this.cities = {
          bound: [buffer.image.width, buffer.image.height],
          texture: this.regl.texture({
            height: buffer.image.height,
            width: buffer.image.width,
            data: buffer.image.data,
            min: "linear",
            mag: "linear",
            premultiplyAlpha: true,
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
          targetOpacity: new Float32Array(buffer.count).fill(0),
          opacity: new Float32Array(buffer.count).fill(0),
          count: buffer.count,
          scale: buffer.scale,
          raw: buffer,
        };
        this.viewParameters[0] = 0;
        if (this.worker) {
          this.worker.postMessage({
            type: "init",
            payload: {
              points: buffer.points,
              weights: buffer.weights,
              extents: buffer.extents,
            },
          });
        }
      });
  }

  updateColors(colors) {
    this.colors = colors;
    this.cities?.opacity.fill(0);
    // Overlays are grid, rings, highways, hi-res counties, lo-res counties, states, countries
    this.layers[0].color = colors.grid;
    this.layers[1].color = colors.ring;
    this.layers[2].color = colors.street;
    this.layers[3].color = colors.county;
    this.layers[4].color = colors.county;
    this.layers[5].color = colors.state;
    this.layers[6].color = colors.state;
    this.layers.forEach((layer) => {
      layer.quad[2] = colors.tint;
    });
    this.loadLabels();
  }

  getDrawables() {
    const [lon, lat] = deg.point2coord(...this.geometry.target.position);
    const viewParameters = [this.geometry.fov, lon, lat];

    if (
      this.tic++ % 12 == 0 &&
      (Math.abs(this.viewParameters[0] / viewParameters[0] - 1.0) > 0.05 ||
        Math.abs(this.viewParameters[1] - viewParameters[1]) > 0.5 ||
        Math.abs(this.viewParameters[2] - viewParameters[2]) > 0.5)
    ) {
      this.viewParameters = viewParameters;

      // Compute deviation from the origin
      const dx = viewParameters[1] - this.geometry.origin.longitude;
      const dy = viewParameters[2] - this.geometry.origin.latitude;
      const d = Math.sqrt(dx * dx + dy * dy);
      // console.log(`fov = ${this.geometry.fov.toFixed(3)}  d = ${d.toFixed(2)}`);

      // Overlays are grid, rings, highways, hi-res counties, lo-res counties, states, countries
      if (this.geometry.fov < 0.06 && d < 5) {
        this.targetOpacity = [0, 1, 1, 1, 0, 0, 0];
      } else if (this.geometry.fov < 0.42 && d < 10) {
        this.targetOpacity = [1, 1, 0, 0, 1, 1, 0];
      } else {
        this.targetOpacity = [1, 1, 0, 0, 0, 1, 1];
      }

      // const t1 = window.performance.now();
      if (this.cities) {
        if (this.worker)
          this.worker.postMessage({
            type: "revise",
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

    // Update the opacity
    if (!allSame) {
      this.layers.forEach((o, k) => {
        if (this.targetOpacity[k] == 0) {
          o.targetOpacity = 0;
        } else if (c < 4) {
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
        // quad: [mode, shader-user mix, shader color tint, opacity]
        //   zoom out fov > 0.63 --> 0 (shader)
        //    zoom in fov < 0.43 --> 1 (user)
        o.quad[1] = o.quad[0]
          ? 1.0
          : clamp(3.15 - 5.0 * this.geometry.fov, 0.0, 1.0);
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
    if (shapes.poly.length > 4) {
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

    if (this.cities) {
      for (let k = 0, l = this.cities.opacity.length; k < l; k++) {
        let o =
          this.cities.opacity[k] +
          (this.cities.targetOpacity[k] ? 0.05 : -0.05);
        if (o > 1.0) o = 1.0;
        this.cities.opacity[k] = o < 0.0 ? 0.0 : o;
      }

      shapes.text = {
        ...this.cities,
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
    for (let k = 0; k < this.cities.count; k++) {
      const point = [...this.cities.raw.points[k], 1.0];
      const spread = this.cities.raw.spreads[k];
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
    this.cities.targetOpacity = visibility;
    this.busy = false;
  }

  purge() {
    const layers = this.layers;
    const cities = this.cities;
    this.layers = [];
    this.cities = null;
    this.loaded = false;
    setTimeout(() => {
      layers.forEach((layer) => {
        if (layer.points) {
          layer.points.destroy();
        }
      });
      if (cities.texture) {
        cities.texture.destroy();
        cities.points.destroy();
        cities.origins.destroy();
        cities.spreads.destroy();
      }
    }, 250);
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
 *   1[0, 1]   |               |
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

export { Overlay };
