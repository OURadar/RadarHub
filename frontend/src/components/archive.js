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

const nameStyle = "background-color: seagreen; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";

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
    this.table = this.table.bind(this);
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
    } else if (type == "progress") {
      this.progress = payload.progress;
      if (this.progress < 100) {
        // No fade out when progress < 100
        this.message = payload.message;
      } else {
        this.showMessage(payload.message);
      }
    } else if (type == "load") {
      this.data.sweeps = payload;
      this.grid = grid;
      this.state.loadCount++;
      this.state.itemsUpdating = false;
      this.state.sweepLoading = false;
      if (this.state.verbose) {
        console.log(
          `%carchive.handleMessage%c load` +
            `   tic = ${this.grid.tic}` +
            `   hour = ${this.grid.hour}` +
            `   index = ${this.grid.index}` +
            `   latestHour = ${this.grid.latestHour}` +
            `   loadCount = ${this.state.loadCount}`,
          nameStyle,
          ""
        );
      }
      this.updateAge();
      const latest = this.isLatestVolume();
      if (!latest && this.state.liveUpdate !== "offline") {
        this.disableLiveUpdate();
      } else if (latest && this.state.liveUpdate === "offline") {
        this.enableLiveUpdate();
      }
      if (this.data.sweeps.length == 1) {
        this.showMessage(`${this.data.sweeps[0].name} loaded`);
      }
    } else if (type == "table") {
      if (this.state.verbose) {
        console.log(
          `%carchive.handleMessage%c table` +
            `   ${grid.dateTimeString}` +
            `   ${grid.latestScan}` +
            `   hour = ${this.grid?.hour} -> ${grid.hour}` +
            `   index = ${this.grid?.index} -> ${grid.index}` +
            `   productSwitching = ${this.state.productSwitching}`,
          nameStyle,
          "",
          grid
        );
      }
      this.grid = grid;
      this.state.loadCount = 0;
      this.state.itemsUpdating = false;
      this.updateAge();
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
          nameStyle,
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
        console.log(`%carchive.handleMessage%c init   index = ${grid.index}`, nameStyle, "");
      }
      this.grid = grid;
      this.ready = true;
    } else if (type == "reload") {
      document.location.reload();
    }
    this.onUpdate(this.state.tic++);
  }

  //

  init() {
    if (this.state.verbose) {
      console.log(`%carchive.init%c   pathway = ${this.pathway}`, nameStyle, "");
    }
    this.worker.postMessage({ task: "init", name: this.pathway });
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19, symbol = 'Z'
  month(day) {
    if (this.state.verbose) {
      console.log(`%carchive.month%c   day = ${day.format("YYYYMMDD")}`, nameStyle, "");
    }
    this.state.dayHasDataUpdating = true;
    this.worker.postMessage({ task: "month", date: day.unix() });
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19
  table(day, hour) {
    console.log(
      `%carchive.table%c   day = ${day.format("YYYYMMDD")}   hour = ${hour}   ${this.state.itemsUpdating}`,
      nameStyle,
      ""
    );
    if (this.state.itemsUpdating) {
      console.log(`%carchive.table%c Items are updating.`, nameStyle, "");
      return;
    }
    if (day === undefined || isNaN(day)) {
      console.error(`%carchive.table%c Invalid input day`, nameStyle, "");
      return;
    }
    day = day.hour(hour);
    day = day.minute(0);
    if (this.state.verbose) {
      let dateTimeString = day.format("YYYYMMDD-HHMM");
      console.log(`%carchive.table%c   day = ${dateTimeString}   hour = ${hour}`, nameStyle, "");
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({ task: "table", date: day.unix() });
    setTimeout(() => {
      if (this.state.itemsUpdating) {
        console.error(`%carchive.table%c Timed out`, nameStyle, "");
        this.state.itemsUpdating = false;
      }
    }, 3000);
  }

  loadIndex(index) {
    if (index < 0 || index >= this.grid.items.length) {
      console.error(`archive.loadIndex  ${index} != [0, ${this.grid.items.length}).`);
      console.debug(this.grid.items);
      return;
    }
    const scan = this.grid.items[index];
    this.message = `Loading ${scan} ...`;
    this.worker.postMessage({ task: "select", name: index });
  }

  switch(symbol = "Z") {
    if (this.grid.index == -1 || this.grid.items.length == 0) {
      console.log("No file table just yet");
      return;
    }
    if (symbol == this.data.symbol) {
      console.log("No change in symbol");
      return;
    }
    this.state.productSwitching = true;
    // let day = dayjs.utc(this.grid.dateTimeString.slice(0, 8), "YYYYMMDD");
    //this.table(day, this.grid.hour, symbol);
    this.worker.postMessage({ task: "change", symbol: symbol });
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
        nameStyle,
        ""
      );
    }
    if (this.state.itemsUpdating) {
      return;
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({ task: "prepend" });
    setTimeout(() => {
      if (this.state.itemsUpdating) {
        console.error(`%carchive.prepend%c Timed out`, nameStyle, "");
        this.state.itemsUpdating = false;
      }
    }, 3000);
  }

  append() {
    if (this.state.verbose) {
      console.debug(
        `%carchive.append%c   liveUpdate = ${this.state.liveUpdate}   itemsUpdating = ${this.state.itemsUpdating}`,
        nameStyle,
        ""
      );
    }
    if (this.state.itemsUpdating) {
      return;
    }
    this.state.itemsUpdating = true;
    this.worker.postMessage({ task: "append" });
    setTimeout(() => {
      if (this.state.itemsUpdating) {
        console.error(`%carchive.append%c Timed out`, nameStyle, "");
        this.state.itemsUpdating = false;
      }
    }, 3000);
  }

  toggleLiveUpdate(mode = "auto") {
    if (this.state.verbose) {
      console.log(
        `%carchive.toggleLiveUpdate%c   liveUpdate = ${this.state.liveUpdate}   mode = ${mode}`,
        nameStyle,
        ""
      );
    }
    this.worker.postMessage({ task: "toggle", name: mode });
  }

  updateAge() {
    if (this.data.sweeps === null || this.data.sweeps.length == 0) {
      return;
    }
    let now = Date.now() / 1000;
    let updated = false;
    const ageString = (age) => {
      if (age > 14 * 86400) {
        return "";
      } else if (age > 7 * 86400) {
        return "> 1 week";
      } else if (age > 86400) {
        let d = Math.floor(age / 86400);
        let s = d > 1 ? "s" : "";
        return `> ${d} day${s} ago`;
      } else if (age > 1.5 * 3600) {
        let h = Math.floor(age / 3600);
        let s = h > 1 ? "s" : "";
        return `> ${h} hour${s} ago`;
      } else if (age > 60) {
        let m = Math.floor(age / 60);
        let s = m > 1 ? "s" : "";
        return `${m} minute${s} ago`;
      } else {
        return "< 1 minute ago";
      }
    };
    this.data.sweeps.forEach((sweep) => {
      const age = ageString(now - sweep.time);
      if (sweep.age === undefined || sweep.age != age) {
        sweep.age = age;
        updated = true;
      }
    });
    if (updated) {
      this.onUpdate(this.state.tic++);
    }
  }

  isLatestVolume() {
    if (this.grid === null || this.grid.index < 0 || this.grid.index >= this.grid.items.length) {
      return false;
    }
    const scan = this.grid.items[this.grid.index].split("-")[2];
    const item = this.grid.itemsGrouped[scan].at(-1);
    const currentHour = dayjs.utc().format("YYYYMMDD-HH00");
    if (this.state.verbose > 1) {
      console.debug(
        `%carchive.isLatestVolume%c   ${currentHour} == ${this.grid.dateTimeString}   ${item.index} == ${this.grid.index}`,
        nameStyle,
        ""
      );
    }
    return this.grid.dateTimeString == currentHour && item.index == this.grid.index;
  }

  navigateUp() {
    this.worker.postMessage({ task: "backward" });
  }

  navigateDown() {
    this.worker.postMessage({ task: "forward" });
  }

  navigateLeft() {
    this.worker.postMessage({ task: "backward-scan" });
  }

  navigateRight() {
    this.worker.postMessage({ task: "forward-scan" });
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

  playPause() {
    this.loadIndex(this.grid.index);
  }

  // Expect something like day = dayjs.utc('2013-05-20'), hour = 19
  setDayHour(day, hour) {
    if (day === null) {
      day = dayjs.utc(this.grid.dateTimeString.slice(0, 8));
    }
    if (hour === null) {
      hour = this.grid.hour < 0 ? 0 : this.grid.hour;
    }
    console.log(`%carchive.setDayHour%c   day = ${day}   hour = ${hour}`, nameStyle, "");
    this.worker.postMessage({ task: "toggle", name: "offline" });
    if (this.state.verbose) {
      let t = day instanceof dayjs ? "DayJS" : "Not DayJS";
      let n = day.format("YYYYMMDD");
      let o = this.grid ? this.grid.dateTimeString.slice(0, 8) : "";
      console.log(
        `%carchive.setDayHour%c   day = %c${n}%c ← ${o} (${t})   hour = %c${hour}%c ← ${this.grid.hour}    ${this.grid.symbol}`,
        nameStyle,
        "",
        "color: mediumpurple",
        "",
        "color: mediumpurple",
        ""
      );
    }
    this.table(day, hour);
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
