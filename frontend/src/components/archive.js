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
      hourlyCount: new Array(24).fill(0),
      hourlyCountUpdating: false,
      dailyAvailability: {},
      dailyAvailabilityUpdating: false,
      fileList: [],
      fileListGrouped: {},
      fileListUpdating: true,
      index: -1,
      sweep: null,
    };
    this.tic = 0;
    this.timer = null;
    this.message = "";
    this.response = "";
    this.onupdate = (_tic) => {};

    this.autoLoad = true;

    this.worker = new Worker("/static/frontend/archive.js?v=1");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "message") {
        this.showMessage(payload, 2500);
      } else if (type == "load") {
        this.data.sweep = payload;
        this.showMessage(`${payload.name} loaded`);
      } else if (type == "list") {
        this.data.fileList = payload.list;
        this.data.fileListGrouped = payload.groups;
        this.data.fileListUpdating = false;
        this.data.index = -1;
        this.message = "";
        if (this.autoLoad) {
          this.load(payload.autoIndex);
        }
      } else if (type == "count") {
        this.data.hourlyCount = payload;
        this.data.hourlyCountUpdating = false;
      } else if (type == "month") {
        this.data.dailyAvailability = payload;
        this.data.dailyAvailabilityUpdating = false;
      } else if (type == "reset") {
        this.showMessage(payload);
        this.data.sweep = null;
        this.data.index = -1;
      }
      this.onupdate(this.tic++);
    };

    this.showMessage = this.showMessage.bind(this);
    this.month = this.month.bind(this);
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

  // Expect day = 201305
  month(day) {
    this.data.dailyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "month", day: day });
    this.onupdate(this.tic++);
  }

  // Expect day = 20130520
  count(day) {
    this.data.hourlyCountUpdating = true;
    this.worker.postMessage({ task: "count", day: day });
    this.onupdate(this.tic++);
  }

  // Expect time = 20130520-1900
  list(time) {
    this.data.fileListUpdating = true;
    this.worker.postMessage({ task: "list", time: time });
    this.onupdate(this.tic++);
  }

  load(index = -1) {
    if (index < 0 || index > this.data.fileList.length - 1) {
      console.log(`archive.load() index = ${index} is out of range.`);
      return;
    }
    let name = this.data.fileList[index];
    this.data.index = index;
    this.message = `Loading ${name} ...`;
    this.worker.postMessage({ task: "load", name: name });
    this.onupdate(this.tic++);
  }
}

export { Archive };
