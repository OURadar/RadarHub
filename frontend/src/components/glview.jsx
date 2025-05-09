//
//  glview.js - WebGL 3D View
//  RadarHub
//
//  This is a view
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
    this.gravity = props.gravity;
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
    };
    this.state = {
      tic: 0,
      message: "glView",
    };
    // Important parameters for WebGL. Don't want to use React state
    // Convention:
    // Root elements (model, quaternion, translation, scale) for radar
    // Other levels (eye, target, fix) are for the named element
    // Key elements of geometry:
    //  - model = model matrix for product, rings, radar-relative drawings
    //  - view = view matrix derived from eye
    //  - projection = projection matrix to GL view
    const r = 150;
    let fixView = mat4.create();
    let fixProjection = mat4.create();
    let fixTranslation = vec3.fromValues(0, 0, 2 * common.earthRadius);
    mat4.lookAt(fixView, fixTranslation, [0, 0, 0], [0, 1, 0]);
    mat4.perspective(fixProjection, 1, 1, 1, 30000);
    this.geometry = {
      origin: {
        longitude: 0,
        latitude: 0,
      },
      quaternion: quat.create(),
      eye: {
        range: r,
        model: mat4.create(),
        modelview: mat4.create(),
        quaternion: quat.create(),
        translation: vec3.create(),
        scale: vec3.create(),
      },
      target: {
        range: common.earthRadius,
        model: mat4.create(),
        modelview: mat4.create(),
        quaternion: quat.create(),
        translation: vec3.create(),
        scale: vec3.fromValues(0.03, 0.03, 0.03),
      },
      fix: {
        view: fixView,
        model: mat4.create(),
        projection: fixProjection,
        viewport: {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      },
      fov: 1,
      range: r,
      aspect: 1,
      zenith: 0.01,
      model: mat4.create(),
      view: mat4.create(),
      modelview: mat4.create(),
      projection: mat4.create(),
      viewprojection: mat4.create(),
      orthoprojection: mat4.ortho([], 0, 1, 0, 1, 0, 1),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      // dashport: { x: 0, y: 100, width: 1000, height: 1000 },
      pixelDensity: 1,
      pointDensity: 1,
      needsUpdate: true,
      message: "geo",
    };
    // Our artists
    this.picaso = artists.simplifiedInstancedLines(this.regl);
    this.monet = artists.instancedLines(this.regl, 0);
    this.gogh = artists.instancedPatches(this.regl);
    this.vinci = artists.texturedElements(this.regl);
    this.raphael = artists.texturedElementsTicToc(this.regl);
    this.basic = artists.basic(this.regl);
    this.basic3 = artists.basic3(this.regl);
    this.sphere = artists.sphere(this.regl);
    this.sphere2 = artists.sphere2(this.regl);
    this.element3 = artists.element3(this.regl);
    this.michelangelo = artists.rect2(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.updateOrigin = this.updateOrigin.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    this.tilt = this.tilt.bind(this);
    this.roll = this.roll.bind(this);
    this.dolly = this.dolly.bind(this);
    this.tap = this.tap.bind(this);
    this.taptap = this.taptap.bind(this);
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, this.constants.bounds);
    this.gesture.handlePan = this.pan;
    this.gesture.handleTilt = this.tilt;
    this.gesture.handleRoll = this.roll;
    this.gesture.handleDolly = this.dolly;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleSingleTap = this.tap;
    this.gesture.handleDoubleTap = this.taptap;
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
      longitude: 20.0,
      latitude: 10.0,
    },
    gravity: "right",
    sx: {
      pt: 7,
      pb: 7,
    },
  };

  componentDidMount() {
    this.mount.appendChild(this.canvas);
    if (this.stats !== undefined) {
      this.mount.appendChild(this.stats.domElement);
    }
    this.updateOrigin(this.props.origin.longitude, this.props.origin.latitude);
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

  updateOrigin(longitude, latitude) {
    const geo = this.geometry;
    const v = vec3.fromValues(0, 0, common.earthRadius);

    quat.fromEuler(geo.quaternion, -latitude, longitude, 0.0);
    mat4.fromQuat(geo.model, geo.quaternion);
    mat4.translate(geo.model, geo.model, v);

    geo.origin.longitude = longitude;
    geo.origin.latitude = latitude;

    this.fitToData();
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth * this.ratio;
    this.canvas.height = this.mount.offsetHeight * this.ratio;
    const geo = this.geometry;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = geo.target.translation;
    const e = geo.eye.translation;

    let v = vec3.subtract([], e, t);
    let n = common.ndot(v, t);

    geo.aspect = w / h;
    geo.zenith = Math.acos(n);
    geo.pixelDensity = geo.eye.scale[1] / h / n ** 1.5;
    geo.pointDensity = geo.pixelDensity * this.ratio;

    let u = vec3.fromValues(geo.eye.model[4], geo.eye.model[5], geo.eye.model[6]);
    // vec3.normalize(u, u);
    // console.log(common.vec3String(u));

    mat4.lookAt(geo.view, e, t, u);
    mat4.perspective(geo.projection, geo.fov, geo.aspect, 1, 30000);

    mat4.multiply(geo.eye.modelview, geo.fix.view, geo.eye.model);
    mat4.multiply(geo.target.modelview, geo.fix.view, geo.target.model);

    mat4.multiply(geo.modelview, geo.view, geo.model);
    mat4.multiply(geo.viewprojection, geo.projection, geo.view);

    const ww = Math.round(h / 3);
    geo.fix.viewport.width = ww;
    geo.fix.viewport.height = ww;
    geo.fix.viewport.x = w - ww - 5 * this.ratio;
    geo.fix.viewport.y = 5 * this.ratio;

    geo.viewport.width = w;
    geo.viewport.height = h;
    geo.message = "geo";

    // console.log(`zenith = ${geo.zenith.toFixed(2)}`);

    geo.needsUpdate = false;
  }

  draw() {
    if (this.mount === null) return;
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
      quad: [0.0, 1.0, 0.5, 1.0],
      model: geo.model,
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
    const s = (2.0 * Math.tan(0.5 * geo.fov)) / common.earthRadius;
    let deltaX = (-x / this.mount.clientHeight) * s;
    let deltaY = (y / this.mount.clientHeight) * s;
    let m = geo.eye.model;
    let u = vec3.fromValues(m[0], m[1], m[2]);
    let v = vec3.fromValues(m[4], m[5], m[6]);
    let p = quat.setAxisAngle([], u, deltaY);
    let q = quat.setAxisAngle([], v, deltaX);

    quat.multiply(p, q, p);
    let r = mat4.fromQuat([], p);

    mat4.multiply(geo.eye.model, r, geo.eye.model);
    mat4.multiply(geo.target.model, r, geo.target.model);

    mat4.getTranslation(geo.eye.translation, geo.eye.model);
    mat4.getRotation(geo.eye.quaternion, geo.eye.model);

    mat4.getTranslation(geo.target.translation, geo.target.model);
    mat4.getRotation(geo.target.quaternion, geo.target.model);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message += ` delta (${x}, ${y}) ` + `-> (${deltaX.toFixed(3)}, ${deltaY.toFixed(3)})` + `-> ${s.toFixed(5)}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  tilt(x, y) {
    // console.log(`tilt() ${x} ${y}`);
    const geo = this.geometry;
    const z = 1.0 / (0.2 * common.earthRadius);
    let deltaX = (-x / this.mount.clientWidth) * z;
    let deltaY = (y / this.mount.clientHeight) * z;

    let u = vec3.fromValues(geo.eye.model[0], geo.eye.model[1], geo.eye.model[2]);
    // console.log(
    //   `zenith = ${geo.zenith}` +
    //     `  y = ${y}` +
    //     `  deltaY = ${deltaY}` +
    //     `  ${u[2].toFixed(2)}`
    // );
    let d = geo.target.translation;
    let q = geo.eye.quaternion;
    let t = geo.eye.translation;
    let s = geo.eye.scale;

    let a = quat.setAxisAngle([], u, deltaY);
    let b = quat.setAxisAngle([], d, deltaX);

    if (deltaY < 0 && geo.zenith + deltaY * 2 * common.earthRadius < 0) {
      quat.copy(q, b);
    } else {
      quat.multiply(q, a, b);
    }

    let m = mat4.fromQuat([], q);
    let n = mat4.multiply([], m, geo.eye.model);

    mat4.getRotation(q, n);
    mat4.getTranslation(t, n);
    mat4.targetTo(n, t, d, d);
    mat4.scale(geo.eye.model, n, s);

    geo.needsUpdate = true;
    if (this.props.debug) {
      geo.message += ` tilt() ${deltaX.toFixed(2)}, ${deltaY.toFixed(2)}`;
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
    if (this.props.debug) {
      geo.message += ` roll() ${deltaX.toFixed(2)}`;
      this.setState({
        lastPanTime: window.performance.now(),
      });
    }
  }

  dolly(_mx, _my, m, _x, _y) {
    const geo = this.geometry;
    let q = geo.eye.quaternion;
    let t = geo.eye.translation;
    let s = geo.eye.scale;
    let d = vec3.subtract([], t, geo.target.translation);
    let r = vec3.length(d);
    let n = common.clamp(r / m, 5, 1.2 * common.earthRadius);
    vec3.scale(d, d, n / r);

    // let b = r * geo.fov;
    // vec3.set(s, b, b, r);
    vec3.set(s, r, r, r);
    geo.eye.range = r;

    vec3.add(t, geo.target.translation, d);
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
    let q = geo.eye.quaternion;
    let t = geo.eye.translation;
    let s = geo.eye.scale;
    let d = vec3.subtract([], t, geo.target.translation);
    let l = vec3.length(d);
    let b = l * geo.fov;
    vec3.set(s, b, b, l);
    mat4.fromRotationTranslationScale(geo.eye.model, q, t, s);

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

    geo.fov = 1;

    const r = geo.range;
    const s = geo.eye.scale;
    const e = vec3.fromValues(0, -0.01, r);

    mat4.copy(geo.target.model, geo.model);
    mat4.scale(geo.target.model, geo.target.model, geo.target.scale);
    mat4.getTranslation(geo.target.translation, geo.target.model);
    mat4.getRotation(geo.target.quaternion, geo.target.model);

    // let b = r * geo.fov;
    // vec3.set(s, b, b, r);
    vec3.set(s, r, r, r);
    mat4.copy(geo.eye.model, geo.model);
    mat4.translate(geo.eye.model, geo.eye.model, e);
    mat4.scale(geo.eye.model, geo.eye.model, s);
    mat4.getTranslation(geo.eye.translation, geo.eye.model);
    mat4.getRotation(geo.eye.quaternion, geo.eye.model);

    geo.needsUpdate = true;
  }
}

export { GLView };
