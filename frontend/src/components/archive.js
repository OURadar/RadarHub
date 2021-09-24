//
//  archive.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/23/2021.
//

class Archive {
  constructor() {
    this.radar = "archive";
    this.data = {
      list: [],
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
      if (type == "message") {
        this.message = payload;
        setTimeout(() => {
          if (this.message == payload) {
            this.message = "";
            this.onupdate(this.tic++);
          }
        }, 2500);
      } else if (type == "load") {
        this.data.sweep = payload;
        console.log(this.data.sweep);
        this.message = "";
      } else if (type == "list") {
        this.data.list = payload;
      }
      this.onupdate(this.tic++);
    };

    this.load = this.load.bind(this);
    this.list = this.list.bind(this);
  }

  load(name) {
    this.message = `Loading ${name} ...`;
    this.onupdate(this.tic++);
    this.worker.postMessage({ task: "load", name: name });
  }

  list(day) {
    this.worker.postMessage({ task: "list", day: day });
  }
}

export { Archive };
