//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { mat4 } from "gl-matrix";

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Texture } from "./texture";
import { GLView } from "./glview";

//
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends GLView {
  constructor(props) {
    super(props);
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
      ...this.state,
      scaleX: 1 / 2,
      scaleY: 1 / 2,
      camera: mat4.create(),
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
    this.gogh = artists.sprite(this.regl);
    this.art = artists.basic3(this.regl);
    // Bind some methods
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture.bounds = this.constants.bounds;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleDoubleTap = this.fitToData;

    let points = [];
    for (let k = 0; k < 360; k += 10) {
      let theta = (k / 180) * Math.PI;
      points.push([10.0 * Math.sin(theta), 10.0 * Math.cos(theta), 1.0]);
    }
    this.ring = {
      points: points.flat(),
    };
    console.log(this.ring.points);
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    this.setState((state, props) => {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const aspectRatio = w / h;
      const range = 5;
      // const p = mat4.ortho(mat4.create(), -ww, ww, -hh, hh, 0, -1);
      const p = mat4.perspective([], Math.PI / 4, aspectRatio, 1.0, 6000.0);
      const mv = mat4.lookAt([], [0, 0, 100.0], [0, 1, 0], [0, 1, 0]);
      const mvp = mat4.multiply([], p, mv);
      const grid = this.makeGrid();
      return {
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
      [-w, this.state.offsetY + 0.5],
      [+w, this.state.offsetY + 0.5],
      [this.state.offsetX + 0.5, -h],
      [this.state.offsetX + 0.5, +h],
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
      this.art([
        {
          primitive: "line loop",
          color: props.colors.lines[2],
          projection: state.projection,
          viewport: state.viewport,
          points: this.ring.points,
          count: this.ring.points.length / 3,
        },
      ]);
      // this.monet([
      //   {
      //     primitive: "line loop",
      //     color: props.colors.lines[2],
      //     projection: state.screen,
      //     viewport: state.viewport,
      //     points: this.ring.points,
      //     count: this.ring.points.length / 2,
      //   },
      // ]);
      // this.monet([
      //   {
      //     primitive: "lines",
      //     color: props.colors.grid,
      //     projection: state.screen,
      //     viewport: state.viewport,
      //     points: state.grid,
      //     count: state.grid.length / 2,
      //   },
      // ]);

      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }
  //pan() {}

  magnify() {
    // console.log("magnify()");
    return;
  }

  fitToData() {
    // console.log("fitToData()");
    return;
  }
}

export { Product };
