//
//  archive.worker.js
//  RadarHub
//
//  A separate web worker to load and parse arhived data in the background
//
//  Because dayjs cannot be passed with the utc extension, the date object
//  is currently being passed as a UNIX time, i.e., using the dayjs.utc
//  method dayjs.utc.unix() from the front end
//
//  Created by Boonleng Cheong
//

import { Parser } from "binary-parser";
import { deg2rad, clamp } from "./common";
// import { logger } from "./logger";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

let source = null;
let pathway;
let grid = {
  dateTimeString: "20130520-1900",
  daysActive: {},
  hoursActive: new Array(24).fill(0),
  yearsActive: new Array(200).fill(0),
  pathsActive: new Array(4).fill(false),
  latestScan: "",
  latestHour: -1,
  listMode: 0,
  counts: [0, 0],
  items: [],
  itemsGrouped: {},
  hour: -1,
  index: -1,
  symbol: "Z",
  scan: "E4.0",
};
let state = {
  update: "scan",
  verbose: 0,
};
const namecolor = "#bf9140";

const sweepParser = new Parser()
  .endianess("little")
  .uint16("nb")
  .uint16("nr")
  .uint16("nx")
  .uint16("reserved")
  .doublele("time")
  .doublele("longitude")
  .doublele("latitude")
  .doublele("doubleReserved")
  .floatle("scanElevation")
  .floatle("scanAzimuth")
  .floatle("rangeStart")
  .floatle("rangeSpacing")
  .string("info", { length: "nx" })
  .array("elevations", { type: "floatle", length: "nb" })
  .array("azimuths", { type: "floatle", length: "nb" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.nb * this.nr;
    },
  });

function reviseGridItemsGrouped() {
  grid.itemsGrouped = {};
  grid.items.forEach((item, index) => {
    let elements = item.split("-");
    let scanType = elements[2];
    if (!(scanType in grid.itemsGrouped)) {
      grid.itemsGrouped[scanType] = [];
    }
    grid.itemsGrouped[scanType].push({ item: item, index: index });
  });
  let index = grid.items.length ? grid.items.length - 1 : -1;
  if (grid.scan in grid.itemsGrouped) {
    index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
  }
  return index;
}

self.onmessage = ({ data: { task, name, date, symbol } }) => {
  let day = dayjs.utc(0);
  if (date !== undefined) {
    day = dayjs.utc(date * 1000);
  }
  if (state.verbose) {
    console.log(
      `%carchive.worker.onmessage()%c task = ${task}   day = ${day.format("YYYYMMDD-HHMM")}`,
      "color: hotpink",
      ""
    );
  }
  if (task == "init") {
    init(name);
  } else if (task == "set") {
    setGridIndex(name);
  } else if (task == "load") {
    load(name);
  } else if (task == "list") {
    list2(day, symbol);
  } else if (task == "count") {
    count(day);
  } else if (task == "month") {
    month(day);
  } else if (task == "toggle") {
    toggle(name);
  } else if (task == "catchup") {
    catchup();
  } else if (task == "prepend") {
    prepend();
  } else if (task == "append") {
    append();
  } else if (task == "forward") {
    navigateForward();
  } else if (task == "backward") {
    navigateBackward();
  } else if (task == "forward-scan") {
    navigateForwardScan();
  } else if (task == "backward-scan") {
    navigateBackwardScan();
  } else if (task == "dummy") {
    dummy();
  } else {
    return;
  }
};

function init(newPathway) {
  pathway = newPathway;
  if (state.verbose) {
    console.info(`%carchive.worker.init()%c ${pathway}`, `color: ${namecolor}`, "color: dodgerblue");
  }
  self.postMessage({ type: "init", payload: grid });
}

