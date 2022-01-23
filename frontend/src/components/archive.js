//
//  archive.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/23/2021.
//

class Archive {
  constructor(radar) {
    this.radar = radar;
    this.data = {
      hourlyCount: new Array(24).fill(0),
      hourlyCountUpdating: false,
      dailyAvailability: {},
      dailyAvailabilityUpdating: false,
      listDateTime: "20130520-1900",
      fileList: [],
      fileListGrouped: {},
      fileListUpdating: true,
      loadCountSinceList: 0,
      resetLoadCount: true,
      autoIndex: -1,
      index: -1,
      sweep: null,
      symbol: "Z",
    };
    this.tic = 0;
    this.timer = null;
    this.message = "";
    this.response = "";
    this.onupdate = () => {};
    this.onlist = () => {};

    this.worker = new Worker("/static/frontend/archive.js?name=levi");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "message") {
        this.showMessage(payload, 2500);
      } else if (type == "load") {
        this.data.sweep = payload;
        this.showMessage(`${payload.name} loaded`);
      } else if (type == "list") {
        this.data.fileList = payload.list;
        this.data.fileListGrouped = payload.groups;
        this.data.autoIndex = payload.autoIndex;
        this.data.fileListUpdating = false;
        if (this.data.resetLoadCount) {
          this.data.loadCountSinceList = 0;
          this.data.index = -1;
          this.onlist(payload.autoIndex);
        } else {
          this.data.resetLoadCount = true;
          this.onlist(this.data.index);
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

  // Expect radar = px1000, day = 201305
  month(radar, day) {
    this.data.dailyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "month", name: radar, day: day });
    this.onupdate(this.tic++);
  }

  // Expect radar = raxpol, day = 20130520
  count(radar, day) {
    this.data.hourlyCountUpdating = true;
    this.worker.postMessage({ task: "count", name: radar, day: day });
    this.onupdate(this.tic++);
  }

  // Expect radar = horus, time = 20130520-1900
  list(radar, time) {
    let symbol = this.data.symbol;
    this.radar = radar;
    this.data.listDateTime = time;
    this.data.fileListUpdating = true;
    this.worker.postMessage({
      task: "list",
      name: radar,
      time: time,
      symbol: symbol,
    });
    this.onupdate(this.tic++);
  }

  load(arg) {
    if (Number.isInteger(arg)) {
      this.loadByIndex(arg);
    } else {
      this.loadByName(arg);
    }
  }

  loadByIndex(index = -1) {
    if (index < 0 || index > this.data.fileList.length - 1) {
      console.log(`archive.load() index = ${index} is out of range.`);
      return;
    }
    this.data.index = index;
    this.loadByName(this.data.fileList[index]);
  }

  loadByName(name = "PX-20130520-195944-E2.6-Z.nc") {
    this.message = `Loading ${name} ...`;
    this.worker.postMessage({ task: "load", name: name });
    this.data.loadCountSinceList += 1;
    this.onupdate(this.tic++);
  }

  switch(symbol = "Z") {
    if (this.data.index == -1 || this.data.fileList.length == 0) {
      console.log("No file list just yet");
      return;
    }
    if (symbol == this.data.symbol) {
      console.log("No change in symbol");
      return;
    }
    this.data.symbol = symbol;
    this.data.resetLoadCount = false;
    this.list(this.radar, this.data.listDateTime);
  }
}

export { Archive };
