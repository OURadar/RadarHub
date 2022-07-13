//
//  polygon.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

class Polygon {
  constructor() {
    this.worker = new Worker(new URL("./polygon.worker.js", import.meta.url));
  }

  async load(name, thin, geometry) {
    if (this.busy) {
      console.log("Calling Polygon.load() too frequently.");
      return new Promise((resolve) => {
        resolve(null);
      });
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
          thin: thin,
          model: geometry.model,
          origin: geometry.origin,
        },
      });
    });
  }
}

export { Polygon };
