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
    // this.captionBox =
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
      tic: 0,
      message: "glView",
    };
    // Key elements of geometry:
    //  - origin = the radar (lon, lat) in degrees
    //  - satCoordinate = (lon-rad, lat-rad, alt-km) of satellite
    //  - satPosition = (x, y, z) of satellite
    //  - satQuaternion = quaternion represent of satellite orientation
    //  - satI = sub-quaternion y-axis only, plane I
    //  - satQ = sub-quaternion y-axis only, plane Q
    //  - model = model matrix for product, rings, radar-relative drawings
    //  - view = view matrix derived from satPosition
    //  - projection = projection matrix to GL view
    const origin = props.origin;
    const satCoordinate = vec3.fromValues(
      common.deg2rad(origin.longitude),
      common.deg2rad(origin.latitude),
      2.0 * common.earthRadius
    );
    const radarCoordinate = vec3.fromValues(
      common.deg2rad(origin.longitude),
      common.deg2rad(origin.latitude),
      common.earthRadius
    );
    let model = mat4.create();
    model = mat4.rotateY([], model, common.deg2rad(origin.longitude));
    model = mat4.rotateX([], model, common.deg2rad(-origin.latitude));
    model = mat4.translate([], model, [0, 0, common.earthRadius]);
    let satModel = mat4.create();
    satModel = mat4.scale([], satModel, [100, 100, 100]);
    satModel = mat4.translate([], satModel, [0, 0, common.earthRadius]);
    // Important parameters for WebGL. Don't want to use React state
    this.geometry = {
      // fov: 0.028,
      fov: 1.0,
      aspect: 1,
      origin: origin,
      satCoordinate: satCoordinate,
      satPosition: common.rad.coord2point(...satCoordinate),
      satQuaternion: quat.fromEuler([], -origin.latitude, origin.longitude, 0),
      satModel: satModel,
      satModelview: mat4.create(),
      satI: 1.0,
      satQ: 0.0,
      satUp: [0, 1, 0],
      satTarget: [0, 0, 0],
      radarCoordinate: radarCoordinate,
      radarPosition: common.rad.coord2point(...radarCoordinate),
      model: model,
      targetModel: mat4.scale([], mat4.create(), [0.1, 0.1, 0.1]),
      view: mat4.create(),
      projection: mat4.create(),
      modelview: model,
      viewprojection: mat4.create(),
      orthoprojection: mat4.ortho([], 0, 1, 0, 1, 0, 1),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      dashport: { x: 0, y: 0, width: 1, height: 1 },
      needsUpdate: true,
      message: "geo",
    };
    console.log(`satPosition = ${this.geometry.satPosition}`);
    console.log(`radarPosition = ${this.geometry.radarPosition}`);

    // Our artists
    this.picaso = artists.simplifiedInstancedLines(this.regl);
    this.monet = artists.instancedLines(this.regl, 0);
    this.gogh = artists.instancedPatches(this.regl);
    this.vinci = artists.texturedElements(this.regl);
    this.basic3 = artists.basic3(this.regl);
    this.sphere = artists.sphere(this.regl);
    this.sphere2 = artists.sphere2(this.regl);
    this.element3 = artists.element3(this.regl);
    this.michelangelo = artists.rect2(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    this.pan2 = this.pan2.bind(this);
    this.tilt = this.tilt.bind(this);
    this.tap = this.tap.bind(this);
    this.taptap = this.taptap.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleTilt = this.tilt;
    this.gesture.handleSingleTap = this.tap;
    this.gesture.handleDoubleTap = this.taptap;
    this.gesture.handleMagnify = this.magnify;
    // Other built-in assets
    this.rings = new Rings(this.regl, [1, 60, 120, 250], 60);
    let earth = require("./earth-grid");
    this.earth = {
      points: this.regl.buffer({
        usage: "static",
        type: "float",
        data: earth.points,
      }),
      elements: earth.elements,
    };
    // console.log(this.earth);
    let cone = require("./geometry-cone");
    this.cone = {
      points: this.regl.buffer({
        usage: "static",
        type: "float",
        data: cone.points,
      }),
    };
    console.log(cone.points);
    console.log(this.cone);
  }

  static defaultProps = {
    debug: false,
    debugGL: false,
    profileGL: false,
    showStats: false,
    colors: theme.colorDict(),
    linewidth: 1.4,
    textureScale: 1.0,
    origin: {
      longitude: -97.422413,
      latitude: 35.25527,
    },
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
    geo.satModelview = mat4.multiply([], geo.view, geo.satModel);
    geo.view = mat4.lookAt([], geo.satPosition, geo.satTarget, geo.satUp);
    // geo.modelview = mat4.multiply([], geo.view, geo.model);
    geo.modelview = mat4.multiply([], geo.view, geo.targetModel);
    geo.projection = mat4.perspective([], geo.fov, geo.aspect, 100, 30000.0);
    geo.viewprojection = mat4.multiply([], geo.projection, geo.view);
    geo.dashport.x = w - geo.dashport.width;
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
    // this.sphere2({
    //   modelview: geo.view,
    //   projection: geo.projection,
    //   viewport: geo.viewport,
    //   color: [1.0, 0.4, 0.4, 1.0],
    // });
    // this.sphere({
    //   modelview: geo.view,
    //   projection: geo.projection,
    //   viewport: geo.viewport,
    //   color: this.props.colors.lines[2],
    // });

    // this.sphere([
    //   {
    //     modelview: geo.modelview,
    //     projection: geo.projection,
    //     viewport: geo.viewport,
    //     color: [1.0, 0.0, 0.0, 1.0],
    //   },
    //   {
    //     modelview: geo.view,
    //     projection: geo.projection,
    //     viewport: geo.viewport,
    //     color: this.props.colors.lines[2],
    //   },
    // ]);

    this.element3([
      {
        modelview: geo.modelview,
        projection: geo.projection,
        viewport: geo.viewport,
        color: [1.0, 0.0, 0.0, 1.0],
        points: this.earth.points,
        elements: this.earth.elements,
        primitive: "lines",
      },
      {
        modelview: geo.view,
        projection: geo.projection,
        viewport: geo.viewport,
        color: [0.0, 0.5, 0.0, 1.0],
        points: this.earth.points,
        elements: this.earth.elements,
        primitive: "lines",
      },
    ]);

    this.basic3({
      modelview: geo.satModelview,
      projection: geo.projection,
      viewport: geo.viewport,
      color: [0.2, 0.2, 1.0, 1.0],
      points: this.cone.points,
      primitive: "lines",
      count: 20,
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
    geo.satPosition = common.rad.coord2point(...geo.satCoordinate);
    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message += ` satQ (${geo.satI.toFixed(3)}, ${geo.satQ.toFixed(3)})`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  pan2(x, y) {
    const geo = this.geometry;
    let deltaX = (x / this.mount.clientWidth) * geo.aspect;
    let deltaY = y / this.mount.clientHeight;
    geo.satPosition = mat4.rotateX([], geo.satPosition, deltaX);
  }

  tilt(x, y) {
    const geo = this.geometry;

    let deltaX = (x / this.mount.clientWidth) * geo.aspect;
    let deltaY = y / this.mount.clientHeight;

    let lon = geo.satCoordinate[0] - 2.0 * deltaX;
    geo.satCoordinate[1] = common.clamp(
      geo.satCoordinate[1] - 2.0 * deltaY,
      -0.499 * Math.PI,
      +0.499 * Math.PI
    );
    // For continuous longitude transition around +/-180 deg, poor-man quartenion
    geo.satI = Math.cos(lon);
    geo.satQ = Math.sin(lon);
    geo.satCoordinate[0] = Math.atan2(geo.satQ, geo.satI);
    geo.satPosition = common.rad.coord2point(...geo.satCoordinate);

    // geo.satTarget[1] += 5000 * delta;

    // let m = mat4.scale([], mat4.create(), [0.3, 0.3, 0.3]);
    let m = mat4.create();
    // let v = [
    //   geo.radarPosition[0] * 2.0 - geo.satPosition[0],
    //   geo.radarPosition[1] * 2.0 - geo.satPosition[1],
    //   geo.radarPosition[2] * 2.0 - geo.satPosition[2],
    // ];

    let v = [geo.radarPosition[0], geo.radarPosition[1], geo.radarPosition[2]];
    // let v = [
    //   -geo.radarPosition[0],
    //   -geo.radarPosition[1],
    //   -geo.radarPosition[2],
    // ];

    geo.satTarget[0] = v[0];
    geo.satTarget[1] = v[1];
    geo.satTarget[2] = v[2];

    m = mat4.translate([], m, v);
    geo.targetModel = mat4.scale([], m, [0.1, 0.1, 0.1]);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message +=
        ` tilt()  ${geo.satTarget}` +
        ` delta = ${deltaX.toFixed(2)}, ${deltaY.toFixed(2)}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  tap(x, y) {}

  taptap(x, y) {
    this.fitToData();
  }

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
    // geo.fov = 0.028;
    geo.fov = 1.0;
    geo.satCoordinate[0] = common.deg2rad(geo.origin.longitude);
    geo.satCoordinate[1] = common.deg2rad(geo.origin.latitude);
    geo.satPosition = common.rad.coord2point(...geo.satCoordinate);
    geo.satTarget = [0, 0, 0];
    geo.needsUpdate = true;
    if (this.props.debug) {
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }
}

export { GLView };
