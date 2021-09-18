//
//  polygon.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Polygon {
  constructor() {
    this.busy = false;
    this.worker = new Worker("/static/frontend/polygon.js");
  }

  async load(name, geometry) {
    if (this.busy) {
      console.log("Calling Polygon.load() too frequently.");
      return;
    }
    if (name === undefined) {
      console.log("Input for update() undefined.");
      return;
    }
    this.busy = true;
    return new Promise((resolve) => {
      this.worker.onmessage = ({ data: { buffer } }) => {
        if (buffer) {
          resolve(buffer);
          this.busy = false;
        }
      };
      this.worker.postMessage({
        type: "poly",
        payload: {
          name: name,
          model: geometry.model,
          origin: geometry.origin,
        },
      });
    });
  }
}

export { Polygon };
