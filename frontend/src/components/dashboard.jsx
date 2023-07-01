//
//  dashboard.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { Colorbar } from "./colorbar";

class Dashboard {
  constructor(regl, colors, geometry) {
    this.regl = regl;
    this.colors = colors;
    this.geometry = geometry;
    this.ratio = window.devicePixelRatio > 1 ? 2 : 1;

    var image = new Image();
    image.src = "/static/images/colormap.png";
    image.addEventListener("load", () => {
      this.palette = image;
      this.assets.colormap = this.regl.texture({
        data: image,
        wrapS: "clamp",
        wrapT: "clamp",
        premultiplyAlpha: true,
      });
      this.assets.index = 0.5 / this.assets.colormap.height;
      if (this.assets.data != null) this.assets.complete = true;
    });
    this.colorbar = new Colorbar();
  }
}

export { Dashboard };