function connect(force = false) {
  if (source?.readyState == EventSource.OPEN) {
    if (force) {
      if (state.verbose > 1) {
        console.debug(`Closing existing connection ... force = ${force}`);
      }
      source.close();
    } else {
      self.postMessage({
        type: "state",
        payload: {
          update: state.update,
          message: `Update mode to ${state.update}`,
        },
      });
      if (state.update == "always") {
        navigateToEnd();
      }
      return;
    }
  }
  console.info(`EventSource connecting %c${pathway}%c ...`, "color: dodgerblue", "");
  source = new EventSource("/events/");
  // Only pick up event that matches the pathway
  source.addEventListener(pathway, (event) => {
    const payload = JSON.parse(event.data);
    payload.items.forEach((item) => {
      updateListWithItem(item);
    });
    grid.hoursActive = payload.hoursActive;
    grid.latestHour =
      23 -
      grid.hoursActive
        .slice()
        .reverse()
        .findIndex((x) => x > 0);
    self.postMessage({
      type: "list",
      payload: grid,
    });
  });
  source.addEventListener("error", (_event) => {
    console.error(`EventSource error`, source.readyState, EventSource.CONNECTING);
    if (source.readyState == EventSource.CONNECTING) {
      console.info(`EventSource connecting %c${pathway}%c ...`, "color: dodgerblue", "");
      return;
    } else if (source.readyState == EventSource.CLOSED) {
      console.info("EventSource closed. Starting a new one ...");
      setTimeout(() => connect(), 10000);
    }
  });
  self.postMessage({
    type: "state",
    payload: {
      update: state.update,
      message: `Connecting to ${pathway} stream ...`,
    },
  });
}

function disconnect() {
  if (source === null || source.readyState == 2) {
    return;
  }
  if (state.verbose) console.info("Disconnecting live update ...");
  source.close();
  self.postMessage({
    type: "state",
    payload: {
      update: state.update,
    },
  });
}

function updateListWithItem(item) {
  const elements = item.split("-");
  const symbol = elements[3];
  const scan = elements[2];
  const t = elements[1];
  const d = elements[0];
  if (state.verbose) {
    console.info(`%carchive.worker.updateListWithItem()%c ${d} ${t} ${scan} ${symbol}`, `color: ${namecolor}`, "");
  }
  if (symbol != grid.symbol) {
    return;
  }
  const listHour = t.slice(0, 2);
  const dateTimeString = `${d}-${listHour}00`;
  if (grid.dateTimeString != dateTimeString) {
    grid.dateTimeString = dateTimeString;
    grid.itemsGrouped = {};
    grid.items = [];
    grid.hour = parseInt(listHour);
    if (state.verbose) {
      console.info(
        `%carchive.worker.updateListWithItem()%c   ${dateTimeString} ${grid.hour}`,
        `color: ${namecolor}`,
        ""
      );
    }
  }
  if (!(scan in grid.itemsGrouped)) {
    grid.itemsGrouped[scan] = [];
  }
  if (grid.items.indexOf(item) > 0) {
    console.warn(`Item ${item} exists.`);
    return;
  }
  let index = grid.items.length;
  grid.items.push(item);
  grid.itemsGrouped[scan].push({ item: item, index: index });
  if (state.update == "always") {
    index = grid.items.length - 1;
    setGridIndex(index);
  } else if (grid.scan in grid.itemsGrouped) {
    index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
    setGridIndex(index);
  } else {
    index = -1;
  }
}

function createSweep(name = "dummy") {
  // Pad an extra azimuth and elevation
  return {
    name,
    nb: 4,
    nr: 3,
    nx: 0,
    time: 42,
    timeString: "1970/01/01 00:00:42 UTC",
    titleString: "----/--/-- --:--:-- --- -- -.-°",
    symbol: "U",
    isRHI: false,
    scanElevation: 4.0,
    scanAzimuth: 0.0,
    rangeStart: 1.0,
    rangeSpacing: 10.0,
    elevations: [4.0, 4.0, 4.0, 4.0, 4.0],
    azimuths: [0.0, 15.0, 30.0, 45.0, 60.0],
    values: [32, 77, 30, 10, 20, 15, 50, 60, 50, 80, 90, 100],
  };
}

