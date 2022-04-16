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
    //  - model = model matrix for product, rings, radar-relative drawings
    //  - view = view matrix derived from satPosition
    //  - projection = projection matrix to GL view
    const origin = props.origin;
    const range = vec3.fromValues(0, 0, common.earthRadius);

    // The radar
    let model = mat4.create();
    let quaternion = quat.create();
    quat.fromEuler(quaternion, -origin.latitude, origin.longitude, 0);
    mat4.fromQuat(model, quaternion);
    mat4.translate(model, model, range);

    // The target (little red sphere)
    let targetModel = mat4.create();
    mat4.fromQuat(targetModel, quaternion);
    mat4.translate(targetModel, targetModel, range);

    // The eye (cone) relative to target
    let eyeModel = mat4.clone(targetModel);
    mat4.translate(eyeModel, eyeModel, range);

    mat4.scale(targetModel, targetModel, [0.01, 0.01, 0.01]);
    mat4.scale(eyeModel, eyeModel, [250, 250, 5000]);

    let fixView = mat4.create();
    let fixModel = mat4.create();
    let fixPosition = mat4.create();
    let fixProjection = mat4.create();
    let fixRange = vec3.fromValues(0, 0, 3 * common.earthRadius);
    // mat4.fromQuat(fixModel, quaternion);
    mat4.translate(fixModel, fixModel, fixRange);
    mat4.getTranslation(fixPosition, fixModel);
    mat4.lookAt(fixView, fixPosition, [0, 0, 0], [0, 1, 0]);
    mat4.perspective(fixProjection, 1.5, 1, 100, 30000);

    // Important parameters for WebGL. Don't want to use React state
    this.geometry = {
      // fov: 0.028,
      origin: origin,
      quaternion: quaternion,
      eye: {
        range: common.earthRadius,
        model: eyeModel,
        modelview: mat4.create(),
        quaternion: quat.create(),
        position: vec3.create(),
        up: vec3.fromValues(0, 1, 0),
      },
      target: {
        model: targetModel,
        modelview: mat4.create(),
        quaternion: quat.clone(quaternion),
        position: vec3.create(),
      },
      fix: {
        fov: 1.5,
        aspect: 1.0,
        view: fixView,
        model: fixModel,
        projection: fixProjection,
        viewport: {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      },
      fov: 1.0,
      aspect: 1,
      model: model,
      view: mat4.create(),
      projection: mat4.create(),
      viewprojection: mat4.create(),
      modelview: mat4.create(),
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
    this.basic = artists.basic(this.regl);
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
    this.roll = this.roll.bind(this);
    this.tap = this.tap.bind(this);
    this.taptap = this.taptap.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleTilt = this.tilt;
    this.gesture.handleRoll = this.roll;
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
    let rect = require("./geometry-rect");
    this.rect = {
      points: this.regl.buffer({
        usage: "static",
        type: "float",
        data: rect.points,
      }),
      count: rect.count,
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
      longitude: 60.0,
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
    const r = common.earthRadius;
    const a = 0.2 * r;
    geo.aspect = w / h;

    let t = [0, 0, r];
    let e = [0, 0, a];
    let s = [a * geo.fov, a * geo.fov, a];

    mat4.fromQuat(geo.target.model, geo.target.quaternion);
    mat4.translate(geo.target.model, geo.target.model, t);

    mat4.fromQuat(geo.eye.model, geo.eye.quaternion);
    mat4.multiply(geo.eye.model, geo.target.model, geo.eye.model);
    mat4.translate(geo.eye.model, geo.eye.model, e);

    mat4.scale(geo.target.model, geo.target.model, [0.05, 0.05, 0.05]);
    mat4.scale(geo.eye.model, geo.eye.model, s);

    let u = vec3.fromValues(
      geo.eye.model[4],
      geo.eye.model[5],
      geo.eye.model[6]
    );

    mat4.getTranslation(geo.eye.position, geo.eye.model);
    mat4.getTranslation(geo.target.position, geo.target.model);
    // mat4.lookAt(geo.view, geo.eye.position, geo.target.position, geo.eye.up);
    mat4.lookAt(geo.view, geo.eye.position, geo.target.position, u);
    mat4.multiply(geo.eye.modelview, geo.view, geo.eye.model);
    mat4.perspective(geo.projection, geo.fov, geo.aspect, 100, 30000.0);

    mat4.multiply(geo.eye.modelview, geo.fix.view, geo.eye.model);
    mat4.multiply(geo.target.modelview, geo.fix.view, geo.target.model);
    mat4.multiply(geo.viewprojection, geo.projection, geo.view);

    geo.dashport.x = w - geo.dashport.width;

    const ww = Math.round(h / 3);
    geo.fix.viewport.width = ww;
    geo.fix.viewport.height = ww;
    geo.fix.viewport.x = w - ww;

    geo.viewport.width = w;
    geo.viewport.height = h;
    geo.message = `geo`;
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

    this.element3({
      modelview: geo.view,
      projection: geo.projection,
      viewport: geo.viewport,
      color: [0.0, 0.5, 0.0, 1.0],
      points: this.earth.points,
      elements: this.earth.elements,
      primitive: "lines",
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

    //

    this.basic({
      projection: geo.orthoprojection,
      viewport: geo.fix.viewport,
      color: [0.1, 0.1, 0.2, 1.0],
      points: this.rect.points,
      count: this.rect.count,
      primitive: "triangles",
    });

    this.element3([
      {
        modelview: geo.fix.view,
        projection: geo.fix.projection,
        viewport: geo.fix.viewport,
        color: [0.0, 1.0, 0.0, 1.0],
        points: this.earth.points,
        elements: this.earth.elements,
        primitive: "lines",
      },
      {
        modelview: geo.target.modelview,
        projection: geo.fix.projection,
        viewport: geo.fix.viewport,
        color: [1.0, 0.5, 0.0, 1.0],
        points: this.earth.points,
        elements: this.earth.elements,
        primitive: "lines",
      },
    ]);

    this.basic3({
      modelview: geo.eye.modelview,
      projection: geo.fix.projection,
      viewport: geo.fix.viewport,
      color: [0.2, 0.5, 1.0, 1.0],
      points: this.cone.points,
      count: this.cone.count,
      primitive: "lines",
    });

    this.stats?.update();
  }

  pan(x, y) {
    const geo = this.geometry;
    let deltaX = (-x / this.mount.clientWidth) * geo.fov;
    let deltaY = (y / this.mount.clientHeight) * geo.fov;

    // Here comes the Quaternion Voodoo
    let p = quat.setAxisAngle([], [0.0, 1.0, 0.0], deltaX);
    let q = quat.setAxisAngle([], [1.0, 0.0, 0.0], deltaY);
    // quat.multiply(geo.target.quaternion, p, geo.target.quaternion);
    // quat.multiply(geo.target.quaternion, geo.target.quaternion, q);

    quat.multiply(geo.target.quaternion, geo.target.quaternion, p);
    quat.multiply(geo.target.quaternion, geo.target.quaternion, q);

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

    let u = quat.setAxisAngle([], [0.0, 1.0, 0.0], deltaX);
    // let v = quat.setAxisAngle([], [1.0, 0.0, 0.0], deltaY);
    quat.multiply(geo.eye.quaternion, geo.eye.quaternion, u);
    // quat.multiply(geo.eye.quaternion, geo.eye.quaternion, v);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message +=
        ` tilt()  ${geo.eye.target}` +
        ` delta = ${deltaX.toFixed(2)}, ${deltaY.toFixed(2)}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  roll(x, y) {
    const geo = this.geometry;
    let deltaX = (x / this.mount.clientWidth) * 2.0;
    let deltaY = (y / this.mount.clientHeight) * 2.0;
    let u = quat.setAxisAngle([], [0.0, 0.0, 1.0], deltaX);
    let v = quat.setAxisAngle([], [1.0, 0.0, 0.0], deltaY);
    quat.multiply(geo.eye.quaternion, geo.eye.quaternion, u);
    quat.multiply(geo.eye.quaternion, geo.eye.quaternion, v);
    geo.needsUpdate = true;
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
    // const height = 1000.0;
    // vec3.copy(geo.satPosition, satPosition);

    const origin = geo.origin;
    quat.fromEuler(geo.quaternion, -origin.latitude, origin.longitude, 0);
    quat.fromEuler(
      geo.target.quaternion,
      -origin.latitude,
      origin.longitude,
      0
    );
    quat.identity(geo.eye.quaternion);

    geo.needsUpdate = true;
    if (this.props.debug) {
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }
}

export { GLView };
