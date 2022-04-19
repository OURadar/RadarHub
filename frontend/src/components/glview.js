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
    const v = vec3.fromValues(0, 0, common.earthRadius);
    const e = vec3.fromValues(0, 0, 0.2 * common.earthRadius);
    const f = 1.0;

    // The radar
    let model = mat4.create();
    let quaternion = quat.create();
    quat.fromEuler(quaternion, -origin.latitude, origin.longitude, 0);
    mat4.fromQuat(model, quaternion);
    mat4.translate(model, model, v);

    // The target (little red sphere)
    let targetModel = mat4.clone(model);
    let targetTranslation = vec3.create();
    let targetQuaternion = quat.create();
    let targetScale = vec3.create();
    mat4.scale(targetModel, targetModel, [0.03, 0.03, 0.03]);
    mat4.getTranslation(targetTranslation, targetModel);
    mat4.getRotation(targetQuaternion, targetModel);
    mat4.getScaling(targetScale, targetModel);

    // The eye (cone) relative to target
    let eyeModel = mat4.clone(model);
    let eyeTranslation = vec3.create();
    let eyeQuaternion = quat.create();
    let eyeScale = vec3.create();
    let d = vec3.length(e);
    let b = d * f;
    mat4.translate(eyeModel, eyeModel, e);
    mat4.scale(eyeModel, eyeModel, [b, b, d]);
    mat4.getTranslation(eyeTranslation, eyeModel);
    mat4.getRotation(eyeQuaternion, eyeModel);
    mat4.getScaling(eyeScale, eyeModel);

    let fixView = mat4.create();
    let fixModel = mat4.create();
    let fixPosition = mat4.create();
    let fixProjection = mat4.create();
    let fixTranslation = vec3.fromValues(0, 0, 2 * common.earthRadius);
    // mat4.fromQuat(fixModel, quaternion);
    mat4.translate(fixModel, fixModel, fixTranslation);
    mat4.getTranslation(fixPosition, fixModel);
    mat4.lookAt(fixView, fixPosition, [0, 0, 0], [0, 1, 0]);
    mat4.perspective(fixProjection, 1.2, 1, 100, 30000);

    // Important parameters for WebGL. Don't want to use React state
    this.geometry = {
      // fov: 0.028,
      origin: origin,
      quaternion: quaternion,
      eye: {
        range: vec3.length(eyeTranslation),
        model: eyeModel,
        modelview: mat4.create(),
        quaternion: eyeQuaternion,
        translation: eyeTranslation,
        scale: eyeScale,
        up: vec3.fromValues(0, 1, 0),
      },
      target: {
        range: common.earthRadius,
        model: targetModel,
        modelview: mat4.create(),
        quaternion: targetQuaternion,
        translation: targetTranslation,
        scale: targetScale,
      },
      fix: {
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
      fov: f,
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
      longitude: 30.0,
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

    // let q = geo.target.quaternion;
    // let v = geo.target.translation;
    // let s = geo.target.scale;
    // mat4.fromRotationTranslationScale(geo.target.model, q, v, s);

    // q = geo.eye.quaternion;
    // v = geo.eye.translation;
    // s = geo.eye.scale;
    // mat4.fromRotationTranslationScale(geo.eye.model, q, v, s);

    let u = vec3.fromValues(
      geo.eye.model[4],
      geo.eye.model[5],
      geo.eye.model[6]
    );

    mat4.lookAt(geo.view, geo.eye.translation, geo.target.translation, u);
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

    this.monet({
      width: 2.5,
      color: [1.0, 0.3, 0.7, 1.0],
      model: geo.model,
      quad: [0.0, 1.0, 0.5, 1.0],
      view: geo.fix.view,
      projection: geo.fix.projection,
      resolution: [geo.fix.viewport.width, geo.fix.viewport.height],
      viewport: geo.fix.viewport,
      points: this.rings.points,
      segments: this.rings.count,
    });

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
    // const s = (geo.fov / common.earthRadius) * 2.0;
    const s = (geo.fov / common.earthRadius) * 1.1;
    let deltaX = (-x / this.mount.clientWidth) * s;
    let deltaY = (y / this.mount.clientHeight) * s;

    let u = vec3.fromValues(
      geo.eye.model[0],
      geo.eye.model[1],
      geo.eye.model[2]
    );
    let v = vec3.fromValues(
      geo.eye.model[4],
      geo.eye.model[5],
      geo.eye.model[6]
    );
    let p = quat.setAxisAngle([], u, deltaY);
    let q = quat.setAxisAngle([], v, deltaX);

    quat.multiply(p, q, p);

    let m = mat4.fromQuat([], p);

    mat4.multiply(geo.eye.model, m, geo.eye.model);
    mat4.multiply(geo.target.model, m, geo.target.model);

    // mat4.getRotation(geo.eye.quaternion, geo.eye.model);
    mat4.getTranslation(geo.eye.translation, geo.eye.model);

    // mat4.getRotation(geo.target.quaternion, geo.target.model);
    mat4.getTranslation(geo.target.translation, geo.target.model);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message +=
        ` delta (${x}, ${y}) ` +
        `-> (${deltaX.toFixed(3)}, ${deltaY.toFixed(3)})` +
        `-> ${s.toFixed(5)}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  tilt(x, y) {
    const geo = this.geometry;
    const z = 1.0 / (0.2 * common.earthRadius);
    let deltaX = (-x / this.mount.clientWidth) * z;
    let deltaY = (y / this.mount.clientHeight) * z;

    let u = vec3.fromValues(
      geo.eye.model[0],
      geo.eye.model[1],
      geo.eye.model[2]
    );
    let v = mat4.getTranslation([], geo.model);

    let a = quat.setAxisAngle([], u, deltaY);
    let b = quat.setAxisAngle([], v, deltaX);

    let q = geo.eye.quaternion;
    let t = geo.eye.translation;
    let s = geo.eye.scale;

    let m = mat4.fromQuat([], a);
    let n = mat4.fromQuat([], b);

    mat4.multiply(geo.eye.model, n, geo.eye.model);

    quat.multiply(q, a, q);
    quat.multiply(q, b, q);
    mat4.getTranslation(t, geo.eye.model);
    mat4.fromRotationTranslationScale(geo.eye.model, q, t, s);

    mat4.multiply(geo.eye.model, m, geo.eye.model);

    mat4.getRotation(geo.eye.quaternion, geo.eye.model);
    mat4.getTranslation(geo.eye.translation, geo.eye.model);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message += ` tilt() delta = ${deltaX.toFixed(2)}, ${deltaY.toFixed(
        2
      )}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  roll(x, y) {
    const geo = this.geometry;
    let deltaX = (x / this.mount.clientWidth) * 2.0;
    let u = quat.setAxisAngle([], [0.0, 0.0, 1.0], deltaX);

    let q = geo.eye.quaternion;
    let t = geo.eye.translation;
    let s = geo.eye.scale;

    quat.multiply(q, q, u);
    mat4.fromRotationTranslationScale(geo.eye.model, q, t, s);

    geo.needsUpdate = true;
  }

  tap(x, y) {}

  taptap(x, y) {
    this.fitToData();
  }

  magnify(_mx, _my, m, _x, _y) {
    const geo = this.geometry;
    geo.fov = common.clamp(geo.fov / m, 0.005, 0.65 * Math.PI);
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

    // const origin = geo.origin;
    // quat.fromEuler(geo.quaternion, -origin.latitude, origin.longitude, 0);

    const v = vec3.fromValues(0, 0, common.earthRadius);
    const e = vec3.fromValues(0, 0, 0.2 * common.earthRadius);

    // mat4.fromQuat(geo.target.model, geo.quaternion);
    mat4.copy(geo.target.model, geo.model);
    mat4.scale(geo.target.model, geo.target.model, [0.03, 0.03, 0.03]);
    mat4.getRotation(geo.target.quaternion, geo.target.model);
    mat4.getTranslation(geo.target.translation, geo.target.model);

    let d = vec3.length(e);
    let b = d * geo.fov;

    mat4.copy(geo.eye.model, geo.model);
    mat4.translate(geo.eye.model, geo.eye.model, e);
    mat4.scale(geo.eye.model, geo.eye.model, [b, b, d]);
    mat4.getRotation(geo.eye.quaternion, geo.eye.model);
    mat4.getTranslation(geo.eye.translation, geo.eye.model);

    geo.needsUpdate = true;
    if (this.props.debug) {
      this.setState({
        lastMagnifyTime: window.performance.now(),
      });
    }
  }
}

export { GLView };
