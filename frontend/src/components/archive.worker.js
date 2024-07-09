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
import { vec3 } from "gl-matrix";
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
  availableSymbols: ["Z"],
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
const nameStyle = "background-color: #bf9140; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";
const frameCount = 15;

const sweepParser = new Parser()
  .endianess("little")
  .uint16("nb")
  .uint16("nr")
  .uint16("nx")
  .uint16("attr")
  .doublele("time")
  .doublele("latitude")
  .doublele("longitude")
  .doublele("altitude")
  .floatle("offsetX")
  .floatle("offsetY")
  .floatle("offsetZ")
  .floatle("_notused4")
  .floatle("sweepElevation")
  .floatle("sweepAzimuth")
  .floatle("rangeStart")
  .floatle("rangeSpacing")
  .string("info", { length: "nx" })
  .array("ei16", { type: "int16le", length: "nb" })
  .array("au16", { type: "uint16le", length: "nb" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.nb * this.nr;
    },
  });

// IMPORTANT: During prepend/append mode, use this before updating
// grid.counts = buffer.counts after fetch(/data/table/...) because
// grid.index needs to propagate to the next table in order to
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
      nameStyle,
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
  console.info(`%carchive.worker.connect%c ${pathway}%c ...`, nameStyle, "color: dodgerblue", "");
  source = new EventSource("/events/");
  // Only pick up event that matches the pathway
  source.addEventListener(pathway, (event) => {
    const payload = JSON.parse(event.data);
    payload.items.forEach((item) => {
      const elements = item.split("-");
      const scan = elements[2];
      const t = elements[1];
      const d = elements[0];
      if (state.verbose) {
        console.info(`%carchive.worker.connect%c ${d} ${t} ${scan} ${state.update}`, nameStyle, "");
      }
      if (grid.items.indexOf(item) > 0) {
        // console.warn(`Item ${item} exists.`);
        return;
      }
      const tableHour = t.slice(0, 2);
      const dateTimeString = `${d}-${tableHour}00`;
      if (grid.dateTimeString != dateTimeString) {
        grid.dateTimeString = dateTimeString;
        grid.hour = parseInt(tableHour);
        grid.items = grid.items.slice(grid.counts[0]);
        grid.counts = [grid.counts[1], 0];
        if (state.verbose) {
          console.info(`%carchive.worker.connect%c ${dateTimeString} ${grid.hour}`, nameStyle, "");
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
        // Post a table update since we won't load anything
        grid.tic++;
        reviseGridPaths();
        self.postMessage({ type: "table", grid: grid });
      } else if (state.length > 1) {
        // Use select() to select the latest index to update the animation table
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
    fetch("/state/cache/").then((response) => {
      if (response.status == 503) {
        // Server went into maintenance mode
        self.postMessage({ type: "503" });
      }
    });
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
  console.info(`%carchive.worker.disconnect%c ${pathway}%c ...`, nameStyle, "color: dodgerblue", "");
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
  const mode = components[2][0];
  const symbol = components[3];
  const angle = parseFloat(components[2].slice(1));
  const scan = mode == "A" ? "Az " + angle.toFixed(1) : mode == "E" ? "El " + angle.toFixed(1) : components[2];
  // Pad an extra azimuth and elevation
  return {
    name,
    symbol,
    timeString,
    mode,
    nb: 4,
    nr: 3,
    nx: 0,
    age: "long time ago",
    time: dayjs.utc(timeString).unix(),
    titleString: `${timeString}  ${scan}°`,
    infoString: "No data",
    sweepElevation: mode == "E" ? angle : 0.0,
    sweepAzimuth: mode == "A" ? angle : 0.0,
    rangeStart: 0.0,
    rangeSpacing: 0.2,
    ei16: [728, 728, 728, 728, 728],
    au16: [60075, 62805, 0, 2730, 5461],
    values: [32, 77, 30, 10, 20, 15, 50, 60, 50, 80, 90, 100],
  };
}

async function load(items) {
  let count = 0;
  let append = false;
  if (items.length > 1) {
    if (state.sweeps.length > 2) {
      let newNames = state.sweeps.slice(-(frameCount - 1)).map((x) => x.name);
      newNames.push(items.at(-1));
      if (JSON.stringify(items) === JSON.stringify(newNames)) {
        items = items.slice(-1);
        append = true;
      }
    }
    if (!append) {
      self.postMessage({ type: "progress", payload: { progress: 1, message: "Loading scans ..." } });
    }
  }
  await Promise.all(
    items.map(async (item) => {
      const key = `${item}-${grid.symbol}`;
      const url = `/data/load/${pathway}/${key}/`;
      console.info(`%carchive.worker.load%c ${url}%c`, nameStyle, "color: dodgerblue", "");
      // "force-cache" or "no-cache"
      return fetch(url, { cache: "no-cache" })
        .then(async (response) => {
          if (response.status == 200) {
            return response.arrayBuffer().then((buffer) => {
              let sweep = {
                ...createSweep(key),
                ...sweepParser.parse(new Uint8Array(buffer)),
              };
              // console.log(sweep.info);
              const gwMeters = Math.round(1.0e3 * sweep.rangeSpacing);
              sweep.info = JSON.parse(sweep.info);
              sweep.infoString = `PRF: ${sweep.info.prf} Hz\nGatewidth: ${gwMeters} m\nWaveform: ${sweep.info.wf}`;
              sweep = geometry(sweep);
              // console.log(`%carchive.worker.load%c`, nameStyle, "", sweep);
              if (sweep.nb == 0 || sweep.nr == 0) {
                sweep = geometry(createSweep(item));
              }
              if (items.length > 1) {
                count++;
                self.postMessage({
                  type: "progress",
                  payload: {
                    progress: Math.floor((count / items.length) * 100),
                    message:
                      grid.mode == "catchup"
                        ? `New scan ${items.at(-1)}`
                        : `Loading scans ... ${count} / ${items.length}`,
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
        nameStyle,
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

function geometryMonostatic(sweep) {
  const scan = sweep["name"].split("-")[2];
  const rs = sweep.rangeStart;
  const re = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
  const midx = clamp(sweep.nb / 2, 0, sweep.nb - 1);
  const mod_az = (a) => (a < -Math.PI ? a + 2.0 * Math.PI : a > Math.PI ? a - 2.0 * Math.PI : a);
  const elevations = sweep.elevations.map((x) => deg2rad(x));
  const azimuths = sweep.azimuths.map((x) => deg2rad(x));
  let el_pad = 0.0;
  let az_pad = 0.0;
  if (scan[0] == "E") {
    const da = mod_az(azimuths[midx] - azimuths[midx - 1]);
    el_pad = elevations[sweep.nb - 1];
    az_pad = azimuths[sweep.nb - 1] + da;
  } else if (scan[0] == "A") {
    const de = elevations[midx] - elevations[midx - 1];
    el_pad = elevations[sweep.nb - 1] + de;
    az_pad = azimuths[sweep.nb - 1];
  } else {
    const da = mod_az(azimuths[midx] - azimuths[midx - 1]);
    const de = elevations[midx] - elevations[midx - 1];
    el_pad = elevations[sweep.nb - 1] + de;
    az_pad = azimuths[sweep.nb - 1] + da;
  }
  elevations.push(el_pad);
  azimuths.push(az_pad);
  let points = [];
  let origins = [];
  let elements = [];
  for (let k = 0; k < sweep.nb + 1; k++) {
    const e = elevations[k];
    const a = azimuths[k];
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

function geometryBistatic(sweep) {
  const scan = sweep["name"].split("-")[2];
  const nbp1 = sweep.nb + 1;
  const nrp1 = sweep.nr + 1;
  const midx = clamp(sweep.nb / 2, 0, sweep.nb - 1);
  const mod_az = (a) => (a < -Math.PI ? a + 2.0 * Math.PI : a > Math.PI ? a - 2.0 * Math.PI : a);
  const elevations = sweep.elevations.map((x) => deg2rad(x));
  const azimuths = sweep.azimuths.map((x) => deg2rad(x));
  let el_pad = 0.0;
  let az_pad = 0.0;
  if (scan[0] == "E") {
    const da = mod_az(azimuths[midx] - azimuths[midx - 1]);
    el_pad = elevations[sweep.nb - 1];
    az_pad = azimuths[sweep.nb - 1] + da;
  } else if (scan[0] == "A") {
    const de = elevations[midx] - elevations[midx - 1];
    el_pad = elevations[sweep.nb - 1] + de;
    az_pad = azimuths[sweep.nb - 1];
  } else {
    const da = mod_az(azimuths[midx] - azimuths[midx - 1]);
    const de = elevations[midx] - elevations[midx - 1];
    el_pad = elevations[sweep.nb - 1] + de;
    az_pad = azimuths[sweep.nb - 1] + da;
  }
  elevations.push(el_pad);
  azimuths.push(az_pad);
  const o = [0, 0, 0];
  const d = vec3.length([sweep.offsetX, sweep.offsetY, sweep.offsetZ]);
  const va = Math.atan2(sweep.offsetX, sweep.offsetY);
  const ve = Math.asin(sweep.offsetZ / d);
  const rr = Array.from({ length: nrp1 }, (_, i) => i * sweep.rangeSpacing + sweep.rangeStart + d);
  const pu = elevations.map((e, i) => {
    const a = azimuths[i];
    const h = Math.cos(e);
    const x = h * Math.sin(a);
    const y = h * Math.cos(a);
    const z = Math.sin(e);
    return [x, y, z];
  });
  const pc = pu.map((x) => vec3.rotateX([], vec3.rotateZ([], x, o, va), o, -ve));
  const bt = pc.map((x) => Math.acos(x[1]));
  const dc = bt.map((b) => d * Math.cos(b));
  const ranges = [];
  dc.forEach((x) => rr.forEach((r) => ranges.push((r ** 2 - d ** 2) / (2 * (r - x)))));
  // REGL.Elements buffer is limited to 16-bit (OpenGL stuff), so we limit ourselves to 65535 indices
  let points = [];
  let origins = [];
  let elements = [];
  const dr = 10;
  for (let k = 0; k < nbp1; k++) {
    const e = elevations[k];
    const a = azimuths[k];
    const v = k / sweep.nb;
    const ce = Math.cos(e);
    const se = Math.sin(e);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rr = ranges.slice(k * nrp1, (k + 1) * nrp1);
    const xp = ce * sa;
    const yp = ce * ca;
    const calculateAndPush = (j) => {
      const r = rr[j];
      const x = r * xp;
      const y = r * yp;
      const z = r * se;
      const u = j / sweep.nr;
      points.push(x, y, z);
      origins.push(u, v);
    };
    // First 10 elements in steps of 1, then steps of 10, and the final element
    for (let j = 0; j < 10; j++) {
      calculateAndPush(j);
    }
    for (let j = 10; j < nrp1 - dr - 1; j += dr) {
      calculateAndPush(j);
    }
    calculateAndPush(nrp1 - 1);
  }
  let nrx = 0;
  for (let j = 0; j < 10; j++) {
    nrx++;
  }
  for (let j = 10; j < nrp1 - dr - 1; j += dr) {
    nrx++;
  }
  nrx++;
  if (nrx * nbp1 > 65535) {
    const style = "background-color: #ff0000; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";
    console.error(
      `%cWARNING%c Too many points. nrx = ${nrx} -> ${nrx * nbp1} elements. Limit is 65535.`,
      style,
      "color: red"
    );
  }
  for (let k = 0; k < sweep.nb; k++) {
    for (let o = k * nrx, l = o + nrx - 1; o < l; o++) {
      let m = o + nrx;
      let n = o + 1;
      elements.push(o, m, n);
      elements.push(m, n, m + 1);
    }
  }
  sweep.points = points;
  sweep.origins = origins;
  sweep.elements = elements;
  return sweep;
}

function geometry(sweep) {
  sweep.elevations = sweep.ei16.map((x) => (x * 180.0) / 32768.0);
  sweep.azimuths = sweep.au16.map((x) => (x * 360.0) / 65536.0);
  if (sweep.attr == 1) {
    return geometryBistatic(sweep);
  }
  return geometryMonostatic(sweep);
}

function setGridIndex(index) {
  if (state.verbose > 1) {
    console.debug(`%carchive.worker.setGridIndex %c${index}%c ← ${grid.index}`, nameStyle, "color: dodgerblue", "");
  }
  if (index < 0 || index >= grid.items.length) {
    if (state.verbose > 1) {
      console.debug(
        `%carchive.worker.setGridIndex %cindex%c == ${index}. Early return.`,
        nameStyle,
        "color: dodgerblue",
        ""
      );
    }
    grid.index = index;
    reviseGridPaths();
    return;
  }
  const scan = grid.items[index];
  if (scan == grid.last && grid.mode != "switch") {
    if (state.verbose > 1) {
      console.debug(
        `%carchive.worker.setGridIndex%c scan = %c${scan}%c ← ${grid.last}. Early return.`,
        nameStyle,
        "",
        "color: dodgerblue",
        ""
      );
    }
    return;
  }
  if (state.verbose > 1) {
    console.debug(`%carchive.worker.setGridIndex%c Loading %c${scan}%c ...`, nameStyle, "", "color: dodgerblue", "");
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
  } else if (task == "table") {
    table(day);
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
  } else if (task == "change") {
    change(symbol);
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
    console.info(`%carchive.worker.init%c ${pathway}`, nameStyle, "color: dodgerblue");
  }
  self.postMessage({ type: "init", grid: grid });
}

// Expect something like day = dayjs.utc('2013-05-20'), mode = prepend, append, select, catchup
function table(day, mode = "select") {
  let dateTimeString = day.format("YYYYMMDD-HH00");
  console.info(
    `%carchive.worker.table%c ${pathway} %c${dateTimeString}%c ← ${grid.dateTimeString} ${grid.index}`,
    nameStyle,
    "",
    "color: mediumpurple",
    ""
  );
  // Same time, just a symbol change (this part should be phased out, no need to have symbol in the table)
  // Could highlight where selected product is available
  if (dateTimeString == grid.dateTimeString) {
    return;
  }
  // Different time, fetch from the server
  const url = `/data/table/${pathway}/${dateTimeString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200) {
        response.json().then((buffer) => {
          if (state.verbose > 1) {
            console.debug("table buffer", buffer);
          }
          grid.tic++;
          grid.hour = buffer.hour;
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
            self.postMessage({ type: "table", grid: grid });
          } else {
            setGridIndex(index);
          }
          if (grid.hour < 0) {
            self.postMessage({ type: "message", payload: "No Data" });
            return;
          }
        });
      } else {
        console.info(`%carchive.worker.table%c response.status = ${response.status} != 200`, nameStyle, "");
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
  console.info(`%carchive.worker.month%c ${pathway} ${dayString}`, nameStyle, "");
  const url = `/data/month/${pathway}/${dayString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.daysActive = { ...grid.daysActive, ...buffer };
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
    console.debug(`%carchive.worker.toggle %c${name}`, nameStyle, "color: dodgerblue");
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
      nameStyle,
      "",
      "color: mediumpurple",
      ""
    );
  }
  if (state.update == "offline") {
    disconnect();
  } else if (source == null || source.readyState == 2) {
    if (state.verbose) {
      console.log("%carchive.worker.toggle%c calling catchup ...", nameStyle, "");
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
  console.info(`%carchive.worker.catchup%c ${pathway}`, nameStyle, "color: dodgerblue");
  fetch(`/data/catchup/${pathway}/`).then((response) => {
    if (response.status == 200) {
      response
        .json()
        .then((buffer) => {
          console.info(
            `%carchive.worker.catchup%c ${pathway} %c${buffer.dateTimeString}%c`,
            nameStyle,
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
              nameStyle,
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
          self.postMessage({ type: "table", grid: grid });
          return;
        })
        .then(() => connect())
        .catch((error) => console.error(`Unexpected error ${error}`));
    } else if (response.status == 503) {
      console.log("Server went into maintenance mode");
      self.postMessage({ type: "reload" });
    } else {
      console.error("Unable to catch up.");
    }
  });
}

function prepend() {
  console.log(`%carchive.worker.prepend%c`, nameStyle, "color: dodgerblue");
  let day = dayjs.utc(grid.dateTimeString.slice(0, 8)).hour(grid.hour).subtract(1, "hour");
  table(day, "prepend");
}

function append() {
  console.log(`%carchive.worker.append%c`, nameStyle, "color: dodgerblue");
  let day = dayjs.utc(grid.dateTimeString.slice(0, 8)).hour(grid.hour).add(1, "hour");
  table(day, "append");
}

function change(symbol = "Z") {
  if (grid.symbol == symbol) {
    if (state.verbose) {
      console.info(`%carchive.worker.change%c Same symbol ${symbol}, do nothing`, nameStyle, "");
    }
    return;
  }
  grid.symbol = symbol;
  grid.mode = "switch";
  setGridIndex(grid.index);
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
