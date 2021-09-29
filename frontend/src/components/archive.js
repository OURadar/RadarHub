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
      sweep: null,
      index: -1,
    };
    this.tic = 0;
    this.timer = null;
    this.message = "";
    this.response = "";
    this.onupdate = (_data) => {};

    this.worker = new Worker("/static/frontend/archive.js");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "message") {
        this.showMessage(payload, 2500);
      } else if (type == "load") {
        this.data.sweep = payload;
        this.showMessage(`${payload.name} loaded`);
      } else if (type == "list") {
        this.data.files = payload;
        this.data.index = -1;
        this.message = "";
      } else if (type == "count") {
        this.data.count = payload;
      } else if (type == "reset") {
        this.showMessage(payload);
        this.data.sweep = null;
        this.data.index = -1;
      }
      this.onupdate(this.tic++);
    };

    this.showMessage = this.showMessage.bind(this);
    this.count = this.count.bind(this);
    this.list = this.list.bind(this);
    this.load = this.load.bind(this);
  }

  showMessage(message, duration = 2000) {
    this.message = message;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.message == message) {
        this.message = "";
        this.timer = null;
        this.onupdate(this.tic++);
      }
    }, duration);
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
