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
    // const satCoordinate = vec3.fromValues(
    //   common.deg2rad(origin.longitude),
    //   common.deg2rad(origin.latitude),
    //   2.0 * common.earthRadius
    // );
    const radarPosition = common.deg.coord2point(
      origin.longitude,
      origin.latitude,
      common.earthRadius
    );
    const height = common.earthRadius;
    const satPosition = [
      radarPosition[0],
      radarPosition[1],
      radarPosition[2] + height,
    ];
    let model = mat4.create();
    model = mat4.rotateY([], model, common.deg2rad(origin.longitude));
    model = mat4.rotateX([], model, common.deg2rad(-origin.latitude));
    model = mat4.translate([], model, [0, 0, common.earthRadius]);
    // let satModel = mat4.create();
    // satModel = mat4.rotateY([], satModel, common.deg2rad(origin.longitude));
    // satModel = mat4.rotateX([], satModel, common.deg2rad(-origin.latitude));
    // satModel = mat4.translate([], satModel, [0, 0, common.earthRadius]);
    // satModel = mat4.scale([], satModel, [250, 250, 500]);
    let originQuaternion = quat.fromEuler(
      [],
      -origin.latitude,
      origin.longitude,
      0
    );
    let satModel = mat4.fromQuat([], originQuaternion);
    satModel = mat4.translate([], satModel, [0, 0, common.earthRadius]);
    satModel = mat4.scale([], satModel, [250, 250, 500]);
    // Important parameters for WebGL. Don't want to use React state
    this.geometry = {
      // fov: 0.028,
      fov: 1.0,
      aspect: 1,
      origin: origin,
      originQuaternion: originQuaternion,
      // satCoordinate: satCoordinate,
      satPosition: vec3.fromValues(...satPosition),
      satQuaternion: quat.create(),
      satModel: satModel,
      satModelview: mat4.create(),
      satUp: vec3.fromValues(0, 1, 0),
      satTarget: vec3.fromValues(...satModel),
      fix: {
        model: mat4.create(),
        modelview: mat4.create(),
        projection: mat4.create(),
      },
      radarPosition: radarPosition,
      model: model,
      targetModel: mat4.scale([], satModel, [0.01, 0.01, 0.01]),
      view: mat4.create(),
      projection: mat4.create(),
      modelview: mat4.create(),
      viewprojection: mat4.create(),
      orthoprojection: mat4.ortho([], 0, 1, 0, 1, 0, 1),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      dashport: { x: 0, y: 100, width: 1000, height: 1000 },
      needsUpdate: true,
      message: "geo",
    };

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
      count: cone.count,
    };
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
      // longitude: -97.422413,
      // latitude: 35.25527,
      longitude: 15.0,
      latitude: 20.0,
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

    // mat4.getTranslation(geo.satPosition, geo.satModel);

    geo.view = mat4.lookAt([], geo.satPosition, geo.satTarget, geo.satUp);
    // geo.modelview = mat4.multiply([], geo.view, geo.model);
    mat4.multiply(geo.modelview, geo.view, geo.targetModel);
    geo.projection = mat4.perspective([], geo.fov, geo.aspect, 100, 30000.0);
    geo.viewprojection = mat4.multiply([], geo.projection, geo.view);
    // geo.satPosition = common.rad.coord2point(...geo.satCoordinate);

    geo.satModelview = mat4.multiply([], geo.view, geo.satModel);

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
      // dashport
      {
        modelview: geo.modelview,
        projection: geo.projection,
        viewport: geo.dashport,
        color: [1.0, 0.0, 0.0, 1.0],
        points: this.earth.points,
        elements: this.earth.elements,
        primitive: "lines",
      },
      {
        modelview: geo.view,
        projection: geo.projection,
        viewport: geo.dashport,
        color: [0.0, 0.5, 0.0, 1.0],
        points: this.earth.points,
        elements: this.earth.elements,
        primitive: "lines",
      },
    ]);

    this.basic3([
      {
        modelview: geo.satModelview,
        projection: geo.projection,
        viewport: geo.viewport,
        color: [0.0, 0.3, 1.0, 1.0],
        points: this.cone.points,
        primitive: "lines",
        count: this.cone.count,
      },
      {
        modelview: geo.satModelview,
        projection: geo.projection,
        viewport: geo.dashport,
        color: [0.0, 0.3, 1.0, 1.0],
        points: this.cone.points,
        primitive: "lines",
        count: this.cone.count,
      },
    ]);

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
    let deltaX = (-x / this.mount.clientWidth) * geo.fov;
    let deltaY = (y / this.mount.clientHeight) * geo.fov;
    let r = [0, 0, common.earthRadius];

    mat4.fromQuat(geo.satModel, geo.originQuaternion);
    mat4.translate(geo.satModel, geo.satModel, r);

    mat4.scale(geo.targetModel, geo.satModel, [0.01, 0.01, 0.01]);
    // mat4.getTranslation(geo.satTarget, geo.satModel);

    let p = quat.setAxisAngle([], [0.0, 1.0, 0.0], deltaX);
    let q = quat.setAxisAngle([], [1.0, 0.0, 0.0], deltaY);

    // Here comes the Quaternion Voodoo
    quat.multiply(geo.originQuaternion, p, geo.originQuaternion);
    quat.multiply(geo.originQuaternion, geo.originQuaternion, q);

    let a = mat4.fromQuat([], geo.satQuaternion);
    mat4.multiply(geo.satModel, geo.satModel, a);

    // let f = [0, 0, common.earthRadius];
    let f = [0, 0, 1000.0];
    mat4.translate(geo.satModel, geo.satModel, f);

    mat4.scale(geo.satModel, geo.satModel, [250, 250, 500]);

    // mat4.getTranslation(geo.satPosition, geo.satModel);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message +=
        ` delta (${x}, ${y}) ` +
        `-> (${deltaX.toFixed(3)}, ${deltaY.toFixed(3)})`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  tilt(x, y) {
    const geo = this.geometry;
    let deltaX = (x / this.mount.clientWidth) * 2.0;
    let deltaY = (y / this.mount.clientHeight) * 2.0;
    let r = [0, 0, common.earthRadius];

    mat4.fromQuat(geo.satModel, geo.originQuaternion);
    mat4.translate(geo.satModel, geo.satModel, r);

    mat4.scale(geo.targetModel, geo.satModel, [0.01, 0.01, 0.01]);
    // mat4.getTranslation(geo.satTarget, geo.satModel);

    // Here comes the Quaternion Voodoo
    let u = quat.setAxisAngle([], [0.0, 0.0, 1.0], deltaX);
    let v = quat.setAxisAngle([], [1.0, 0.0, 0.0], deltaY);
    quat.multiply(geo.satQuaternion, v, geo.satQuaternion);
    quat.multiply(geo.satQuaternion, geo.satQuaternion, u);

    let a = mat4.fromQuat([], geo.satQuaternion);
    mat4.multiply(geo.satModel, geo.satModel, a);

    // let f = [0, 0, common.earthRadius];
    let f = [0, 0, 1000.0];
    mat4.translate(geo.satModel, geo.satModel, f);

    mat4.scale(geo.satModel, geo.satModel, [250, 250, 500]);

    // mat4.getTranslation(geo.satPosition, geo.satModel);

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
    geo.fov = common.clamp(geo.fov / m, 0.001, 0.5 * Math.PI);
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
    // geo.satCoordinate[0] = common.deg2rad(geo.origin.longitude);
    // geo.satCoordinate[1] = common.deg2rad(geo.origin.latitude);
    const radarPosition = common.deg.coord2point(
      origin.longitude,
      origin.latitude,
      common.earthRadius
    );
    const height = 1000.0;
    const satPosition = [
      radarPosition[0],
      radarPosition[1],
      radarPosition[2] + height,
    ];
    vec3.copy(geo.satPosition, satPosition);
    vec3.copy(geo.satTarget, [0, 0, 0]);
    geo.needsUpdate = true;
    if (this.props.debug) {
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }
}

export { GLView };
