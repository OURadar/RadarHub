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
  }

  draw() {
    if (
      this.state.projectionNeedsUpdate ||
      this.canvas.width != this.mount.offsetWidth ||
      this.canvas.height != this.mount.offsetHeight
    ) {
      this.updateProjection();
    }
    this.setState((state, props) => {
      this.regl.clear({
        color: props.colors.canvas,
      });
      this.earth([
        {
          modelview: state.view,
          projection: state.projection,
          viewport: state.viewport,
        },
      ]);
      this.picaso([
        {
          points: this.ring.points,
          width: 2.5,
          color: props.colors.lines[2],
          model: state.model,
          view: state.view,
          projection: state.projection,
          resolution: [this.canvas.width, this.canvas.height],
          segments: this.ring.points.length / 3 - 1,
          viewport: state.viewport,
        },
      ]);
      let c = state.satCoordinate;
      c[0] -= 0.003;
      if (c[0] < -Math.PI) {
        c[0] += 2 * Math.PI;
      }
      return {
        tic: state.tic + 1,
        satCoordinate: c,
      };
    });
    if (this.stats !== undefined) this.stats.update();
  }
}

export { Product };
