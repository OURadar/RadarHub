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
      radius: 6357,
      bounds: {
        top: 10,
        right: 0,
        bottom: 0,
        left: 0,
      },
      origin: {
        longitude: -20,
        latitude: 30,
      },
    };
    // satCoordinate = (lon, lat, alt) of satellite
    // satPosition = (x, y, z) of satellite
    // model = model matrix for product, rings, radar-relative drawings
    // view = view matrix derived from satPosition
    const origin = this.constants.origin;
    let model = mat4.create();
    model = mat4.rotateY([], model, (origin.longitude / 180.0) * Math.PI);
    model = mat4.rotateX([], model, (-origin.latitude / 180.0) * Math.PI);
    model = mat4.translate([], model, [0, 0, this.constants.radius]);
    this.state = {
      ...this.state,
      fov: Math.PI / 4,
      satCoordinate: vec3.fromValues(
        (origin.longitude / 180.0) * Math.PI,
        (origin.latitude / 180.0) * Math.PI,
        3 * this.constants.radius
      ),
      satPosition: vec3.create(),
      model: model,
      view: mat4.create(),
      labelParameters: {
        labels: [],
        positions: [],
        alignments: [],
        foreground: props.colors.foreground,
        colors: [],
        sizes: [],
        count: 0,
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
      points.push([1000 * Math.sin(k), 1000 * Math.cos(k), 1.0]);
    }
    this.ring = {
      points: points.flat(),
    };
    // Just an incubation space for now, will eventually move all of these to seprate class
    points = [];
    let normals = [];
    const latCount = 17;
    const lonCount = 36;
    var lat = (80.0 / 180.0) * Math.PI;
    for (let j = 0; j < latCount; j++) {
      for (let k = 0; k < lonCount; k++) {
        const lon = (k * 2 * Math.PI) / lonCount;
        const xyz = [
          Math.cos(lat) * Math.sin(lon),
          Math.sin(lat),
          Math.cos(lat) * Math.cos(lon),
        ];
        const r = this.constants.radius;
        points.push([r * xyz[0], r * xyz[1], r * xyz[2]]);
        normals.push(xyz);
      }
      lat -= Math.PI / 18;
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
      return {
        view: mat4.lookAt([], satPosition, [0, 0, 0], [0, 1, 0]),
        projection: mat4.perspective([], state.fov, w / h, 100, 25000.0),
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
      const modelview = mat4.multiply([], state.view, state.model);
      this.regl.clear({
        color: props.colors.canvas,
      });
      this.art([
        {
          primitive: "line loop",
          color: props.colors.lines[2],
          projection: mat4.multiply([], state.projection, modelview),
          viewport: state.viewport,
          points: this.ring.points,
          count: this.ring.points.length / 3,
        },
      ]);
      this.water([
        {
          primitive: "lines",
          color: props.colors.lines[3],
          modelview: state.view,
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
      c[0] -= 0.003 * state.fov * x;
      c[1] -= 0.003 * state.fov * y;
      return {
        satCoordinate: c,
      };
    });
    this.updateProjection();
  }

  magnify(x, y, _x, _y) {
    this.setState((state) => {
      const m = 0.5 * (y - 1) + 1.0;
      const fov = common.clamp(state.fov / m, Math.PI / 180, Math.PI);
      return {
        fov: fov,
        lastMagnifyTime: new Date().getTime(),
      };
    });
    this.updateProjection();
  }

  fitToData() {
    this.setState({
      fov: Math.PI / 4,
      satCoordinate: vec3.fromValues(
        (this.constants.origin.longitude / 180.0) * Math.PI,
        (this.constants.origin.latitude / 180.0) * Math.PI,
        3 * this.constants.radius
      ),
    });
    this.updateProjection();
  }
}

export { Product };
