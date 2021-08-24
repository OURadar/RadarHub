//
//  glview.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4 } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import { Gesture } from "./gesture";
import { Texture } from "./texture";

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
    this.texture = new Texture(
      this.regl,
      this.props.textureScale,
      props.debugGL
    );
    this.state = {
      tic: 0,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      screen: mat4.create(),
      projection: mat4.create(),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      grid: [0, 0],
    };
    // Our artists
    this.monet = artists.basic(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.makeGrid = this.makeGrid.bind(this);
    this.draw = this.draw.bind(this);
    this.pan = this.pan.bind(this);
    // User interaction
    this.gesture = new Gesture(this.canvas, null);
    this.gesture.handlePan = this.pan;
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
      const str = this.gesture.message;
      return (
        <div className="fill">
          <div className="fill" ref={(x) => (this.mount = x)} />
          <div className="debug">
            <div className="leftPadded">{str}</div>
          </div>
        </div>
      );
    }
    return <div className="fill" ref={(x) => (this.mount = x)} />;
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    this.setState((state, props) => {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const p = mat4.ortho(mat4.create(), 0, w, 0, h, 0, -1);
      const mv = mat4.fromValues(
        state.scaleX * w,
        0,
        0,
        0,
        0,
        state.scaleY * h,
        0,
        0,
        0,
        0,
        1,
        0,
        state.offsetX,
        state.offsetY,
        0,
        1
      );
      const mvp = mat4.multiply([], p, mv);
      const grid = this.makeGrid();
      return {
        screen: p,
        projection: mvp,
        grid: grid,
        viewport: { x: 0, y: 0, width: w, height: h },
      };
    });
  }

  makeGrid() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const grid = [
      [0, this.state.offsetY + h / 2 + 0.5],
      [w, this.state.offsetY + h / 2 + 0.5],
      [this.state.offsetX + w / 2 + 0.5, 0],
      [this.state.offsetX + w / 2 + 0.5, h],
    ];
    return grid.flat();
  }

  draw() {
    if (
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    this.setState((state, props) => {
      this.regl.clear({
        color: props.colors.canvas,
      });

      this.monet([
        {
          primitive: "lines",
          color: props.colors.grid,
          projection: state.screen,
          viewport: state.viewport,
          points: state.grid,
          count: state.grid.length / 2,
        },
      ]);

      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }

  pan(x, y) {
    this.setState((state) => ({
      offsetX: state.offsetX + x,
      offsetY: state.offsetY + y,
    }));
    this.updateProjection();
  }
}

export { GLView };