// Expect something like day = dayjs.utc('2013-05-20'), hour = 19, symbol = 'Z'
function month(day) {
  let dayString = day.format("YYYYMM01");
  console.info(`%carchive.worker.month()%c ${pathway} ${dayString}`, `color: ${namecolor}`, "");
  const url = `/data/month/${pathway}/${dayString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.daysActive = { ...buffer, ...grid.daysActive };
          self.postMessage({ type: "month", payload: grid.daysActive });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

// Expect something like day = dayjs.utc('2013-05-20'), symbol = 'Z'
function list(day, symbol) {
  let dateTimeString = day.format("YYYYMMDD-HH00");
  console.info(
    `%carchive.worker.list()%c ${pathway} %c${dateTimeString}%c ← ${grid.dateTimeString} ${symbol} ${grid.index}`,
    `color: ${namecolor}`,
    "",
    "color: mediumpurple",
    ""
  );
  // Same time, just a symbol change
  if (dateTimeString == grid.dateTimeString) {
    let index = grid.index;
    let currentItems = grid.items;
    grid.items = [];
    grid.itemsGrouped = {};
    currentItems.forEach((item, index) => {
      let elements = item.split("-");
      elements[3] = symbol;
      item = elements.join("-");
      grid.items.push(item);
      let scanType = elements[2];
      if (!(scanType in grid.itemsGrouped)) {
        grid.itemsGrouped[scanType] = [];
      }
      grid.itemsGrouped[scanType].push({ item: item, index: index });
    });
    grid.symbol = symbol;
    grid.index = -1;
    setGridIndex(index);
    self.postMessage({
      type: "list",
      payload: grid,
    });
    return;
  }
  // Different time, fetch from the server
  const url = `/data/list/${pathway}/${dateTimeString}-${symbol}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200) {
        response.json().then((buffer) => {
          if (state.verbose > 1) {
            console.debug("list buffer", buffer);
          }
          grid.hour = buffer.hour;
          grid.index = -1;
          grid.symbol = symbol;
          grid.hoursActive = buffer.hoursActive;
          grid.dateTimeString = dateTimeString;
          grid.latestHour =
            23 -
            grid.hoursActive
              .slice()
              .reverse()
              .findIndex((x) => x > 0);
          grid.items = buffer.items;
          // grid.itemsGrouped = {};
          // grid.items.forEach((item, index) => {
          //   let elements = item.split("-");
          //   let scanType = elements[2];
          //   if (!(scanType in grid.itemsGrouped)) {
          //     grid.itemsGrouped[scanType] = [];
          //   }
          //   grid.itemsGrouped[scanType].push({ item: item, index: index });
          // });
          // let index = grid.items.length ? grid.items.length - 1 : -1;
          // if (grid.scan in grid.itemsGrouped) {
          //   index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
          // }
          let index = reviseGridItemsGrouped();
          self.postMessage({ type: "list", payload: grid });
          if (grid.hour < 0) {
            self.postMessage({ type: "message", payload: "No Data" });
            return;
          }
          setGridIndex(index);
        });
      } else {
        console.warn(
          `%carchive.worker.list()%c response.status = ${response.status} != 200`,
          `color: ${namecolor}`,
          ""
        );
        response.text().then((response) => {
          self.postMessage({ type: "message", payload: response });
        });
      }
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function list2(day, symbol, mode = 0) {
  let dateTimeString = day.format("YYYYMMDD-HH00");
  console.info(
    `%carchive.worker.list2()%c ${pathway} %c${dateTimeString}%c ← ${grid.dateTimeString} ${symbol} ${grid.index}`,
    `color: ${namecolor}`,
    "",
    "color: mediumpurple",
    ""
  );
  // Same time, just a symbol change
  if (dateTimeString == grid.dateTimeString) {
    let index = grid.index;
    let currentItems = grid.items;
    grid.listMode = mode;
    grid.items = [];
    grid.itemsGrouped = {};
    currentItems.forEach((item, index) => {
      let elements = item.split("-");
      elements[3] = symbol;
      item = elements.join("-");
      grid.items.push(item);
      let scanType = elements[2];
      if (!(scanType in grid.itemsGrouped)) {
        grid.itemsGrouped[scanType] = [];
      }
      grid.itemsGrouped[scanType].push({ item: item, index: index });
    });
    grid.symbol = symbol;
    grid.index = -1;
    setGridIndex(index);
    self.postMessage({
      type: "list",
      payload: grid,
    });
    return;
  }
  // Different time, fetch from the server
  const url = `/data/list2/${pathway}/${dateTimeString}-${symbol}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200) {
        response.json().then((buffer) => {
          if (state.verbose > 1) {
            console.debug("list buffer", buffer);
          }
          grid.hour = buffer.hour;
          grid.index = -1;
          grid.symbol = symbol;
          grid.hoursActive = buffer.hoursActive;
          grid.dateTimeString = dateTimeString;
          grid.latestHour =
            23 -
            grid.hoursActive
              .slice()
              .reverse()
              .findIndex((x) => x > 0);
          grid.listMode = mode;
          grid.counts = buffer.counts;
          grid.items = buffer.items;
          grid.itemsGrouped = {};
          grid.items.forEach((item, index) => {
            let elements = item.split("-");
            let scanType = elements[2];
            if (!(scanType in grid.itemsGrouped)) {
              grid.itemsGrouped[scanType] = [];
            }
            grid.itemsGrouped[scanType].push({ item: item, index: index });
          });
          let index = grid.items.length ? grid.items.length - 1 : -1;
          if (grid.scan in grid.itemsGrouped) {
            index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
          }
          self.postMessage({ type: "list", payload: grid });
          if (grid.hour < 0) {
            self.postMessage({ type: "message", payload: "No Data" });
            return;
          }
          setGridIndex(index);
        });
      } else {
        console.info(
          `%carchive.worker.list()%c response.status = ${response.status} != 200`,
          `color: ${namecolor}`,
          ""
        );
        response.text().then((response) => {
          self.postMessage({ type: "message", payload: response });
        });
      }
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function prepend() {
  console.log(`%carchive.worker.prepend()%c`, `color: ${namecolor}`, "color: dodgerblue");
  let day = dayjs.utc(grid.dateTimeString.slice(0, 8)).hour(grid.hour).subtract(1, "hour");
  list2(day, grid.symbol, -1);
}

function append() {
  console.log(`%carchive.worker.append()%c`, `color: ${namecolor}`, "color: dodgerblue");
  let day = dayjs.utc(grid.dateTimeString.slice(0, 8)).hour(grid.hour).add(1, "hour");
  list2(day, grid.symbol, 1);
}

function load(name) {
  const url = `/data/load/${pathway}/${name}/`;
  if (state.verbose) {
    console.info(`%carchive.worker.load() %c${url}`, `color: ${namecolor}`, "color: dodgerblue");
  }
  if (name.indexOf(".nc") > -1) {
    console.log(`name = ${name}`);
    console.log(grid);
  }
  const newIndex = grid.items.indexOf(name);
  fetch(url, { cache: "force-cache" })
    .then((response) => {
      if (response.status == 200) {
        response.arrayBuffer().then((buffer) => {
          let sweep = geometry({
            ...createSweep(name),
            ...sweepParser.parse(new Uint8Array(buffer)),
          });
          let components = sweep.name.split("-");
          sweep.timeString =
            `${components[0].slice(0, 4)}/` +
            `${components[0].slice(4, 6)}/` +
            `${components[0].slice(6, 8)} ` +
            `${components[1].slice(0, 2)}:` +
            `${components[1].slice(2, 4)}:` +
            `${components[1].slice(4, 6)} UTC`;
          sweep.symbol = components[3].split(".")[0];
          sweep.titleString =
            sweep.timeString +
            "   " +
            (sweep.isRHI ? `Az ${sweep.scanAzimuth.toFixed(1)}` : `El ${sweep.scanElevation.toFixed(1)}`) +
            "°";
          sweep.info = JSON.parse(sweep.info);
          sweep.infoString = `Gatewidth: ${sweep.info.gatewidth} m\n` + `Waveform: ${sweep.info.waveform}`;
          let scan = components[2];
          if (state.verbose > 1) {
            console.debug(
              `%carchive.worker.load() %cgrid.scan ${grid.scan} -> ${scan}   grid.index ${grid.index} -> ${newIndex}`,
              `color: ${namecolor}`,
              "color: dodgerblue"
            );
          }
          grid.scan = scan;
          if (sweep.nb == 0 || sweep.nr == 0) {
            console.log(sweep);
            self.postMessage({
              type: "message",
              payload: `Failed to load ${name}`,
            });
            return;
          }
          self.postMessage({ type: "load", payload: sweep });
        });
      } else {
        response.text().then((text) => {
          console.info(text);
          self.postMessage({ type: "reset", payload: text });
        });
      }
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function dummy() {
  let sweep = createSweep();
  sweep = geometry(sweep);
  self.postMessage({ type: "load", payload: sweep });
}

function geometry(sweep) {
  let scan = sweep["name"].split("-")[2];
  const rs = sweep.rangeStart;
  const re = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
  let el_pad = 0.0;
  let az_pad = 0.0;
  const ii = clamp(sweep.nb / 2, 0, sweep.nb - 1);
  if (scan[0] == "E") {
    sweep.isRHI = false;
    const da = sweep.azimuths[ii] - sweep.azimuths[ii - 1];
    el_pad = sweep.elevations[sweep.nb - 1];
    az_pad = sweep.azimuths[sweep.nb - 1] + da;
  } else if (scan[0] == "A") {
    sweep.isRHI = true;
    const de = sweep.elevations[ii] - sweep.elevations[ii - 1];
    el_pad = sweep.elevations[sweep.nb - 1] + de;
    az_pad = sweep.azimuths[sweep.nb - 1];
  } else {
    const da = sweep.azimuths[ii] - sweep.azimuths[ii - 1];
    const de = sweep.elevations[ii] - sweep.elevations[ii - 1];
    el_pad = sweep.elevations[sweep.nb - 1] + de;
    az_pad = sweep.azimuths[sweep.nb - 1] + da;
  }
  sweep.elevations.push(el_pad);
  sweep.azimuths.push(az_pad);
  let points = [];
  let origins = [];
  let elements = [];
  for (let k = 0; k < sweep.nb + 1; k++) {
    const e = deg2rad(sweep.elevations[k]);
    const a = deg2rad(sweep.azimuths[k]);
    const ce = Math.cos(e);
    const se = Math.sin(e);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const v = k / sweep.nb;
    const x = ce * sa;
    const y = ce * ca;
    points.push(rs * x, rs * y, rs * se);
    points.push(re * x, re * y, re * se);
    origins.push(0, v);
    origins.push(1, v);
  }
  for (let o = 2, l = 2 * sweep.nb; o <= l; o += 2) {
    elements.push(o - 2, o - 1, o);
    elements.push(o - 1, o, o + 1);
  }
  sweep.points = points;
  sweep.origins = origins;
  sweep.elements = elements;
  return sweep;
}

function catchup() {
  console.info(`%carchive.worker.catchup()%c ${pathway}`, `color: ${namecolor}`, "color: dodgerblue");
  fetch(`/data/catchup/${pathway}/`).then((response) => {
    if (response.status == 200) {
      response
        .json()
        .then((buffer) => {
          // let day = new Date(buffer.dayISOString);
          let day = dayjs.utc(buffer.dayISOString);
          if (state.verbose) {
            console.info(
              `%carchive.worker.catchup()%c` +
                `   dateTimeString = %c${buffer.dateTimeString}%c` +
                `   hour = %c${buffer.hour}%c`,
              `color: ${namecolor}`,
              "",
              "color: dodgerblue",
              "",
              "color: dodgerblue",
              ""
            );
          }
          grid.dateTimeString = buffer.dateTimeString;
          grid.hoursActive = buffer.hoursActive;
          grid.daysActive = buffer.daysActive;
          grid.latestScan = buffer.latestScan;
          grid.latestHour = buffer.hour;
          grid.hour = buffer.hour;
          grid.items = buffer.items;
          grid.itemsGrouped = {};
          grid.items.forEach((item, index) => {
            let elements = item.split("-");
            let scanType = elements[2];
            if (!(scanType in grid.itemsGrouped)) {
              grid.itemsGrouped[scanType] = [];
            }
            grid.itemsGrouped[scanType].push({ item: item, index: index });
          });
          grid.yearsActive.splice(100, buffer.yearsActive.length, ...buffer.yearsActive);
          let index = grid.items.length ? grid.items.length - 1 : -1;
          if (state.update == "always") {
            index = grid.items.length - 1;
          } else if (grid.scan in grid.itemsGrouped) {
            index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
          } else {
            index = grid.items.length ? grid.items.length - 1 : -1;
          }
          setGridIndex(index);
          if (state.verbose > 1) {
            console.debug("grid.items", grid.items);
            console.debug("grid.itemsGrouped", grid.itemsGrouped);
          }
          self.postMessage({
            type: "list",
            payload: grid,
          });
          return;
        })
        .then(() => connect())
        .catch((error) => console.error(`Unexpected error ${error}`));
    } else {
      console.error("Unable to catch up.");
    }
  });
}

function setGridIndex(index) {
  if (state.verbose > 1) {
    console.debug(
      `%carchive.worker.updateGridIndex()%c ${grid.index} -> ${index}`,
      `color: ${namecolor}`,
      "color: dodgerblue"
    );
  }
  if (index < 0 || index >= grid.items.length) {
    console.error(`%carchive.worker.updateGridIndex()%c ${index} invalid`, `color: ${namecolor}`, "color: dodgerblue");
    return;
  }
  if (index == grid.index) {
    if (state.verbose > 1) {
      console.debug(`index = ${index} == grid.index = ${grid.index}. Do nothing.`);
    }
    return;
  }
  grid.index = index;
  const scan = grid.items[index];
  if (state.verbose > 1) {
    console.debug(
      `%carchive.worker.updateGridIndex()%c Calling load() ${scan} ...`,
      `color: ${namecolor}`,
      "color: dodgerblue"
    );
  }
  load(scan);
  reviseGridPaths();
  self.postMessage({
    type: "index",
    payload: { index: index, pathsActive: grid.pathsActive },
  });
}

function navigateForward() {
  let index = clamp(grid.index + 1, 0, grid.items.length - 1);
  setGridIndex(index);
}

function navigateBackward() {
  let index = clamp(grid.index - 1, 0, grid.items.length - 1);
  setGridIndex(index);
}

function navigateToEnd() {
  let index = grid.items.length - 1;
  setGridIndex(index);
}

function updateGridIndexByScan(delta) {
  if (grid.itemsGrouped.length == 0) return;
  let k = -1;
  let ii = [];
  grid.itemsGrouped[grid.scan].forEach(({ file, index }) => {
    ii.push(index);
    if (index == grid.index) {
      k = ii.length - 1;
    }
  });
  let index = ii[clamp(k + delta, 0, ii.length - 1)];
  setGridIndex(index);
}

function navigateForwardScan() {
  updateGridIndexByScan(1);
}

function navigateBackwardScan() {
  updateGridIndexByScan(-1);
}

function toggle(name = "toggle") {
  if (state.verbose > 1) {
    console.debug(`%carchive.worker.toggle()%c ${name}`, `color: ${namecolor}`, "color: dodgerblue");
  }
  if (name == state.update) {
    self.postMessage({ type: "state", payload: { update: state.update } });
    return;
  }
  const update = state.update;
  if (name == "auto") {
    if (state.update === null || state.update == "offline") {
      state.update = "scan";
    } else if (state.update == "scan") {
      state.update = "always";
    } else {
      state.update = "offline";
    }
  } else {
    state.update = name;
  }
  if (state.verbose) {
    console.log(
      `%carchive.worker.toggle()%c update = %c${state.update}%c ← ${update}`,
      `color: ${namecolor}`,
      "",
      "color: mediumpurple",
      ""
    );
  }
  if (state.update == "offline") {
    disconnect();
  } else {
    catchup();
  }
}

function reviseGridPaths() {
  if (grid.items.length == 0) {
    grid.pathsActive.fill(false);
    return;
  }
  if (grid.index < 0 || grid.index >= grid.items.length) {
    console.log(`grid.index = ${grid.index} should not happen here   length = ${grid.items.length}`);
    return;
  }
  const item = grid.items[grid.index];
  const scan = item.split("-")[2];
  const index = grid.index;
  const length = grid.itemsGrouped[scan].length;
  const first = grid.itemsGrouped[scan][0];
  const last = grid.itemsGrouped[scan][length - 1];
  grid.scan = scan;
  grid.pathsActive[0] = index != first.index;
  grid.pathsActive[1] = index != 0;
  grid.pathsActive[2] = index != grid.items.length - 1;
  grid.pathsActive[3] = index != last.index;
  if (state.verbose > 1) {
    console.debug(
      `%carchive.worker.reviseGridPaths() %c${scan}%c`,
      `color: ${namecolor}`,
      "color: dodgerblue",
      "",
      "first",
      first,
      "last",
      last,
      "pathsActive",
      grid.pathsActive
    );
  }
}

// Deprecating ... count() is now part of list.
function count(day) {
  let dayString = day.format("YYYYMMDD");
  console.warn(`%carchive.worker.count()%c DEPRECATING. You should not be using this.`, `color: ${namecolor}`, "");
  console.log(`%carchive.worker.count()%c ${pathway} ${dayString}`, `color: ${namecolor}`, "");
  let y = parseInt(dayString.slice(0, 4));
  if (y < 2012) {
    console.info("No data prior to 2013");
    return;
  }
  const url = `/data/count/${pathway}/${dayString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          console.log(buffer);
          grid.dateTimeString = day.format("YYYYMMDD-HHmm");
          grid.hoursActive = buffer.hoursActive;
          grid.latestHour =
            23 -
            grid.hoursActive
              .slice()
              .reverse()
              .findIndex((x) => x > 0);
          self.postMessage({
            type: "count",
            payload: {
              dateTimeString: grid.dateTimeString,
              hoursActive: grid.hoursActive,
            },
          });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}
