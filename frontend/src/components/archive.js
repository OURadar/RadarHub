//
//  archive.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/23/2021.
//

class Archive {
  constructor() {
    this.data = {
      sweep: {
        az: [],
        el: [],
        values: [],
      },
    };
    this.tic = 0;
    this.message = "";
    this.response = "";
    this.onupdate = (_data) => {};

    this.worker = new Worker("/static/frontend/archive.js");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "data") {
        this.data.sweep = payload;
        this.onupdate(this.data.sweep);
      }
    };
  }

  load(name) {
    this.worker.postMessage({ task: "load", name: name });
  }
}

export { Archive };
