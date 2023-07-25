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
  dateTimeString: dayjs.utc().format("YYYYMMDD-HHmm"),
  daysActive: {},
  hourHasData: new Array(24).fill(false),
  pathsActive: new Array(4).fill(false),
  latestScan: "",
  latestHour: -1,
  counts: [0, 0],
  items: [],
  itemsGrouped: {},
  moreBefore: false,
  moreAfter: false,
  mode: null,
  hour: -1,
  index: -1,
  symbol: "Z",
  scan: "E4.0",
  last: null,
  tic: 0,
};
let state = {
  update: "scan",
  length: 1,
  sweeps: [],
  verbose: 0,
};
const namecolor = "#bf9140";
const frameCount = 15;

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

// IMPORTANT: During prepend/append mode, use this before updating
// grid.counts = buffer.counts after fetch(/data/list/...) because
// grid.index needs to propagate to the next list in order to
// to maintain continuity.
function suggestGridIndex(mode, { counts, items }) {
  // console.log("suggestGridIndex", counts, items);
  let index = -1;
  if (mode == "prepend" && grid.index >= 0 && grid.index < grid.counts[0]) {
    index = grid.index + counts[0];
  } else if (mode == "append" && grid.index >= grid.counts[0]) {
    index = grid.index - grid.counts[0];
  } else if (mode == "catchup") {
    if (grid.scan in grid.itemsGrouped && state.update == "scan") {
      index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
    } else {
      index = grid.items.length - 1;
    }
  } else if (mode == "select") {
    if (grid.scan in grid.itemsGrouped) {
      let k = counts[0];
      while (k < items.length) {
        const scan = items[k].split("-")[2];
        if (scan == grid.scan) {
          break;
        }
        k++;
      }
      index = k;
    } else {
      index = 0;
    }
  }
  return index;
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

function reviseGridPaths() {
  if (grid.items.length == 0 || grid.index < 0 || grid.index >= grid.items.length) {
    grid.pathsActive.fill(false);
    return;
  }
  const item = grid.items[grid.index];
  const scan = item.split("-")[2];
  const index = grid.index;
  const length = grid.itemsGrouped[scan].length;
  const first = grid.itemsGrouped[scan][0];
  const last = grid.itemsGrouped[scan][length - 1];
  grid.pathsActive[0] = index != first.index;
  grid.pathsActive[1] = index != 0;
  grid.pathsActive[2] = index != grid.items.length - 1;
  grid.pathsActive[3] = index != last.index;
  if (state.verbose > 1) {
    console.debug(
      `%carchive.worker.reviseGridPaths %c${scan}%c`,
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
}

function findLastInGroup() {
  let address = -1;
  grid.itemsGrouped[grid.scan].some(({ index }, k) => {
    if (index == grid.index) {
      address = k;
      return true;
    }
    return false;
  });
  return address;
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
        grid.mode = "navigate";
        setGridIndex(grid.items.length - 1);
      }
      return;
    }
  }
  console.info(`%carchive.worker.connect%c ${pathway}%c ...`, `color: ${namecolor}`, "color: dodgerblue", "");
  source = new EventSource("/events/");
  // Only pick up event that matches the pathway
  source.addEventListener(pathway, (event) => {
    const payload = JSON.parse(event.data);
    payload.items.forEach((item) => {
      const elements = item.split("-");
      const symbol = elements[3];
      const scan = elements[2];
      const t = elements[1];
      const d = elements[0];
      if (state.verbose) {
        console.info(
          `%carchive.worker.connect%c ${d} ${t} ${scan} ${symbol} ${state.update}`,
          `color: ${namecolor}`,
          ""
        );
      }
      if (symbol != grid.symbol) {
        return;
      }
      if (grid.items.indexOf(item) > 0) {
        // console.warn(`Item ${item} exists.`);
        return;
      }
      const listHour = t.slice(0, 2);
      const dateTimeString = `${d}-${listHour}00`;
      if (grid.dateTimeString != dateTimeString) {
        grid.dateTimeString = dateTimeString;
        grid.hour = parseInt(listHour);
        grid.items = grid.items.slice(grid.counts[0]);
        grid.counts = [grid.counts[1], 0];
        if (state.verbose) {
          console.info(`%carchive.worker.connect%c   ${dateTimeString} ${grid.hour}`, `color: ${namecolor}`, "");
        }
      }
      grid.items.push(item);
      grid.counts[1]++;
    });
    reviseGridItemsGrouped();
    grid.hourHasData = payload.hoursActive.map((x) => x > 0);
    grid.latestHour =
      23 -
      grid.hourHasData
        .slice()
        .reverse()
        .findIndex((x) => x == true);
    grid.mode = "catchup";
    if (state.update == "always") {
      setGridIndex(grid.items.length - 1);
    } else if (grid.scan in grid.itemsGrouped) {
      let index = grid.itemsGrouped[grid.scan].at(-1).index;
      if (index == grid.index) {
        // Post a list update since we won't load anything
        grid.tic++;
        reviseGridPaths();
        self.postMessage({ type: "list", grid: grid });
      } else if (state.length > 1) {
        // Use select() to select the latest index to update the animation list
        state.length = 1;
        grid.index = index;
        select(index, "catchup");
      } else {
        // Load the latest index that matches the scan
        setGridIndex(index);
      }
    }
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
  console.info(`%carchive.worker.disconnect%c ${pathway}%c ...`, `color: ${namecolor}`, "color: dodgerblue", "");
  source.close();
  source = null;
  self.postMessage({
    type: "state",
    payload: { update: state.update },
  });
}

function createSweep(name = "20130520-190001-E2.6-Z") {
  const components = name.split("-");
  const timeString =
    `${components[0].slice(0, 4)}/` +
    `${components[0].slice(4, 6)}/` +
    `${components[0].slice(6, 8)} ` +
    `${components[1].slice(0, 2)}:` +
    `${components[1].slice(2, 4)}:` +
    `${components[1].slice(4, 6)} UTC`;
  const isRHI = components[2][0] == "A";
  const symbol = components[3];
  const angle = parseFloat(components[2].slice(1));
  const scan = (isRHI ? "Az" : "El") + "  " + angle.toFixed(1);
  // Pad an extra azimuth and elevation
  return {
    name,
    symbol,
    timeString,
    isRHI,
    nb: 4,
    nr: 3,
    nx: 0,
    age: "long time ago",
    time: dayjs.utc(timeString).unix(),
    titleString: `${timeString}  ${scan}°`,
    infoString: "No data",
    scanElevation: isRHI ? 0.0 : angle,
    scanAzimuth: isRHI ? angle : 0.0,
    rangeStart: 0.0,
    rangeSpacing: 0.2,
    elevations: [4.0, 4.0, 4.0, 4.0, 4.0],
    azimuths: [0.0, 15.0, 30.0, 45.0, 60.0],
    values: [32, 77, 30, 10, 20, 15, 50, 60, 50, 80, 90, 100],
  };
}

async function load(names) {
  let count = 0;
  let append = false;
  if (names.length > 1) {
    if (state.sweeps.length > 2) {
      let newNames = state.sweeps.slice(-(frameCount - 1)).map((x) => x.name);
      newNames.push(names.at(-1));
      if (JSON.stringify(names) === JSON.stringify(newNames)) {
        names = names.slice(-1);
        append = true;
      }
    }
    if (!append) {
      self.postMessage({ type: "progress", payload: { progress: 1, message: "Loading scans ..." } });
    }
  }
  await Promise.all(
    names.map(async (name) => {
      const url = `/data/load/${pathway}/${name}/`;
      console.info(`%carchive.worker.load %c${url}%c`, `color: ${namecolor}`, "color: dodgerblue", "");
      return fetch(url, { cache: "force-cache" })
        .then(async (response) => {
          if (response.status == 200) {
            return response.arrayBuffer().then((buffer) => {
              let sweep = geometry({
                ...createSweep(name),
                ...sweepParser.parse(new Uint8Array(buffer)),
              });
              sweep.info = JSON.parse(sweep.info);
              sweep.infoString = `Gatewidth: ${sweep.info.gatewidth} m\nWaveform: ${sweep.info.waveform}`;
              if (sweep.nb == 0 || sweep.nr == 0) {
                sweep = geometry(createSweep(name));
              }
              if (names.length > 1) {
                count++;
                self.postMessage({
                  type: "progress",
                  payload: {
                    progress: Math.floor((count / names.length) * 100),
                    message:
                      grid.mode == "catchup"
                        ? `New scan ${names.at(-1)}`
                        : `Loading scans ... ${count} / ${names.length}`,
                  },
                });
              }
              return sweep;
            });
          } else if (response.status == 503) {
            console.log("Refresh to main index for maintenance page.");
            // document.location.reload();
            return false;
          } else {
            return response.text().then((text) => {
              console.info(text);
              self.postMessage({ type: "reset", payload: text });
              return false;
            });
          }
        })
        .catch((error) => {
          console.error(`Unexpected error ${error}`);
        });
    })
  ).then((sweeps) => {
    if (sweeps.includes(null)) {
      console.log("There are invalid sweeps");
      console.log(sweeps);
    }
    if (append) {
      let newSweeps = state.sweeps.slice(-14);
      newSweeps.push(sweeps[0]);
      state.sweeps = newSweeps;
    } else {
      state.sweeps = sweeps;
    }
    grid.last = state.sweeps.at(-1).name;
    let scan = grid.last.split("-").at(2);
    if (state.verbose) {
      console.debug(
        `%carchive.worker.load%c grid.scan = %c${scan}%c ← ${grid.scan}   grid.mode = ${grid.mode}`,
        `color: ${namecolor}`,
        "",
        "color: dodgerblue",
        ""
      );
    }
    grid.scan = scan;
    grid.tic++;
    self.postMessage({ type: "load", grid: grid, payload: state.sweeps });
  });
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

function setGridIndex(index) {
  if (state.verbose > 1) {
    console.debug(
      `%carchive.worker.setGridIndex %c${index}%c ← ${grid.index}`,
      `color: ${namecolor}`,
      "color: dodgerblue",
      ""
    );
  }
  if (index < 0 || index >= grid.items.length) {
    if (state.verbose > 1) {
      console.debug(
        `%carchive.worker.setGridIndex %cindex%c == ${index}. Early return.`,
        `color: ${namecolor}`,
        "color: dodgerblue",
        ""
      );
    }
    grid.index = index;
    reviseGridPaths();
    return;
  }
  const scan = grid.items[index];
  if (scan == grid.last) {
    if (state.verbose > 1) {
      console.debug(
        `%carchive.worker.setGridIndex%c scan = %c${scan}%c ← ${grid.last}. Early return.`,
        `color: ${namecolor}`,
        "",
        "color: dodgerblue",
        ""
      );
    }
    return;
  }
  if (state.verbose > 1) {
    console.debug(
      `%carchive.worker.setGridIndex%c Loading %c${scan}%c ...`,
      `color: ${namecolor}`,
      "",
      "color: dodgerblue",
      ""
    );
  }
  grid.index = index;
  reviseGridPaths();
  state.length = 1;
  load([scan]);
}

//

self.onmessage = ({ data: { task, name, date, symbol } }) => {
  let day = dayjs.utc(0);
  if (date !== undefined) {
    day = dayjs.utc(date * 1000);
  }
  if (state.verbose) {
    let more = day > 0 ? `   day = ${day.format("YYYYMMDD-HHMM")}` : "";
    console.log(`%carchive.worker.onmessage%c ${task}${more}`, "color: hotpink", "");
  }
  if (task == "init") {
    init(name);
  } else if (task == "list") {
    list(day, symbol);
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
  } else if (task == "select") {
    select(name);
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
    console.info(`%carchive.worker.init%c ${pathway}`, `color: ${namecolor}`, "color: dodgerblue");
  }
  self.postMessage({ type: "init", grid: grid });
}

// Expect something like day = dayjs.utc('2013-05-20'), symbol = 'Z', mode = prepend, append, select, catchup
function list(day, symbol, mode = "select") {
  let dateTimeString = day.format("YYYYMMDD-HH00");
  console.info(
    `%carchive.worker.list%c ${pathway} %c${dateTimeString}%c ← ${grid.dateTimeString} ${symbol} ${grid.index}`,
    `color: ${namecolor}`,
    "",
    "color: mediumpurple",
    ""
  );
  // Same time, just a symbol change (this part should be phased out, no need to have symbol in the list)
  if (dateTimeString == grid.dateTimeString) {
    let index = grid.index;
    let currentItems = grid.items;
    grid.mode = "switch";
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
    if (grid.symbol == symbol) {
      // Repeated tab, assume switching out of catchup to list mode
      index = suggestGridIndex(mode, grid);
    }
    grid.symbol = symbol;
    grid.tic++;
    setGridIndex(index);
    self.postMessage({ type: "list", grid: grid });
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
          grid.tic++;
          grid.hour = buffer.hour;
          grid.symbol = symbol;
          grid.hourHasData = buffer.hoursActive.map((x) => x > 0);
          grid.dateTimeString = dateTimeString;
          grid.latestHour =
            23 -
            grid.hourHasData
              .slice()
              .reverse()
              .findIndex((x) => x == true);
          grid.mode = mode;
          grid.counts = buffer.counts;
          grid.items = buffer.items;
          grid.moreBefore = buffer.moreBefore;
          grid.moreAfter = buffer.moreAfter;
          reviseGridItemsGrouped();
          let index = suggestGridIndex(mode, buffer);
          if (mode == "prepend" || mode == "append") {
            grid.index = index;
            self.postMessage({ type: "list", grid: grid });
          } else {
            setGridIndex(index);
          }
          if (mode !== "select") {
          }
          if (grid.hour < 0) {
            self.postMessage({ type: "message", payload: "No Data" });
            return;
          }
        });
      } else {
        console.info(`%carchive.worker.list%c response.status = ${response.status} != 200`, `color: ${namecolor}`, "");
        response.text().then((response) => {
          self.postMessage({ type: "message", payload: response });
        });
      }
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

// Expect something like day = dayjs.utc('2013-05-20'), hour = 19, symbol = 'Z'
function month(day) {
  let dayString = day.format("YYYYMM01");
  console.info(`%carchive.worker.month%c ${pathway} ${dayString}`, `color: ${namecolor}`, "");
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

function toggle(name = "toggle") {
  if (state.verbose > 1) {
    console.debug(`%carchive.worker.toggle %c${name}`, `color: ${namecolor}`, "color: dodgerblue");
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
      `%carchive.worker.toggle%c update = %c${state.update}%c ← ${update}`,
      `color: ${namecolor}`,
      "",
      "color: mediumpurple",
      ""
    );
  }
  if (state.update == "offline") {
    disconnect();
  } else if (source == null || source.readyState == 2) {
    if (state.verbose) {
      console.log("%carchive.worker.toggle%c calling catchup ...", `color: ${namecolor}`, "");
    }
    catchup();
  } else {
    // Still connected, just changing the live update mode
    self.postMessage({ type: "state", payload: { update: state.update } });
    let index = suggestGridIndex("catchup", { counts: grid.counts, items: grid.items });
    setGridIndex(index);
  }
}

function catchup() {
  console.info(`%carchive.worker.catchup%c ${pathway}`, `color: ${namecolor}`, "color: dodgerblue");
  fetch(`/data/catchup/${pathway}/`).then((response) => {
    if (response.status == 200) {
      response
        .json()
        .then((buffer) => {
          console.info(
            `%carchive.worker.catchup %c${pathway} %c${buffer.dateTimeString}%c`,
            `color: ${namecolor}`,
            "color: dodgerblue",
            "color:mediumpurple",
            ""
          );
          grid.dateTimeString = buffer.dateTimeString;
          grid.hourHasData = buffer.hoursActive.map((x) => x > 0);
          grid.daysActive = buffer.daysActive;
          grid.latestScan = buffer.latestScan;
          grid.latestHour = buffer.hour;
          grid.hour = buffer.hour;
          grid.items = buffer.items;
          grid.counts = buffer.counts;
          grid.moreBefore = buffer.moreBefore;
          grid.moreAfter = buffer.moreAfter;
          grid.mode = "catchup";
          reviseGridItemsGrouped();
          let index = suggestGridIndex("catchup", buffer);
          if (state.verbose) {
            console.info(
              `%carchive.worker.catchup%c` +
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
          setGridIndex(index);
          if (state.verbose > 1) {
            console.debug("grid.items", grid.items);
            console.debug("grid.itemsGrouped", grid.itemsGrouped);
          }
          self.postMessage({
            type: "list",
            grid: grid,
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

function prepend() {
  console.log(`%carchive.worker.prepend%c`, `color: ${namecolor}`, "color: dodgerblue");
  let day = dayjs.utc(grid.dateTimeString.slice(0, 8)).hour(grid.hour).subtract(1, "hour");
  list(day, grid.symbol, "prepend");
}

function append() {
  console.log(`%carchive.worker.append%c`, `color: ${namecolor}`, "color: dodgerblue");
  let day = dayjs.utc(grid.dateTimeString.slice(0, 8)).hour(grid.hour).add(1, "hour");
  list(day, grid.symbol, "append");
}

function select(index, hint = "load") {
  grid.mode = hint;
  if (index == grid.index && state.length == 1) {
    let tail = findLastInGroup();
    let head = Math.max(0, tail - frameCount + 1);
    let items = grid.itemsGrouped[grid.scan].slice(head, tail + 1);
    const names = items.map((item) => item.item);
    state.length = names.length;
    load(names);
    return;
  } else {
    grid.last = null;
  }
  setGridIndex(index);
}

function navigateForward() {
  let index = clamp(grid.index + 1, 0, grid.items.length - 1);
  setGridIndex(index);
}

function navigateBackward() {
  let index = clamp(grid.index - 1, 0, grid.items.length - 1);
  grid.mode = "navigate";
  setGridIndex(index);
}

function navigateForwardScan() {
  grid.mode = "navigate";
  updateGridIndexByScan(1);
}

function navigateBackwardScan() {
  grid.mode = "navigate";
  updateGridIndexByScan(-1);
}

function dummy() {
  let sweep = createSweep();
  sweep = geometry(sweep);
  self.postMessage({ type: "load", payload: sweep });
}
