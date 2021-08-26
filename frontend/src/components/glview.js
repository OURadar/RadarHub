//
//  glview.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4, vec3 } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Gesture } from "./gesture";

class GLView extends Component {
  constructor(props) {
    super(props);
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.regl = require("regl")({
      canvas: this.canvas,
      extensions: ["ANGLE_instanced_arrays"],
    });
    if (props.showStats === true || props.debug === true) {
      this.stats = new Stats();
      this.stats.domElement.className = "canvasStats";
    }
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
      tic: 0,
      fov: Math.PI / 6,
      satCoordinate: vec3.fromValues(
        (origin.longitude / 180.0) * Math.PI,
        (origin.latitude / 180.0) * Math.PI,
        3 * this.constants.radius
      ),
      satPosition: vec3.create(),
      model: model,
      view: mat4.create(),
      modelview: model,
      projectionNeedsUpdate: false,
      alwaysUpdateProjection: true,
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
    this.picaso = instanced.interleavedStripRoundCapJoin3D(this.regl, 8);
    this.gogh = artists.sprite(this.regl);
    this.art = artists.basic3(this.regl);
    this.earth = artists.sphere(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleDoubleTap = this.fitToData;

    let points = [];
    for (let k = 0; k < 2 * Math.PI; k += Math.PI / 18) {
      points.push([250 * Math.sin(k), 250 * Math.cos(k), 0.012]);
    }
    this.ring = {
      points: points.flat(),
    };
  }

  static defaultProps = {
    debug: false,
    debugGL: false,
    showStats: false,
    colors: common.colorDict(),
    linewidth: 1.4,
    textureScale: 1.0,
  };

  componentDidMount() {
    this.mount.appendChild(this.canvas);
    if (this.stats !== undefined) {
      this.mount.appendChild(this.stats.domElement);
    }
    this.updateProjection();
    this.regl.frame(this.draw);
  }

  render() {
    if (this.props.debug === true) {
      const str =
        this.gesture.message +
        " " +
        (this.mount ? this.mount.offsetHeight : "") +
        " px";
      return (
        <div>
          <div className="ppi" ref={(x) => (this.mount = x)} />
          <div className="debug">
            <div className="leftPadded">{str}</div>
          </div>
        </div>
      );
    }
    return <div className="fullHeight" ref={(x) => (this.mount = x)} />;
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
      const view = mat4.lookAt([], satPosition, [0, 0, 0], [0, 1, 0]);
      return {
        view: view,
        modelview: mat4.multiply([], view, state.model),
        projection: mat4.perspective([], state.fov, w / h, 100, 25000.0),
        satPosition: satPosition,
        viewport: { x: 0, y: 0, width: w, height: h },
        projectionNeedsUpdate: state.alwaysUpdateProjection ? true : false,
      };
    });
  }

  draw() {
    if (
      this.state.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    this.setState((state, props) => {
      this.regl.clear({
        color: props.colors.canvas,
      });
      this.earth([
        {
          modelview: state.view,
          projection: state.projection,
          viewport: state.viewport,
        },
      ]);
      this.picaso([
        {
          points: this.ring.points,
          width: 2.5,
          color: props.colors.lines[2],
          model: state.model,
          view: state.view,
          projection: state.projection,
          resolution: [this.canvas.width, this.canvas.height],
          segments: this.ring.points.length / 3 - 1,
          viewport: state.viewport,
        },
      ]);
      let c = state.satCoordinate;
      c[0] -= 0.003;
      if (c[0] < -Math.PI) {
        c[0] += 2 * Math.PI;
      }
      return {
        tic: state.tic + 1,
        satCoordinate: c,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }

  pan(x, y) {
    this.setState((state) => {
      let c = state.satCoordinate;
      c[0] = c[0] - 0.003 * state.fov * x;
      c[1] = common.clamp(
        c[1] - 0.003 * state.fov * y,
        -0.5 * Math.PI,
        +0.5 * Math.PI
      );

      return {
        satCoordinate: c,
        projectionNeedsUpdate: true,
      };
    });
    this.updateProjection();
  }

  magnify(x, y, _x, _y) {
    this.setState((state) => {
      const fov = common.clamp(state.fov / y, Math.PI / 180, 0.5 * Math.PI);
      return {
        fov: fov,
        projectionNeedsUpdate: true,
        lastMagnifyTime: new Date().getTime(),
      };
    });
  }

  fitToData() {
    this.setState({
      fov: Math.PI / 4,
      projectionNeedsUpdate: true,
      satCoordinate: vec3.fromValues(
        (this.constants.origin.longitude / 180.0) * Math.PI,
        (this.constants.origin.latitude / 180.0) * Math.PI,
        3 * this.constants.radius
      ),
    });
  }
}

export { GLView };
