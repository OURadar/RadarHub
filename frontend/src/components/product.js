//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import * as common from "./common";
import * as artists from "./artists";
import * as instanced from "./instanced";
import { Texture } from "./texture";
import { GLView } from "./glview";
import { Overlay } from "./overlay";
import { mat4, vec3 } from "gl-matrix";

//
// Use as <Product data={input} />
//
// More later ... I can't see pass here
//

class Product extends GLView {
  constructor(props) {
    super(props);
    this.texture = new Texture(
      this.regl,
      this.props.textureScale,
      props.debugGL
    );
    this.overlay = new Overlay(this.regl);
    this.andy = instanced.instancedLines(this.regl, 6);
  }

  draw() {
    if (
      this.state.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
      // this.canvas.width = this.mount.offsetWidth;
      // this.canvas.height = this.mount.offsetHeight;
      // const w = this.canvas.width;
      // const h = this.canvas.height;
      // const c = this.state.satCoordinate;
      // const x = c[2] * Math.cos(c[1]) * Math.sin(c[0]);
      // const y = c[2] * Math.sin(c[1]);
      // const z = c[2] * Math.cos(c[1]) * Math.cos(c[0]);
      // const satPosition = vec3.fromValues(x, y, z);
      // const view = mat4.lookAt([], satPosition, [0, 0, 0], [0, 1, 0]);
      // this.state.view = view;
      // this.state.modelview = mat4.multiply([], view, this.state.model);
      // this.state.projection = mat4.perspective(
      //   [],
      //   this.state.fov,
      //   w / h,
      //   100,
      //   30000.0
      // );
    }
    this.setState((state, props) => {
      this.regl.clear({
        color: props.colors.canvas,
      });
      this.sphere([
        {
          modelview: state.view,
          projection: state.projection,
          viewport: state.viewport,
        },
      ]);
      //let projection = mat4.multiply([], state.projection, state.modelview);

      this.andy({
        width: 5,
        color: [0.5, 0.5, 0.5, 0.7],
        model: state.model,
        view: state.view,
        projection: state.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: state.viewport,
        points: this.ring.points2,
        segments: this.ring.points2.length / 6,
      });
      // this.art({
      //   color: props.colors.lines[5],
      //   projection: projection,
      //   points: this.ring.points2,
      //   primitive: "lines",
      //   viewport: state.viewport,
      //   count: this.ring.points2.length / 3,
      // });
      if (this.overlay.ready) {
        this.andy({
          width: 1.8,
          color: [0.5, 0.5, 0.5, 0.7],
          model: state.identityMatrix,
          view: state.view,
          projection: state.projection,
          resolution: [this.canvas.width, this.canvas.height],
          viewport: state.viewport,
          points: this.overlay.points,
          segments: this.overlay.count,
        });
      }

      let c = state.satCoordinate;
      c[0] -= 0.003;
      // if (c[0] < -Math.PI) {
      //   c[0] += 2 * Math.PI;
      // }
      return {
        tic: state.tic + 1,
        satCoordinate: c,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }
}

export { Product };
