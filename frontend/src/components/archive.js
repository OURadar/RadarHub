//
//  archive.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 9/23/2021.
//

class Archive {
  constructor(radar, label = "") {
    this.radar = radar;
    this.label = label == "" ? radar : label;
    this.ready = false;
    this.data = {
      sweep: null,
    };
    this.grid = null;
    this.state = {
      liveUpdate: null,
      daysActiveUpdating: false,
      hoursActiveUpdating: false,
      itemsUpdating: true,
      productSwitching: false,
      sweepLoading: false,
      loadCount: 0,
      verbose: 0,
      tic: 0,
    };
    this.ageTimer = setInterval(() => this.updateAge(), 1000);
    this.messageTimer = null;
    this.message = "";
    this.response = "";
    this.onUpdate = () => {};
    this.onIndex = () => {};
    this.onList = () => {};
    this.onLoad = () => {};

    this.handleMessage = this.handleMessage.bind(this);
    this.showMessage = this.showMessage.bind(this);
    this.init = this.init.bind(this);
    this.list = this.list.bind(this);
    this.load = this.load.bind(this);
    this.month = this.month.bind(this);
    this.count = this.count.bind(this);
    this.catchup = this.catchup.bind(this);
    this.updateAge = this.updateAge.bind(this);

    this.worker = new Worker(new URL("./archive.worker.js", import.meta.url));
    this.worker.onmessage = this.handleMessage;
    this.init();
  }

