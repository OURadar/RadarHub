//
//  archive.worker.js
//  RadarHub
//
//  A separate web worker to load and parse arhived data in the background
//
//  Created by Boonleng Cheong
//

import { Parser } from "binary-parser";
import { deg2rad, clamp } from "./common";

self.onmessage = ({ data: { task, name, day, time } }) => {
  if (task == "load") {
    load(name);
  } else if (task == "list") {
    list(time);
  } else if (task == "count") {
    count(day);
  } else if (task == "month") {
    month(day);
  } else if (task == "dummy") {
    dummy();
  }
};

const sweepParser = new Parser()
  .endianess("little")
  .uint16("na")
  .uint16("nr")
  .uint16("reserved1")
  .uint16("reserved2")
  .doublele("time")
  .doublele("longitude")
  .doublele("latitude")
  .doublele("reserved3")
  .floatle("scanElevation")
  .floatle("scanAzimuth")
  .floatle("rangeStart")
  .floatle("rangeSpacing")
  .array("elevations", { type: "floatle", length: "na" })
  .array("azimuths", { type: "floatle", length: "na" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.na * this.nr;
    },
  });

function createSweep(name = "dummy") {
  // Pad an extra azimuth and elevation
  return {
    name,
    na: 4,
    nr: 3,
    time: 9,
    timeString: '1970/01/01 00:00:00 UTC',
    symbol: 'U',
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

function month(day) {
  console.log(`%carchive.worker.month() ${day}`, "color: lightseagreen");
  const url = `/data/month/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          self.postMessage({ type: "month", payload: buffer });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function count(day) {
  console.log(`%carchive.worker.count() ${day}`, "color: lightseagreen");
  const url = `/data/count/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          self.postMessage({ type: "count", payload: buffer.count });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function list(day) {
  console.log(`%carchive.worker.list() ${day}`, "color: lightseagreen");
  const url = `/data/list/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          let groups = {};
          buffer.list.forEach((file) => {
            let elements = file.split("-");
            let scanType = elements[3];
            if (!(scanType in groups)) {
              groups[scanType] = [];
            }
            groups[scanType].push(file);
          });
          console.log(groups);
          self.postMessage({
            type: "list",
            payload: { list: buffer.list, groups: groups },
          });
        });
      else
        response.text().then((response) => {
          self.postMessage({ type: "message", payload: response });
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function load(name) {
  const url = `/data/load/${name}/`;
  console.log(`Background fetching ${url}`);
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.arrayBuffer().then((buffer) => {
          let sweep = geometry({
            ...createSweep(name),
            ...sweepParser.parse(new Uint8Array(buffer)),
          });
          // console.log(sweep);
          let components = sweep.name.split('-')
          let ymd = components[1]
          let hms = components[2]
          sweep.timeString = ymd.substring(0, 4) + '/'
                      + ymd.substring(4, 6) + '/'
                      + ymd.substring(6, 8) + ' '
                      + hms.substring(0, 2) + ':'
                      + hms.substring(2, 4) + ':'
                      + hms.substring(4, 6) + ' UTC'
          sweep.symbol = components[4].split('.')[0]
          console.log(`timeString = ${sweep.timeString}   symbol = ${sweep.symbol}`)
      
          self.postMessage({ type: "load", payload: sweep });
        });
      else {
        response.text().then((text) => {
          console.log(text);
          self.postMessage({ type: "reset", payload: text });
        });
      }
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function dummy() {
  let sweep = createSweep();
  sweep = geometry(sweep);
  self.postMessage({ type: "load", payload: sweep });
}

function geometry(sweep) {
  let points = [];
  let origins = [];
  let elements = [];
  const e = deg2rad(sweep.scanElevation);
  const rs = sweep.rangeStart;
  const re = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
  const ce = Math.cos(e);
  const z = Math.sin(e);
  const m = clamp(sweep.na / 2, 0, sweep.na - 1);
  const da = sweep.azimuths[m] - sweep.azimuths[m - 1];
  let az = sweep.azimuths[sweep.na - 1] + da;
  sweep.azimuths.push(az);
  for (let k = 0; k < sweep.azimuths.length; k++) {
    const a = deg2rad(sweep.azimuths[k]);
    const v = k / sweep.na;
    const x = ce * Math.sin(a);
    const y = ce * Math.cos(a);
    points.push(rs * x, rs * y, rs * z);
    points.push(re * x, re * y, re * z);
    origins.push(0, v);
    origins.push(1, v);
  }
  for (let o = 2, l = 2 * sweep.na; o <= l; o += 2) {
    elements.push(o - 2, o - 1, o);
    elements.push(o - 1, o, o + 1);
  }
  sweep.points = points;
  sweep.origins = origins;
  sweep.elements = elements;
  return sweep;
}

// fetch("/data/binary/PX-20200520-060102")
//   .then((resp) => resp.arrayBuffer())
//   .then((data) => {
//     var elev = new Float32Array(data.slice(0, 4));
//     var bytes = new Uint8Array(data.slice(4));
//     console.log(`elev = ${elev}`);
//     console.log(bytes);
//   });

// fetch("/data/header/PX-20130520-191140-E2.6-Z.nc/")
//   .then((resp) => resp.json())
//   .then((data) => {
//     console.log(data);
//   });
