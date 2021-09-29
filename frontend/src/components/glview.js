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
    sweep: {
      na: 4,
      nr: 3,
      azimuth: [0.0, 1.0, 2.0, 3.0, 4.0],
      values: new Uint8Array([20, 25, 30, 10, 20, 15, 50, 60, 50, 80, 90, 100]),
    },
  };

  componentDidMount() {
    this.mount.appendChild(this.canvas);
    if (this.stats !== undefined) {
      this.mount.appendChild(this.stats.domElement);
    }
    // fetch("static/images/colormap.png", { cache: "no-cache" })
    //   .then((response) => response.blob())
    //   .then((blob) => {
    //     this.colormap = this.regl.texture({
    //       data: blob,
    //       min: "nearest",
    //       mag: "nearest",
    //       wrapS: "clamp",
    //       wrapT: "clamp",
    //     });
    //     console.log(this.colormap);
    //   });

    var image = new Image();
    image.src = "static/images/colormap.png";
    image.addEventListener("load", () => {
      this.colormap = this.regl.texture(image);
      console.log(this.colormap);
    });

    this.updateData();

    this.updateProjection();
    this.regl.frame(this.draw);
  }

  updateData() {
    let points = [];
    let origins = [];
    let indices = [];
    const sweep = this.props.sweep;
    const e = common.deg2rad(4.0);
    const r = sweep.nr * 80.0;
    const rce = r * Math.cos(e);
    const rse = r * Math.sin(e);
    for (let k = 0, l = sweep.na; k < l; k++) {
      const a = common.deg2rad(sweep.azimuth[k]);
      const v = (k + 0.5) / l;
      const x = rce * Math.sin(a);
      const y = rce * Math.cos(a);
      points.push(x, y, rse);
      points.push(0.1 * x, 0.1 * y, 0.1 * rse);
      origins.push(0, v);
      origins.push(1, v);
    }
    let k = sweep.na;
    const a = common.deg2rad(sweep.azimuth[k]);
    const v = (k - 0.5) / sweep.na;
    const x = rce * Math.sin(a);
    const y = rce * Math.cos(a);
    points.push(x, y, rse);
    points.push(0.1 * x, 0.1 * y, 0.1 * rse);
    origins.push(0, v);
    origins.push(1, v);

    for (let o = 2, l = 2 * sweep.na; o <= l; o += 2) {
      indices.push(o - 2, o - 1, o);
      indices.push(o - 1, o, o + 1);
    }
    this.data = {
      points,
      origins,
      indices,
    };
    console.log(this.data);
    this.dataTexture = this.regl.texture({
      shape: [sweep.nr, sweep.na],
      data: sweep.values,
      format: "luminance",
    });
    console.log(this.dataTexture);
    console.log("data updated");
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
    if (this.colormap && this.dataTexture)
      this.umbrella({
        modelview: geo.modelview,
        projection: geo.projection,
        viewport: geo.viewport,
        points: this.data.points,
        elements: this.data.indices,
        origins: this.data.origins,
        colormap: this.colormap,
        data: this.dataTexture,
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
    const mag = 1 + geo.aspect * (m - 1);
    geo.fov = common.clamp(geo.fov / mag, 0.001, 0.4 * Math.PI);
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
