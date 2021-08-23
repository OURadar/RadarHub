//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Stats from "stats-js";
import { mat4 } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Gesture } from "./gesture";
import { Texture } from "./texture";

//
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends Component {
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
      scaleX: 1 / 1000,
      scaleY: 1 / 60000,
      offsetX: 0,
      offsetY: 0,
      screen: mat4.create(),
      projection: mat4.create(),
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      grid: [0, 0],
      labelParameters: {
        labels: [],
        positions: [],
        alignments: [],
        foreground: props.colors.foreground,
        colors: [],
        sizes: [],
        countX: 0,
        countY: 0,
      },
    };
    // Our artists
    this.picaso = instanced.noninterleavedStripRoundCapJoin(this.regl, 8);
    this.monet = artists.basic(this.regl);
    this.gogh = artists.sprite(this.regl);
    // Bind some methods
    this.updateProjection = this.updateProjection.bind(this);
    this.makeGrid = this.makeGrid.bind(this);
    this.draw = this.draw.bind(this);
    // this.pan = this.pan.bind(this);
    // this.magnify = this.magnify.bind(this);
    // this.fitToData = this.fitToData.bind(this);
    // User interaction
    // this.gesture = new Gesture(this.canvas, this.constants.bounds);
    // this.gesture.handlePan = this.pan;
    // this.gesture.handleMagnify = this.magnify;
    // this.gesture.handleDoubleTap = this.fitToData;
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

  componentWillUnmount() {
    console.log("Record something at home server or something ...");
  }

  render() {
    if (this.props.debug === true) {
      // const str = this.gesture.message;
      const str = "";
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
  }

  makeGrid() {}

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

      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }
}

export { Product };
