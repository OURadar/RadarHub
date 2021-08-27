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
        longitude: -100,
        latitude: 40,
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
    // Important parameters for WebGL
    this.graphics = {
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
      identityMatrix: mat4.create(),
      projectionNeedsUpdate: false,
      alwaysUpdateProjection: true,
    };
    // Our artists
    this.picaso = instanced.interleavedStripRoundCapJoin3D(this.regl, 8);
    this.gogh = artists.sprite(this.regl);
    this.basic3 = artists.basic3(this.regl);
    this.sphere = artists.sphere(this.regl);
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
    let points2 = [];
    points2.push(points[0]);
    for (let k = 1; k < points.length - 1; k++) {
      points2.push(points[k], points[k]);
    }
    points2.push(points[points.length - 1]);
    this.ring = {
      points: points.flat(),
      points2: new Float32Array(points2.flat()),
    };
    console.log(this.ring.points2.length / 6 - 1);
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
    const graph = this.graphics;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const c = graph.satCoordinate;
    const x = c[2] * Math.cos(c[1]) * Math.sin(c[0]);
    const y = c[2] * Math.sin(c[1]);
    const z = c[2] * Math.cos(c[1]) * Math.cos(c[0]);
    graph.satPosition = vec3.fromValues(x, y, z);
    graph.view = mat4.lookAt([], graph.satPosition, [0, 0, 0], [0, 1, 0]);
    graph.modelview = mat4.multiply([], graph.view, graph.model);
    graph.projection = mat4.perspective([], graph.fov, w / h, 100, 30000.0);
    graph.viewport = { x: 0, y: 0, width: w, height: h };
    graph.projectionNeedsUpdate = graph.alwaysUpdateProjection ? true : false;
  }

  draw() {
    if (
      this.graphics.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    const graph = this.graphics;
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: graph.view,
      projection: graph.projection,
      viewport: graph.viewport,
    });
    this.picaso({
      points: this.ring.points,
      width: 2.5,
      color: this.props.colors.lines[2],
      model: graph.model,
      view: graph.view,
      projection: graph.projection,
      resolution: [this.canvas.width, this.canvas.height],
      segments: this.ring.points.length / 3 - 1,
      viewport: graph.viewport,
    });
    let c = graph.satCoordinate;
    c[0] -= 0.003;
    if (c[0] < -Math.PI) {
      c[0] += 2 * Math.PI;
    }
    graph.satCoordinate = c;
    if (this.stats !== undefined) this.stats.update();
  }

  pan(x, y) {
    const graph = this.graphics;
    let c = graph.satCoordinate;
    c[0] = c[0] - 0.003 * graph.fov * x;
    c[1] = common.clamp(
      c[1] - 0.003 * graph.fov * y,
      -0.499 * Math.PI,
      +0.499 * Math.PI
    );
    graph.projectionNeedsUpdate = true;
    if (this.props.debugGL) {
      this.setState({
        lastPanTime: new Date().getTime(),
      });
    }
  }

  magnify(x, y, _x, _y) {
    const graph = this.graphics;
    graph.fov = common.clamp(graph.fov / y, Math.PI / 180, 0.5 * Math.PI);
    graph.projectionNeedsUpdate = true;
    if (this.props.debugGL) {
      this.setState({
        lastMagnifyTime: new Date().getTime(),
      });
    }
  }

  fitToData() {
    const graph = this.graphics;
    graph.gov = Math.PI / 6;
    graph.satCoordinate = vec3.fromValues(
      (this.constants.origin.longitude / 180.0) * Math.PI,
      (this.constants.origin.latitude / 180.0) * Math.PI,
      3 * this.constants.radius
    );
    graph.projectionNeedsUpdate = true;
    if (this.props.debugGL) {
      this.setState({
        lastMagnifyTime: new Date().getTime(),
      });
    }
  }
}

export { GLView };
