//
//  polygon.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Polygon {
  constructor() {
    this.busy = 0;
  }

  async load(name, geometry) {
    if (this.busy > 5) {
      console.log("Calling Polygon.load() too frequently.");
      return;
    }
    if (name === undefined) {
      console.log("Input for update() undefined.");
      return;
    }
    this.busy++;
    // Initialize a new worker for each load since they could happen in parallel
    const worker = new Worker("/static/frontend/loader.js");
    return new Promise((resolve) => {
      worker.onmessage = ({ data: { buffer } }) => {
        if (buffer) {
          resolve(buffer);
          this.busy--;
        }
      };
      worker.postMessage({
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
