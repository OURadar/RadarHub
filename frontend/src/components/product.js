//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { mat4, mat3, vec3 } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Texture } from "./texture";
import { GLView } from "./glview";

//
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends GLView {
  constructor(props) {
    super(props);
    this.constants = {
      rings: common.tickChoices(1, 150),
      bounds: {
        top: 10,
        right: 0,
        bottom: 0,
        left: 0,
      },
    };
    this.state = {
      ...this.state,
      scale: 1 / 2,
      fov: Math.PI / 4,
      satCoordinate: vec3.fromValues(0, 0, 35), // lon, lat, alt
      satPosition: vec3.create(),
      modelview: mat4.create(),
      labelParameters: {
        labels: [],
        positions: [],
        alignments: [],
        foreground: props.colors.foreground,
        colors: [],
        sizes: [],
        countX: 0,
        countY: 0,
      },
    };
    // Our artists
    this.picaso = instanced.noninterleavedStripRoundCapJoin(this.regl, 8);
    this.gogh = artists.sprite(this.regl);
    this.art = artists.basic3(this.regl);
    this.water = artists.element3(this.regl);

    // Bind some methods
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture.bounds = this.constants.bounds;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleDoubleTap = this.fitToData;

    let points = [];
    for (let k = 0; k < 2 * Math.PI; k += Math.PI / 18) {
      points.push([5.0 * Math.sin(k), 5.0 * Math.cos(k), 1.0]);
    }
    this.ring = {
      points: points.flat(),
    };
    // Just an incubation space for now, will eventually move all of these to seprate class
    points = [];
    let normals = [];
    const latCount = 17;
    const lonCount = 36;
    var lat = (0.5 - 0.5 / latCount) * Math.PI;
    const radius = 10.0;
    for (let j = 0; j < latCount; j++) {
      for (let k = 0; k < lonCount; k++) {
        const lon = (k * 2 * Math.PI) / lonCount;
        const xyz = [
          Math.cos(lat) * Math.sin(lon),
          Math.sin(lat),
          Math.cos(lat) * Math.cos(lon),
        ];
        points.push([radius * xyz[0], radius * xyz[1], radius * xyz[2]]);
        normals.push(xyz);
      }
      lat -= Math.PI / latCount;
    }
    let elements = [];
    for (let k = 0; k < latCount; k++) {
      elements.push(
        Array.from(Array(lonCount), (_, j) => [
          k * lonCount + j,
          k * lonCount + ((j + 1) % lonCount),
        ])
      );
    }
    for (let k = 0; k < lonCount; k++) {
      //lonElements.push(Array.from(Array(latCount), (_, j) => k + j * lonCount));
      elements.push(
        Array.from(Array(latCount - 1), (_, j) => [
          k + j * lonCount,
          k + (j + 1) * lonCount,
        ])
      );
    }
    this.grid = {
      points: points,
      normals: normals,
      elements: elements.flat(),
    };
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    this.setState((state) => {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const c = state.satCoordinate;
      const x = c[2] * Math.cos(c[1]) * Math.sin(c[0]);
      const y = c[2] * Math.sin(c[1]);
      const z = c[2] * Math.cos(c[1]) * Math.cos(c[0]);
      const satPosition = vec3.fromValues(x, y, z);
      const p = mat4.perspective([], state.fov, w / h, 0.1, 1000.0);
      const mv = mat4.lookAt([], satPosition, [0, 0, 0], [0, 1, 0]);
      return {
        modelview: mv,
        projection: p,
        satPosition: satPosition,
        viewport: { x: 0, y: 0, width: w, height: h },
      };
    });
  }

  draw() {
    if (
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    this.setState((state, props) => {
      this.regl.clear({
        color: props.colors.canvas,
      });
      this.art([
        {
          primitive: "line loop",
          color: props.colors.lines[2],
          projection: state.projection,
          viewport: state.viewport,
          points: this.ring.points,
          count: this.ring.points.length / 3,
        },
      ]);
      this.water([
        {
          primitive: "lines",
          color: props.colors.lines[3],
          modelview: state.modelview,
          projection: state.projection,
          viewport: state.viewport,
          points: this.grid.points,
          normals: this.grid.normals,
          elements: this.grid.elements,
        },
      ]);
      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }

  pan(x, y) {
    this.setState((state) => {
      let c = state.satCoordinate;
      c[0] -= 0.004 * x;
      c[1] -= 0.004 * y;
      return {
        satCoordinate: c,
      };
    });
    this.updateProjection();
  }

  magnify() {
    return;
  }

  fitToData() {
    this.setState({
      satCoordinate: vec3.fromValues(0, 0, 35),
    });
    this.updateProjection();
  }
}

export { Product };
