//
//  overlay.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { Polygon } from "./polygon";
import { TextEngine } from "./text-engine";
import { clamp } from "./common";
import { vec4, mat4 } from "gl-matrix";

//
// Manages overlays on the earth
//

class Overlay {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
    this.viewprojection = mat4.create();

    this.polyEngine = new Polygon(this.regl);
    this.updatingPolygons = 0;

    this.textEngine = new TextEngine(this.regl);
    this.updatingLabels = false;
  }

  load(colors) {
    if (this.updatingPolygons || this.updatingLabels) return;
    const overlays = [
      {
        name: "@rings/1/60/120/250",
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.5, 3.0],
        weight: 1.0,
      },
      {
        name: "/static/blob/countries-50m.json",
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.3, 3.0],
        weight: 1.7,
      },
      {
        name: "/static/blob/states-10m.json",
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [1.3, 3.0],
        weight: 0.9,
      },
      {
        name: "/static/blob/counties-10m.json",
        color: [0.5, 0.5, 0.5, 1.0],
        limits: [0.5, 2.0],
        weight: 0.4,
      },
    ];

    this.colors = colors;
    this.updatingPolygons = overlays.length;
    this.layers = [];
    overlays.forEach((overlay, k) => {
      setTimeout(() => {
        this.polyEngine.update(overlay.name, this.geometry).then((buffer) => {
          this.layers[k] = {
            ...buffer,
            color: overlay.color,
            linewidth: 1.0,
            opacity: 0.0,
            limits: overlay.limits,
            weight: overlay.weight,
          };
          this.updatingPolygons--;
          if (this.updatingPolygons == 0) {
            this.updatingPolygons = false;
            this.updateLabels();
          }
        });
      }, 300 * k);
    });
    // Go through the layers and update the color from ${colors}
    // ...
  }

  updateLabels() {
    this.updatingLabels = true;

    // Now we use the text engine
    this.textEngine
      .update("@demo", this.geometry.model, this.colors)
      .then((texture) => {
        this.texture = {
          ...texture,
          targetOpacity: Array(texture.count).fill(0),
          opacity: Array(texture.count).fill(0),
        };
        this.viewprojection = mat4.create();
        this.updatingLabels = false;
      });
  }

  getDrawables(fov) {
    if (this.layers === undefined) return;

    let t;
    if (fov < 0.45) {
      t = [1, 0, 1, 1];
    } else {
      t = [1, 1, 1, 0];
    }

    let c = 0;
    this.layers.forEach((o) => (c += o.opacity > 0.05));

    this.layers.forEach((o, i) => {
      let targetOpacity = 1.0;
      if (c < 3 || t[i] == 0) targetOpacity = t[i];
      o.opacity = clamp(o.opacity + (targetOpacity ? 0.05 : -0.05), 0, 1);
      o.linewidth = clamp(o.weight / Math.sqrt(fov), ...o.limits);
    });

    return this.layers;
  }

  getText() {
    if (this.texture === undefined) return;

    if (!mat4.equals(this.viewprojection, this.geometry.viewprojection)) {
      this.viewprojection = this.geometry.viewprojection;

      let rectangles = [];
      let visibility = [];
      let s = 2.0 / this.textEngine.scale;
      for (let k = 0; k < this.texture.count; k++) {
        const point = [...this.texture.raw.points[k], 1.0];
        const spread = this.texture.raw.spreads[k];
        const t = vec4.transformMat4([], point, this.viewprojection);
        const p = [
          (t[0] / t[3]) * this.geometry.viewport.width,
          (t[1] / t[3]) * this.geometry.viewport.height,
        ];
        const r = [p[0], p[1], p[0] + spread[0] * s, p[1] + spread[1] * s];
        rectangles.push(r);
        //if (k == 3) console.log(this.labels[k].text, t[2] / t[3]);
        if (t[2] / t[3] > 0.984) {
          visibility.push(0);
        } else {
          visibility.push(1);
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
        return (visibility[k] = v);
      });

      this.texture.targetOpacity = visibility;
      // const rect1 = rectangles[3],
      //   rect2 = rectangles[5];
      // console.log(
      //   rect1.map((x) => x.toFixed(1)),
      //   rect2.map((x) => x.toFixed(1)),
      //   rect1[2] <= rect2[0],
      //   rect1[0] >= rect2[2],
      //   rect1[3] <= rect2[1],
      //   rect1[1] >= rect2[3]
      // );
    }

    const tex = this.texture;
    tex.targetOpacity.forEach((t, k) => {
      tex.opacity[k] = clamp(tex.opacity[k] + (t ? 0.05 : -0.05), 0, 1);
    });
    // console.log(tex.opacity);

    return this.texture;
  }
}

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
