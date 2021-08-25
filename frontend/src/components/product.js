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
    this.water = artists.element3(this.regl);

    // Bind some methods
    this.magnify = this.magnify.bind(this);
    this.fitToData = this.fitToData.bind(this);
    // User interaction
    this.gesture.bounds = this.constants.bounds;
    this.gesture.handleMagnify = this.magnify;
    this.gesture.handleDoubleTap = this.fitToData;

    let points = [];
    for (let k = 0; k < 2 * Math.PI; k += Math.PI / 18) {
      points.push([5.0 * Math.sin(k), 5.0 * Math.cos(k), 1.0]);
    }
    this.ring = {
      points: points.flat(),
    };
    // Just an incubation space for now, will eventually move all of these to seprate class
    points = [];
    const latCount = 17;
    const lonCount = 36;
    var lat = (0.5 - 0.5 / latCount) * Math.PI;
    const radius = 10.0;
    for (let j = 0; j < latCount; j++) {
      for (let k = 0; k < lonCount; k++) {
        const lon = (k * 2 * Math.PI) / lonCount;
        //console.log((lat / Math.PI) * 180, (lon / Math.PI) * 180);
        points.push([
          radius * Math.cos(lat) * Math.sin(lon),
          radius * Math.sin(lat),
          radius * Math.cos(lat) * Math.cos(lon),
        ]);
      }
      lat -= Math.PI / latCount;
    }
    let latElements = [];
    for (let k = 0; k < latCount; k++) {
      latElements.push(
        Array.from(Array(lonCount), (_, j) => [
          k * lonCount + j,
          k * lonCount + ((j + 1) % lonCount),
        ])
      );
    }
    let lonElements = [];
    for (let k = 0; k < lonCount; k++) {
      //lonElements.push(Array.from(Array(latCount), (_, j) => k + j * lonCount));
      lonElements.push(
        Array.from(Array(latCount - 1), (_, j) => [
          k + j * lonCount,
          k + (j + 1) * lonCount,
        ])
      );
    }
    this.grid = {
      points: points,
      latElements: latElements.flat(),
      lonElements: lonElements.flat(),
    };
    // console.log(this.grid.points);
    console.log(this.grid.latElements);
    console.log(this.grid.lonElements);
  }

  updateProjection() {
    this.canvas.width = this.mount.offsetWidth;
    this.canvas.height = this.mount.offsetHeight;
    this.setState(() => {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const aspectRatio = w / h;
      const p = mat4.perspective([], Math.PI / 4, aspectRatio, 0.1, 1000.0);
      const mv = mat4.lookAt([], [0, 25, 25.0], [0, 0, 0], [0, 1, 0]);
      const mvp = mat4.multiply([], p, mv);
      return {
        projection: mvp,
        viewport: { x: 0, y: 0, width: w, height: h },
      };
    });
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
      this.water([
        {
          primitive: "lines",
          color: props.colors.lines[1],
          projection: state.projection,
          viewport: state.viewport,
          points: this.grid.points,
          elements: this.grid.latElements,
        },
        {
          primitive: "lines",
          color: props.colors.lines[1],
          projection: state.projection,
          viewport: state.viewport,
          points: this.grid.points,
          elements: this.grid.lonElements,
        },
      ]);
      return {
        tic: state.tic + 1,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }

  // pan() {}

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
