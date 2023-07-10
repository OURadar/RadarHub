//
//  archive.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 9/23/2021.
//

import { Ingest } from "./ingest";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

class Archive extends Ingest {
  constructor(pathway, label = "") {
    super(pathway, label);

    this.grid = null;
    this.state = {
      ...this.state,
      liveUpdate: null,
      dayHasDataUpdating: false,
      hourHasDataUpdating: false,
      itemsUpdating: true,
      productSwitching: false,
      sweepLoading: false,
      loadCount: 0,
      verbose: 0,
    };
    this.ageTimer = setInterval(() => this.updateAge(), 1000);
    this.messageTimer = null;

    this.init = this.init.bind(this);
    this.list = this.list.bind(this);
    this.month = this.month.bind(this);
    this.catchup = this.catchup.bind(this);
    this.prepend = this.prepend.bind(this);
    this.append = this.append.bind(this);
    this.loadIndex = this.loadIndex.bind(this);
    this.updateAge = this.updateAge.bind(this);

    this.worker = new Worker(new URL("./archive.worker.js", import.meta.url));
    this.worker.onmessage = this.handleMessage;
    this.init();
  }

  handleMessage({ data: { type, grid, payload } }) {
    if (type == "message") {
      this.showMessage(payload);
    } else if (type == "response") {
      this.showResponse(payload);
    } else if (type == "load") {
      this.data.sweep = payload;
      this.grid = grid;
      this.updateAge();
      this.state.sweepLoading = false;
      if (this.state.verbose) {
        console.log(
          `%carchive.handleMessage%c load` +
            `   tic = ${this.grid.tic}` +
            `   hour = ${this.grid.hour}` +
            `   index = ${this.grid.index}` +
            `   latestHour = ${this.grid.latestHour}` +
            `   loadCount = ${this.state.loadCount}`,
          "color: lightseagreen",
          ""
        );
      }
      const latest = this.isLatestVolume();
      if (!latest && this.state.liveUpdate !== "offline") {
        this.disableLiveUpdate();
      } else if (latest && this.state.liveUpdate === "offline") {
        this.enableLiveUpdate();
      }
      this.showMessage(`${payload.name} loaded`);
      this.onLoad(this.grid);
    } else if (type == "list") {
      if (this.state.verbose) {
        console.log(
          `%carchive.handleMessage%c list` +
            `   ${grid.dateTimeString}` +
            `   ${grid.latestScan}` +
            `   hour = ${this.grid.hour} -> ${grid.hour}` +
            `   index = ${this.grid.index} -> ${grid.index}` +
            `   productSwitching = ${this.state.productSwitching}`,
          "color: lightseagreen",
          "",
          grid
        );
      }
      this.grid = grid;
      this.state.loadCount = 0;
      this.state.itemsUpdating = false;
    } else if (type == "count") {
      // DEPRECATING: Use list straight away
      this.grid.hourHasData = payload.hoursActive.map((x) => x > 0);
      this.state.hourHasDataUpdating = false;
      let hour = this.grid.hour;
      if (hour == -1 || this.grid.hourHasData[hour] == 0) {
        let best = this.grid.hourHasData.findIndex((x) => x > 0);
        if (best >= 0) {
          hour = best;
          if (this.state.verbose) {
            console.log(
              `%carchive.handleMessage%c count   No data.  hour = ${hour} -> ${best} ...`,
              "color: lightseagreen",
              ""
            );
          }
        } else {
          console.log("Unexpeted results.");
        }
      }
      let day = dayjs.utc(payload.dateTimeString.replace("-", ""), "YYYYMMDD") + hour.toString().padStart(2, "0");
      console.log(`%carchive.handleMessage%c count   day = ${day}`, "color: lightseagreen", "");
      this.list(day, hour, this.grid.symbol);
    } else if (type == "month") {
      this.grid.daysActive = payload;
      this.state.dayHasDataUpdating = false;
    } else if (type == "reset") {
      this.showMessage(payload);
      this.data.sweep = null;
      this.grid.index = -1;
      this.state.sweepLoading = false;
    } else if (type == "state") {
      if (this.state.verbose) {
        console.log(
          `%carchive.handleMessage%c state` +
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
        console.log(`%carchive.handleMessage%c init` + `   index = ${payload.index}`, "color: lightseagreen", "");
      }
      this.grid = grid;
      this.ready = true;
    }
    this.onUpdate(this.state.tic++);
  }

  //

  init() {
    if (this.state.verbose) {
      console.log(`%carchive.init%c   pathway = ${this.pathway}`, "color: lightseagreen", "");
    }
    this.worker.postMessage({ task: "init", name: this.pathway });
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19, symbol = 'Z'
  month(day) {
    if (this.state.verbose) {
      console.log(`%carchive.month%c   day = ${day.format("YYYYMMDD")}`, "color: lightseagreen", "");
    }
    this.state.dayHasDataUpdating = true;
    this.worker.postMessage({ task: "month", date: day.unix() });
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19, symbol = 'Z'
  list(day, hour, symbol = this.grid.symbol) {
    if (this.state.itemsUpdating) {
      return;
    }
    if (day === undefined || isNaN(day)) {
      console.error(`%carchive.list%c Invalid input day`, "color: lightseagreen", "");
      return;
    }
    day = day.hour(hour);
    if (this.state.verbose) {
      let dateTimeString = day.format("YYYYMMDD-HH00");
      console.log(
        `%carchive.list%c   day = ${dateTimeString}   hour = ${hour}   symbol = ${symbol} / ${this.grid.symbol}`,
        "color: lightseagreen",
        ""
      );
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({ task: "list", date: day.unix(), hour: hour, symbol: symbol });
  }

  loadIndex(index) {
    if (index < 0 || index >= this.grid.items.length) {
      console.error(`archive.loadIndex  ${index} != [0, ${this.grid.items.length}).`);
      console.debug(this.grid.items);
      return;
    }
    const scan = this.grid.items[index];
    this.message = `Loading ${scan} ...`;
    this.worker.postMessage({ task: "set", name: index });
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
    let day = dayjs.utc(this.grid.dateTimeString.slice(0, 8), "YYYYMMDD");
    this.list(day, this.grid.hour, symbol);
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

  prepend() {
    if (this.state.verbose) {
      console.debug(
        `%carchive.prepend%c   liveUpdate = ${this.state.liveUpdate}   itemsUpdating = ${this.state.itemsUpdating}`,
        "color: lightseagreen",
        ""
      );
    }
    if (this.state.itemsUpdating) {
      return;
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({ task: "prepend" });
  }

  append() {
    if (this.state.verbose) {
      console.debug(
        `%carchive.append%c   liveUpdate = ${this.state.liveUpdate}   itemsUpdating = ${this.state.itemsUpdating}`,
        "color: lightseagreen",
        ""
      );
    }
    if (this.state.itemsUpdating) {
      return;
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({ task: "append" });
  }

  toggleLiveUpdate(mode = "auto") {
    if (this.state.verbose) {
      console.log(
        `%carchive.toggleLiveUpdate%c   liveUpdate = ${this.state.liveUpdate}   mode = ${mode}`,
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

  isLatestVolume() {
    if (this.grid === null || this.grid.index < 0 || this.grid.index >= this.grid.items.length) {
      return false;
    }
    const scan = this.grid.items[this.grid.index].split("-")[2];
    const item = this.grid.itemsGrouped[scan].at(-1);
    return this.grid.latestHour == this.grid.hour && item.index == this.grid.index;
  }

  navigateForward() {
    this.worker.postMessage({ task: "forward" });
  }

  navigateBackward() {
    this.worker.postMessage({ task: "backward" });
  }

  navigateForwardScan() {
    this.worker.postMessage({ task: "forward-scan" });
  }

  navigateBackwardScan() {
    this.worker.postMessage({ task: "backward-scan" });
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19
  setDayHour(day, hour) {
    if (day === null) {
      day = dayjs.utc(this.grid.dateTimeString.slice(0, 8));
    }
    if (hour === null) {
      hour = this.grid.hour;
    }
    if (this.state.verbose) {
      let t = day instanceof dayjs ? "DayJS" : "Not DayJS";
      let n = day.format("YYYYMMDD");
      let o = this.grid ? this.grid.dateTimeString.slice(0, 8) : "";
      console.log(
        `%carchive.setDayHour%c   day = %c${n}%c ← ${o} (${t})   hour = %c${hour}%c ← ${this.grid.hour}    ${this.grid.symbol}`,
        "color: deeppink",
        "",
        "color: mediumpurple",
        "",
        "color: mediumpurple",
        ""
      );
    }
    this.list(day, hour);
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19
  getMonthTable(day) {
    const key = day.format("YYYYMMDD");
    // console.log(`%carchive.getMonthTable%c ${key}`, "color: deeppink", "", this.grid.daysActive);
    if (key in this.grid.daysActive) {
      return;
    }
    this.month(dayjs.utc(key));
  }
}

export { Archive };
