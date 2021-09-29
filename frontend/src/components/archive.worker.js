//
//  archive.worker.js
//  RadarHub
//
//  A separate web worker to load and parse arhived data in the background
//
//  Created by Boonleng Cheong
//

import { Parser } from "binary-parser";
import { deg2rad } from "./common";

const sweepParser = new Parser()
  .endianess("little")
  .uint16("na")
  .uint16("nr")
  .array("azimuth", { type: "floatle", length: "na" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.na * this.nr;
    },
  });

self.onmessage = ({ data: { task, name, day, time } }) => {
  if (task == "load") {
    load(name);
  } else if (task == "list") {
    list(time);
  } else if (task == "count") {
    count(day);
  } else if (task == "dummy") {
    dummy();
  }
};

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
          self.postMessage({ type: "list", payload: buffer.list });
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
  const url = `/data/load/${name}`;
  console.log(`Background fetching ${url}`);
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.arrayBuffer().then((buffer) => {
          let sweep = { name, ...sweepParser.parse(new Uint8Array(buffer)) };
          console.log(sweep);
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
  let sweep = {
    name: "dummy",
    na: 4,
    nr: 3,
    elevation: [4.0, 4.0, 4.0, 4.0, 4.0],
    azimuth: [0.0, 15.0, 30.0, 45.0, 60.0],
    values: [20, 25, 30, 10, 20, 15, 50, 60, 50, 80, 90, 100],
  };
  //sweep = {...sweep, geometry(sweep)}
  sweep = geometry(sweep);
  self.postMessage({ type: "load", payload: sweep });
}

function geometry(sweep) {
  let points = [];
  let origins = [];
  let indices = [];
  const e = deg2rad(4.0);
  const r = sweep.nr * 80.0;
  const rce = r * Math.cos(e);
  const rse = r * Math.sin(e);
  for (let k = 0, l = sweep.na; k < l; k++) {
    const a = deg2rad(sweep.azimuth[k]);
    const v = (k - 0.5) / l;
    const x = rce * Math.sin(a);
    const y = rce * Math.cos(a);
    points.push(x, y, rse);
    points.push(0.01 * x, 0.01 * y, 0.01 * rse);
    origins.push(0, v);
    origins.push(1, v);
  }
  let k = sweep.na;
  const a = deg2rad(sweep.azimuth[k]);
  const v = k / sweep.na;
  const x = rce * Math.sin(a);
  const y = rce * Math.cos(a);
  points.push(x, y, rse);
  points.push(0.1 * x, 0.1 * y, 0.1 * rse);
  origins.push(0, v);
  origins.push(1, v);
  for (let o = 2, l = 2 * sweep.na; o <= l; o += 2) {
    indices.push(o - 2, o - 1, o);
    indices.push(o - 1, o, o + 1);
  }
  sweep.points = points;
  sweep.indices = indices;
  sweep.origins = origins;
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
