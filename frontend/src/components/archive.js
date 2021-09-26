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
        name: "",
        values: [],
      },
      index: -1,
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
        const message = `${payload.name} loaded`;
        this.message = message;
        setTimeout(() => {
          if (this.message == message) {
            this.message = "";
            this.onupdate(this.tic++);
          }
        }, 2000);
      } else if (type == "list") {
        this.data.list = payload;
        this.data.index = -1;
        this.message = "";
      } else if (type == "reset") {
        this.data.index = -1;
      }
      this.onupdate(this.tic++);
    };

    this.load = this.load.bind(this);
    this.list = this.list.bind(this);
  }

  load(name, index = -1) {
    this.data.index = index;
    this.message = `Loading ${name} ...`;
    this.worker.postMessage({ task: "load", name: name });
    this.onupdate(this.tic++);
  }

  list(day) {
    this.message = `Listing ${day} ...`;
    this.worker.postMessage({ task: "list", day: day });
    this.onupdate(this.tic++);
  }
}

export { Archive };
