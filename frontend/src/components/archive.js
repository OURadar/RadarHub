//
//  archive.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/23/2021.
//

import { clamp } from "./common";

class Archive {
  constructor(radar) {
    this.radar = radar;
    this.grid = {
      dateTimeString: "20130520-1900",
      dailyAvailability: {},
      hourlyAvailability: new Array(24).fill(0),
      latestHour: -1,
      latestFile: "",
      fileListGrouped: {},
      fileList: [],
      symbol: "Z",
      index: -1,
      hour: -1,
      day: new Date("2013/05/20"),
    };
    this.data = {
      sweep: null,
    };
    this.state = {
      liveUpdate: false,
      dailyAvailabilityUpdating: false,
      hourlyAvailabilityUpdating: false,
      fileListUpdating: true,
      switchingProduct: false,
      sweepLoading: false,
      loadCount: 0,
      verbose: 0,
      tic: 0,
    };
    this.ageTimer = setInterval(() => this.updateAge(), 1000);
    this.messageTimer = null;
    this.message = "";
    this.response = "";
    this.onupdate = () => {};
    this.onlist = () => {};

    this.handleMessage = this.handleMessage.bind(this);
    this.showMessage = this.showMessage.bind(this);
    this.count = this.count.bind(this);
    this.list = this.list.bind(this);
    this.load = this.load.bind(this);
    this.month = this.month.bind(this);
    this.updateAge = this.updateAge.bind(this);

    this.worker = new Worker("/static/frontend/archive.js?d=220614.1");
    this.worker.onmessage = this.handleMessage;
  }

