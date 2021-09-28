//
//  glview.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4, vec3, quat } from "gl-matrix";

import * as theme from "./theme";
import * as common from "./common";
import * as artists from "./artists";
import { Gesture } from "./gesture";
import { Rings } from "./rings";

class GLView extends Component {
  constructor(props) {
    super(props);
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("roundCorder");
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
    if (props.showStats || props.debug || props.profileGL) {
      this.stats = new Stats();
      this.stats.domElement.className = "canvasStats";
    }
    this.constants = {
      rings: common.tickChoices(1, 150),
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
    };
    const origin = this.constants.origin;
    const satCoordinate = vec3.fromValues(
      common.deg2rad(origin.longitude),
      common.deg2rad(origin.latitude),
      2.0 * common.earthRadius
    );
    const satPosition = common.rad.coord2point(satCoordinate);
    // satCoordinate = (lon-rad, lat-rad, alt-km) of satellite
    // satPosition = (x, y, z) of satellite
    // satQuaternion = quaternion represent of satellite orientation
    // satI = sub-quaternion y-axis only, plane I
    // satQ = sub-quaternion y-axis only, plane Q
    // model = model matrix for product, rings, radar-relative drawings
    // view = view matrix derived from satPosition
    let model = mat4.create();
    model = mat4.rotateY([], model, common.deg2rad(origin.longitude));
    model = mat4.rotateX([], model, common.deg2rad(-origin.latitude));
    model = mat4.translate([], model, [0, 0, common.earthRadius]);
    // Important parameters for WebGL. Don't want to use React state
    this.geometry = {
      fov: 0.028,
      aspect: 1,
      origin: origin,
      satCoordinate: satCoordinate,
      satPosition: satPosition,
      satQuaternion: quat.fromEuler([], -origin.latitude, origin.longitude, 0),
      satI: 1.0,
      satQ: 0.0,
      model: model,
      view: mat4.create(),
      projection: mat4.create(),
      modelview: model,
      viewprojection: mat4.create(),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      needsUpdate: true,
      message: "geo",
    };
    // Our artists
    this.picaso = artists.simplifiedInstancedLines(this.regl);
    this.monet = artists.instancedLines(this.regl, 0);
    this.gogh = artists.instancedPatches(this.regl);
    this.basic3 = artists.basic3(this.regl);
    this.sphere = artists.sphere(this.regl);
    this.umbrella = artists.triangleFan(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    this.tap = this.tap.bind(this);
    this.taptap = this.taptap.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleSingleTap = this.tap;
    this.gesture.handleDoubleTap = this.taptap;
    this.gesture.handleMagnify = this.magnify;
    // Other built-in assets
    this.rings = new Rings(this.regl, [1, 60, 120, 250], 60);
  }

  static defaultProps = {
    debug: false,
    debugGL: false,
    profileGL: false,
    showStats: false,
    colors: theme.colorDict(),
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
    if (this.props.debug) {
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
    this.canvas.width = this.mount.offsetWidth * this.ratio;
    this.canvas.height = this.mount.offsetHeight * this.ratio;
    const geo = this.geometry;
    const w = this.canvas.width;
    const h = this.canvas.height;
    geo.aspect = w / h;
    geo.satPosition = common.rad.coord2point(...geo.satCoordinate);
    geo.view = mat4.lookAt([], geo.satPosition, [0, 0, 0], [0, 1, 0]);
    geo.modelview = mat4.multiply([], geo.view, geo.model);
    geo.projection = mat4.perspective([], geo.fov, geo.aspect, 100, 30000.0);
    geo.viewprojection = mat4.multiply([], geo.projection, geo.view);
    geo.viewport.width = w;
    geo.viewport.height = h;
    geo.message = "geo";
    geo.needsUpdate = false;
  }

  draw() {
    if (this.mount === null) {
      return;
    }
    if (
      this.geometry.needsUpdate ||
      this.canvas.width != this.mount.offsetWidth * this.ratio ||
      this.canvas.height != this.mount.offsetHeight * this.ratio
    ) {
      this.updateProjection();
    }
    const geo = this.geometry;
    this.regl.clear({
      color: this.props.colors.glview,
    });
    this.sphere({
      modelview: geo.view,
      projection: geo.projection,
      viewport: geo.viewport,
      color: this.props.colors.lines[2],
    });
    // quad: [mode, shader-user mix, shader color tint, opacity]
    this.monet({
      width: 2.5,
      color: [0.5, 0.5, 0.5, 1.0],
      model: geo.model,
      quad: [0.0, 1.0, 0.5, 1.0],
      view: geo.view,
      projection: geo.projection,
      resolution: [this.canvas.width, this.canvas.height],
      viewport: geo.viewport,
      points: this.rings.points,
      segments: this.rings.count,
    });
    this.stats?.update();
  }

  pan(x, y) {
    const geo = this.geometry;
    const lon =
      geo.satCoordinate[0] -
      ((x / this.mount.clientWidth) * geo.fov * geo.aspect) /
        Math.cos(geo.satCoordinate[1]);
    geo.satCoordinate[1] = common.clamp(
      geo.satCoordinate[1] - (y / this.mount.clientHeight) * geo.fov,
      -0.499 * Math.PI,
      +0.499 * Math.PI
    );
    // For continuous longitude transition around +/-180 deg, poor-man quartenion
    geo.satI = Math.cos(lon);
    geo.satQ = Math.sin(lon);
    geo.satCoordinate[0] = Math.atan2(geo.satQ, geo.satI);
    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message += ` satQ (${geo.satI.toFixed(3)}, ${geo.satQ.toFixed(3)})`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  tap(x, y) {}

  taptap(x, y) {}

  magnify(_mx, _my, m, _x, _y) {
    const geo = this.geometry;
    geo.fov = common.clamp(geo.fov / m, 0.001, 0.4 * Math.PI);
    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message += ` fov: ${geo.fov.toFixed(3)}`;
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }

  fitToData() {
    const geo = this.geometry;
    geo.fov = 0.028;
    geo.satCoordinate[0] = common.deg2rad(geo.origin.longitude);
    geo.satCoordinate[1] = common.deg2rad(geo.origin.latitude);
    geo.needsUpdate = true;
    if (this.props.debug) {
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }
}

export { GLView };
