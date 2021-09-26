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
      day: "",
      date: new Date("2013-05-20T12:00"),
      count: new Array(24).fill(0),
      files: [],
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
        this.data.files = payload;
        this.data.index = -1;
        this.message = "";
      } else if (type == "count") {
        this.data.count = payload;
      } else if (type == "reset") {
        this.data.index = -1;
      }
      this.onupdate(this.tic++);
    };

    this.count = this.count.bind(this);
    this.list = this.list.bind(this);
    this.load = this.load.bind(this);
  }

  count(day) {
    this.data.day = day;
    const y = day.slice(0, 4);
    const m = day.slice(4, 6);
    const d = day.slice(6, 8);
    const isoDateString = `${y}-${m}-${d}T12:00`;
    this.data.date = new Date(isoDateString);
    this.worker.postMessage({ task: "count", day: day });
    this.onupdate(this.tic++);
  }

  list(time) {
    this.message = `Listing ${time} ...`;
    const day = time.slice(0, 8);
    if (this.data.day != day) {
      this.count(day);
    }
    this.worker.postMessage({ task: "list", time: time });
    this.onupdate(this.tic++);
  }

  load(name, index = -1) {
    this.data.index = index;
    this.message = `Loading ${name} ...`;
    this.worker.postMessage({ task: "load", name: name });
    this.onupdate(this.tic++);
  }
}

export { Archive };
