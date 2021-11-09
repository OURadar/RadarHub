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
      this.assets.palette = image;
      if (this.assets.colormap) {
        this.assets.colormap.destroy();
      }
      this.assets.colormap = this.regl.texture({
        data: image,
        wrapS: "clamp",
        wrapT: "clamp",
        premultiplyAlpha: true,
      });
      this.assets.index = 0.5 / this.assets.colormap.height;
      if (this.assets.data != null) this.assets.complete = true;
      this.load(this.colors)
    });
    this.colorbar = new Colorbar();
  }

  async load(colors) {
    this.colors = colors;

    const configs = {
      palette: this.assets.palette,
      style: this.makeStyle(symbol),
      time: "2013/05/20 19:00 UTC",
    }
    // Things
    const buffer = await this.colorbar.load()
  }
}

export { Dashboard };