  handleMessage({ data: { type, payload } }) {
    if (type == "load") {
      this.data.sweep = payload;
      this.updateAge();
      this.state.sweepLoading = false;
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c load` +
            `   hour = ${this.grid.hour}` +
            `   index = ${this.grid.index}` +
            `   latestHour = ${this.grid.latestHour}` +
            `   loadCount = ${this.state.loadCount}`,
          "color: lightseagreen",
          ""
        );
      }
      if (this.grid.latestHour != this.grid.hour || this.state.loadCount > 1) {
        this.disableLiveUpdate();
      }
      this.showMessage(`${payload.name} loaded`);
      this.onLoad(this.grid);
    } else if (type == "index") {
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c index` +
            `   index = ${this.grid.index} -> ${payload}`,
          "color: lightseagreen",
          ""
        );
      }
      this.grid = { ...this.grid, ...payload };
      this.loadIfNecessary();
      this.onIndex(this.grid);
    } else if (type == "list") {
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c list` +
            `   ${this.grid.dateTimeString}` +
            `   ${payload.latestScan}` +
            `   hour = ${this.grid.hour} -> ${payload.hour}` +
            `   index = ${this.grid.index} -> ${payload.index}` +
            `   productSwitching = ${this.state.productSwitching}`,
          "color: lightseagreen",
          ""
        );
      }
      this.grid = payload;
      this.state.loadCount = 0;
      this.loadIfNecessary();
      this.onList(this.grid);
      this.state.itemsUpdating = false;
    } else if (type == "message") {
      this.showMessage(payload, 2500);
    } else if (type == "month") {
      this.grid.daysActive = payload;
      // console.debug(this.grid.daysActive);
      this.state.daysActiveUpdating = false;
    } else if (type == "reset") {
      this.showMessage(payload);
      this.data.sweep = null;
      this.grid.index = -1;
      this.state.sweepLoading = false;
    } else if (type == "state") {
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c state` +
            `   state.liveUpdate = ${this.state.liveUpdate} -> ${payload.update}` +
            ` (${payload.update === null})`,
          "color: lightseagreen",
          ""
        );
      }
      if (this.state.liveUpdate != payload.update) {
        this.state.liveUpdate = payload.update;
        if (payload.message) {
          this.showMessage(payload.message, 2500);
        }
      }
    } else if (type == "init") {
      if (this.state.verbose) {
        console.log(
          `%carchive.onmessage()%c init` + `   index = ${payload.index}`,
          "color: lightseagreen",
          ""
        );
      }
      this.grid = payload;
      this.ready = true;
    } else if (type == "count") {
      this.grid.hoursActive = payload.hoursActive;
      this.state.hoursActiveUpdating = false;
      let hour = this.grid.hour;
      if (hour == -1 || this.grid.hoursActive[hour] == 0) {
        let best = this.grid.hoursActive.findIndex((x) => x > 0);
        if (best >= 0) {
          hour = best;
          if (this.state.verbose) {
            console.log(
              `%carchive.onmessage()%c count   No data.  hour = ${hour} -> ${best} ...`,
              "color: lightseagreen",
              ""
            );
          }
        } else {
          console.log("Unexpeted results.");
        }
      }
      this.list(this.radar, payload.day, hour, this.grid.symbol);
    }
    this.onUpdate(this.state.tic++);
  }

  //

  showMessage(message, duration = 2000) {
    this.message = message;
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      if (this.message == message) {
        this.message = "";
        this.messageTimer = null;
        this.onUpdate(this.state.tic++);
      }
    }, duration);
  }

  init() {
    if (this.state.verbose) {
      console.log(
        `%carchive.init()%c   radar = ${this.radar}`,
        "color: lightseagreen",
        ""
      );
    }
    this.worker.postMessage({ task: "init", name: this.radar });
  }

  // Expect something like day = Date('2013-05-20'), hour = 19
  list(day, hour, symbol) {
    if (this.state.verbose) {
      console.log(
        `%carchive.list()%c` +
          `   day = ${day.toISOString().slice(0, 10)}` +
          `   hour = ${hour}` +
          `   symbol = ${symbol} / ${this.grid.symbol}`,
        "color: lightseagreen",
        ""
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
        ""
      );
      console.log(this.grid);
      return;
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({
      task: "list",
      day: day,
      hour: hour,
      symbol: symbol,
    });
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
    if (index < 0 || index >= this.grid.items.length) {
      console.log(
        `archive.load() index = ${index} is out of range ${this.grid.items.length}.`
      );
      console.log(this.grid.items);
      return;
    }
    this.grid.index = index;
    this.loadByName(this.grid.items[index]);
  }

  loadByName(name = "PX-20130520-195944-E2.6-Z") {
    this.message = `Loading ${name} ...`;
    this.worker.postMessage({ task: "load", name: name });
    this.state.loadCount++;
    this.onUpdate(this.state.tic++);
  }

  loadIfNecessary() {
    if (this.state.productSwitching) {
      this.state.productSwitching = false;
      this.state.loadCount = 0;
      //this.grid.index = index;
      this.loadByIndex(this.grid.index);
    } else if (this.grid.index >= 0) {
      this.loadByIndex(this.grid.index);
    } else if (this.grid.index == -1) {
      if (this.grid.latestScan == "" || this.grid.latestScan == null) {
        this.state.itemsUpdating = false;
        return;
      }
      let fileDayString = this.grid.latestScan.split("-")[1];
      let gridDayString = this.grid.dateTimeString.split("-")[0];
      console.log(
        `%carchive.loadIfNecessary()%c` +
          `   fileDayString: ${fileDayString}` +
          `   gridDayString: ${gridDayString}` +
          `   loadCount = ${this.state.loadCount}`,
        "color: lightseagreen",
        ""
      );
      if (this.state.liveUpdate != null) {
        console.log(`Live update with ${this.grid.latestScan}`);
        this.loadByName(this.grid.latestScan);
      }
    }
  }

  // Expect something like day = 201305
  month(day) {
    this.state.daysActiveUpdating = true;
    this.worker.postMessage({ task: "month", day: day });
  }

  // Expect something like day = Date('2013-05-20')
  count(day, hour, symbol = this.grid.symbol) {
    if (this.state.verbose) {
      console.log(
        `%carchive.count()%c` +
          `   day = ${day.toISOString().slice(0, 10)}` +
          `   hour = ${hour}   symbol = ${symbol}`,
        "color: lightseagreen",
        ""
      );
    }
    if (isNaN(day)) return;
    let year = day.getFullYear();
    if (year < 2000 || year > 2023) return;
    if (this.grid.day == day) {
      if (this.state.verbose) {
        console.log(
          `%carchive.count()%c same day, list directly`,
          "color: lightseagreen",
          ""
        );
      }
      this.list(day, hour, symbol);
      return;
    }
    this.state.hoursActiveUpdating = true;
    this.worker.postMessage({
      task: "list",
      day: day,
      hour: hour,
      symbol: symbol,
    });
  }

  switch(symbol = "Z") {
    if (this.grid.index == -1 || this.grid.items.length == 0) {
      console.log("No file list just yet");
      return;
    }
    if (symbol == this.data.symbol) {
      console.log("No change in symbol");
      return;
    }
    this.state.productSwitching = true;
    this.list(this.grid.day, this.grid.hour, symbol);
  }

  nextProduct() {
    const switches = {
      Z: "V",
      V: "W",
      W: "D",
      D: "P",
      P: "R",
      R: "Z",
    };
    this.switch(switches[this.grid.symbol]);
  }

  prevProduct() {
    const switches = {
      Z: "R",
      V: "Z",
      W: "V",
      D: "W",
      P: "D",
      R: "P",
    };
    this.switch(switches[this.grid.symbol]);
  }

  disableLiveUpdate() {
    this.worker.postMessage({ task: "toggle", name: "offline" });
  }

  enableLiveUpdate() {
    this.worker.postMessage({ task: "toggle", name: "scan" });
  }

  catchup() {
    this.worker.postMessage({ task: "catchup" });
  }

  toggleLiveUpdate(mode = "auto") {
    if (this.state.verbose) {
      console.log(
        `%carchive.toggleLiveUpdate()%c` +
          `   liveUpdate = ${this.state.liveUpdate}` +
          `   mode = ${mode}`,
        "color: lightseagreen",
        ""
      );
    }
    this.worker.postMessage({ task: "toggle", name: mode });
  }

  updateAge() {
    if (this.data.sweep === null) {
      return;
    }
    let age = Date.now() / 1000 - this.data.sweep.time;
    let ageString;
    if (age > 14 * 86400) {
      ageString = "";
    } else if (age > 7 * 86400) {
      ageString = "> 1 week";
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
      this.onUpdate(this.state.tic++);
    }
  }

  navigateForward() {
    this.worker.postMessage({ task: "forward" });
  }

  navigateBackward() {
    this.worker.postMessage({ task: "backward" });
  }

  navigateForwardScan() {
    this.worker.postMessage({
      task: "forward-scan",
    });
  }

  navigateBackwardScan() {
    this.worker.postMessage({
      task: "backward-scan",
    });
  }

  setDayHour(day, hour) {
    if (this.state.verbose) {
      let t = day instanceof Date ? "Date" : "Not Date";
      let n = day.toISOString().slice(0, 10);
      let o = day.toISOString().slice(0, 10);
      console.log(
        `%cArchive.setDayHour()%c   day = %c${n}%c ← ${o} (${t})   hour = %c${hour}%c ← ${this.grid.hour}    ${this.grid.symbol}`,
        "color: deeppink",
        "",
        "color: mediumpurple",
        "",
        "color: mediumpurple",
        ""
      );
    }
    this.count(day, hour);
  }

  getMonthTable(day) {
    const m =
      day.getFullYear().toString() +
      (day.getMonth() + 1).toString().padStart(2, "0");
    const key = `${m.slice(0, 4)}-${m.slice(4, 6)}-01`;
    if (key in this.grid.daysActive) {
      return;
    }
    this.month(m);
  }
}

export { Archive };
