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
    this.andy = instanced.instancedLines(this.regl, 4);
  }

  draw() {
    if (
      this.graphics.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    const graph = this.graphics;
    this.regl.clear({
      color: this.props.colors.canvas,
    });
    this.sphere({
      modelview: graph.view,
      projection: graph.projection,
      viewport: graph.viewport,
    });
    //let projection = mat4.multiply([], state.projection, state.modelview);

    this.andy({
      width: 5,
      color: [0.5, 0.5, 0.5, 0.7],
      model: graph.model,
      view: graph.view,
      projection: graph.projection,
      resolution: [this.canvas.width, this.canvas.height],
      viewport: graph.viewport,
      points: this.ring.points2,
      segments: this.ring.points2.length / 6,
    });
    if (this.overlay.ready) {
      this.andy({
        width: 1.8,
        color: [0.5, 0.5, 0.5, 0.7],
        model: graph.identityMatrix,
        view: graph.view,
        projection: graph.projection,
        resolution: [this.canvas.width, this.canvas.height],
        viewport: graph.viewport,
        points: this.overlay.points,
        segments: this.overlay.count,
      });
    }

    graph.satCoordinate[0] -= 0.003;
    if (this.stats !== undefined) this.stats.update();
  }
}

export { Product };
