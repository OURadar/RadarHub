//
//  glview.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4, vec3, quat } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Gesture } from "./gesture";
import { Rings } from "./rings";

class GLView extends Component {
  constructor(props) {
    super(props);
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    if (props.profileGL) {
      this.regl = require("regl")({
        canvas: this.canvas,
        extensions: ["ANGLE_instanced_arrays", "ext_disjoint_timer_query"],
        profile: true,
      });
    } else {
      this.regl = require("regl")({
        canvas: this.canvas,
        extensions: ["ANGLE_instanced_arrays"],
      });
    }
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
        longitude: -97.422413,
        latitude: 35.25527,
      },
    };
    this.state = {
      tic: 0,
      message: "glView",
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
    // satCoordinate = (lon-rad, lat-rad, alt-km) of satellite
    // satPosition = (x, y, z) of satellite
    // satQuaternion = quaternion represent of satellite orientation
    // satI = sub-quaternion y-axis only, plane I
    // satQ = sub-quaternion y-axis only, plane Q
    // model = model matrix for product, rings, radar-relative drawings
    // view = view matrix derived from satPosition
    const origin = this.constants.origin;
    let model = mat4.create();
    model = mat4.rotateY([], model, common.deg2rad(origin.longitude));
    model = mat4.rotateX([], model, common.deg2rad(-origin.latitude));
    model = mat4.translate([], model, [0, 0, this.constants.radius]);
    // Important parameters for WebGL. Don't want to use React state
    this.geometry = {
      fov: Math.PI / 4,
      satCoordinate: vec3.fromValues(
        common.deg2rad(origin.longitude),
        common.deg2rad(origin.latitude),
        2 * this.constants.radius
      ),
      satPosition: vec3.create(),
      satQuaternion: quat.fromEuler([], -origin.latitude, origin.longitude, 0),
      satI: Math.cos(common.deg2rad(origin.longitude)),
      satQ: Math.sin(common.deg2rad(origin.longitude)),
      model: model,
      view: mat4.create(),
      modelview: model,
      projectionNeedsUpdate: false,
      message: "graphics",
    };
    // Our artists
    this.picaso = instanced.simplifiedInstancedLines(this.regl);
    this.monet = instanced.instancedLines(this.regl, 0);
    this.gogh = artists.sprite3(this.regl);
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

    this.rings = new Rings(this.regl, [1, 60, 120, 250], 50);
  }

  static defaultProps = {
    debug: false,
    debugGL: false,
    profileGL: false,
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
      let str = `${this.gesture.message} : ${this.geometry.message} : ${this.state.message}`;
      return (
        <div>
          <div className="fullHeight" ref={(x) => (this.mount = x)} />
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
    const graph = this.geometry;
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
    graph.viewprojection = mat4.multiply([], graph.projection, graph.view);
    graph.viewport = { x: 0, y: 0, width: w, height: h };
    graph.projectionNeedsUpdate = false;
    graph.message = "graphics";
  }

  draw() {
    if (this.mount === null) {
      return;
    }
    if (
      this.geometry.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    const graph = this.geometry;
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: graph.view,
      projection: graph.projection,
      viewport: graph.viewport,
      color: this.props.colors.lines[1],
    });
    this.monet({
      width: 2.5,
      color: [0.5, 0.5, 0.5, 1.0],
      model: graph.model,
      view: graph.view,
      projection: graph.projection,
      resolution: [this.canvas.width, this.canvas.height],
      viewport: graph.viewport,
      points: this.rings.points,
      segments: this.rings.count,
    });
    graph.satCoordinate[0] -= 0.003;
    this.stats?.update();
  }

  pan(x, y) {
    const graph = this.geometry;
    let c = graph.satCoordinate;
    c[0] -= x * graph.fov * 0.0015;
    c[1] = common.clamp(
      c[1] - y * graph.fov * 0.0015,
      -0.4999 * Math.PI,
      +0.4999 * Math.PI
    );
    // For continuous longitude transition around +/-180 deg, use a complex representation
    graph.satI = Math.cos(c[0]);
    graph.satQ = Math.sin(c[0]);
    graph.projectionNeedsUpdate = true;
    if (this.props.debug) {
      graph.message += ` satI: ${graph.satI.toFixed(3)}`;
      graph.message += ` satQ: ${graph.satQ.toFixed(3)}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  magnify(x, y, _x, _y) {
    const graph = this.geometry;
    graph.fov = common.clamp(graph.fov / y, 0.01, 0.5 * Math.PI);
    graph.projectionNeedsUpdate = true;
    if (this.props.debug) {
      graph.message = `fov: ${graph.fov.toFixed(3)}`;
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }

  fitToData() {
    const graph = this.geometry;
    graph.fov = Math.PI / 6;
    graph.satCoordinate = vec3.fromValues(
      common.deg2rad(this.constants.origin.longitude),
      common.deg2rad(this.constants.origin.latitude),
      3 * this.constants.radius
    );
    graph.projectionNeedsUpdate = true;
    if (this.props.debug) {
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }
}

export { GLView };