  handleMessage({ data: { type, payload } }) {
    if (type == "message") {
      this.showMessage(payload, 2500);
    } else if (type == "count") {
      this.grid.hourlyAvailability = payload.hourlyAvailability;
      this.state.hourlyAvailabilityUpdating = false;
      let hour = this.grid.hour;
      if (hour == -1 || this.grid.hourlyAvailability[hour] == 0) {
        let best = this.grid.hourlyAvailability.findIndex((x) => x > 0);
        if (best >= 0) {
          hour = best;
          if (this.state.verbose) {
            console.log(
              `%carchive.onmessage()%c count   No data.  hour = ${hour} -> ${best} ...`,
              "color: lightseagreen",
              "color: inherit"
            );
          }
        } else {
          console.log("Unexpeted results.");
        }
      }
      this.list(this.radar, payload.day, hour, this.grid.symbol);
    } else if (type == "list") {
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c list` +
            `   ${this.grid.dateTimeString}` +
            `   ${payload.latestFile}` +
            `   hour = ${this.grid.hour} -> ${payload.hour}` +
            `   index = ${this.grid.index} -> ${payload.index}`,
          "color: lightseagreen",
          "color: inherit"
        );
      }
      let index = this.grid.index;
      this.grid = payload;
      if (this.state.switchingProduct) {
        this.state.switchingProduct = false;
        this.state.loadCount = 0;
        this.grid.index = index;
        this.loadByIndex(this.grid.index);
      } else if (this.grid.index >= 0 && index != this.grid.index) {
        this.state.loadCount = 0;
        this.loadByIndex(this.grid.index);
      } else if (this.grid.index == -1) {
        let fileDayString = this.grid.latestFile.split("-")[1];
        let gridDayString = this.grid.dateTimeString.split("-")[0];
        console.log(
          `%carchive.onmessage()%c list` +
            `   fileDayString: ${fileDayString}` +
            `   gridDayString: ${gridDayString}` +
            `   loadCount = ${this.state.loadCount}`,
          "color: lightseagreen",
          "color: inherit"
        );
        if (this.state.liveUpdate) {
          this.state.loadCount = 0;
          console.log(`Live update with ${this.grid.latestFile}`);
          this.loadByName(this.grid.latestFile);
        }
      }
      this.state.fileListUpdating = false;
    } else if (type == "load") {
      this.data.sweep = payload;
      // console.log(this.data.sweep);
      this.updateAge();
      this.state.sweepLoading = false;
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c load` +
            `   hour = ${this.grid.hour}` +
            `   latestHour = ${this.grid.latestHour}` +
            `   loadCount = ${this.state.loadCount}`,
          "color: lightseagreen",
          "color: inherit"
        );
      }
      if (this.grid.latestHour != this.grid.hour || this.state.loadCount > 1) {
        this.disableLiveUpdate();
      }
      this.showMessage(`${payload.name} loaded`);
    } else if (type == "month") {
      this.grid.dailyAvailability = payload;
      this.state.dailyAvailabilityUpdating = false;
    } else if (type == "reset") {
      this.showMessage(payload);
      this.data.sweep = null;
      this.grid.index = -1;
      this.state.sweepLoading = false;
    } else if (type == "state") {
      if (payload.state == "connect") {
        this.state.liveUpdate = true;
      } else if (payload.state == "disconnect") {
        this.state.liveUpdate = false;
      }
      console.log(`state.liveUpdate -> ${this.state.liveUpdate}`);
      this.showMessage(payload.message, 2500);
    }
    this.onupdate(this.state.tic++);
  }

  showMessage(message, duration = 2000) {
    this.message = message;
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      if (this.message == message) {
        this.message = "";
        this.messageTimer = null;
        this.onupdate(this.state.tic++);
      }
    }, duration);
  }

  // Expect something like radar = px1000, day = 201305
  month(radar, day) {
    this.state.dailyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "month", name: radar, day: day });
    this.onupdate(this.state.tic++);
  }

  // Expect something like radar = raxpol, day = Date('2013-05-20')
  count(radar, day, hour, symbol) {
    if (this.state.verbose) {
      console.log(
        `%carchive.count()%c` +
          `   day = ${day.toISOString().slice(0, 10)}` +
          `   hour = ${hour}   symbol = ${symbol}`,
        "color: lightseagreen",
        "color: inherit"
      );
    }
    if (this.grid.day == day) {
      if (this.state.verbose) {
        console.log(
          `%carchive.count()%c same day, list directly`,
          "color: lightseagreen",
          "color: inherit"
        );
      }
      this.list(radar, day, hour, symbol);
      return;
    }
    this.state.hourlyAvailabilityUpdating = true;
    // this.worker.postMessage({
    //   task: "count",
    //   name: radar,
    //   day: day,
    //   hour: hour,
    //   symbol: symbol,
    // });
    this.worker.postMessage({
      task: "list",
      name: radar,
      day: day,
      hour: hour,
      symbol: symbol,
    });
    this.onupdate(this.state.tic++);
  }

  // Expect something like radar = px1000, day = Date('2013-05-20'), hour = 19
  list(radar, day, hour, symbol) {
    if (this.state.verbose) {
      console.log(
        `%carchive.list()%c` +
          `   day = ${day.toISOString().slice(0, 10)}` +
          `   hour = ${hour}` +
          `   symbol = ${symbol} / ${this.grid.symbol}`,
        "color: lightseagreen",
        "color: inherit"
      );
    }
    if (
      day == this.grid.day &&
      hour == this.grid.hour &&
      symbol == this.grid.symbol
    ) {
      console.log(
        `%carchive.list()%c same day, hour & symbol, do nothing`,
        "color: lightseagreen",
        "color: inherit"
      );
      return;
    }
    this.radar = radar;
    this.state.fileListUpdating = true;
    this.worker.postMessage({
      task: "list",
      name: radar,
      day: day,
      hour: hour,
      symbol: symbol,
    });
    this.onupdate(this.state.tic++);
  }

  load(arg) {
    this.state.sweepLoading = true;
    if (Number.isInteger(arg)) {
      this.loadByIndex(arg);
    } else {
      this.loadByName(arg);
    }
  }

  loadByIndex(index = -1) {
    if (index < 0 || index >= this.grid.fileList.length) {
      console.log(
        `archive.load() index = ${index} is out of range ${this.grid.fileList.length}.`
      );
      console.log(this.grid.fileList);
      return;
    }
    this.grid.index = index;
    this.loadByName(this.grid.fileList[index]);
  }

  loadByName(name = "PX-20130520-195944-E2.6-Z.nc") {
    this.message = `Loading ${name} ...`;
    this.state.loadCount++;
    this.worker.postMessage({ task: "load", name: name });
    this.onupdate(this.state.tic++);
  }

  switch(symbol = "Z") {
    if (this.grid.index == -1 || this.grid.fileList.length == 0) {
      console.log("No file list just yet");
      return;
    }
    if (symbol == this.data.symbol) {
      console.log("No change in symbol");
      return;
    }
    this.state.switchingProduct = true;
    this.list(this.radar, this.grid.day, this.grid.hour, symbol);
  }

  disableLiveUpdate() {
    this.worker.postMessage({ task: "disconnect", name: this.radar });
  }

  enableLiveUpdate() {
    this.worker.postMessage({ task: "connect", name: this.radar });
  }

  catchup() {
    this.worker.postMessage({ task: "catchup", name: this.radar });
  }

  toggleLiveUpdate() {
    console.log(
      `toggleLiveUpdate() this.state.liveUpdate = ${this.state.liveUpdate}`
    );
    if (this.state.liveUpdate) {
      this.disableLiveUpdate();
    } else {
      this.catchup();
    }
  }

  updateAge() {
    if (this.data.sweep == null) {
      return;
    }
    let age = Date.now() / 1000 - this.data.sweep.time;
    let ageString;
    if (age > 3 * 86400) {
      ageString = "";
    } else if (age > 86400) {
      let d = Math.floor(age / 86400);
      let s = d > 1 ? "s" : "";
      ageString = `> ${d} day${s} ago`;
    } else if (age > 1.5 * 3600) {
      let h = Math.floor(age / 3600);
      let s = h > 1 ? "s" : "";
      ageString = `> ${h} hour${s} ago`;
    } else if (age > 60) {
      let m = Math.floor(age / 60);
      let s = m > 1 ? "s" : "";
      ageString = `${m} minute${s} ago`;
    } else {
      ageString = "< 1 minute ago";
    }
    if (this.data.sweep.age != ageString) {
      this.data.sweep.age = ageString;
      this.onupdate(this.state.tic++);
    }
  }

  navigateForward() {
    this.worker.postMessage({ task: "forward", name: this.radar });
  }

  navigateBackward() {
    this.worker.postMessage({ task: "backward", name: this.radar });
  }

  navigateForwardScan() {
    this.worker.postMessage({
      task: "forward-scan",
      name: this.radar,
    });
  }

  navigateBackwardScan() {
    this.worker.postMessage({
      task: "backward-scan",
      name: this.radar,
    });
  }
}

export { Archive };
