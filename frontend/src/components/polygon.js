//
//  polygon.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { vec3 } from "gl-matrix";
import { polar2coord, coord2point, dotAngle } from "./common";

class Polygon {
  constructor() {
    this.points = [];
    this.count = 0;
    // Binding methods
    this.update = this.update.bind(this);
  }

  async update(name, geometry) {
    if (this.busy > 5) {
      console.log("Calling update() too frequently.");
      return;
    }
    if (name === undefined) {
      console.log("Input for update() undefined.");
      return;
    }
    const ext = name.split(".").pop();
    if (name.includes("@")) {
      this.busy--;
      return builtInGeometry(name, geometry.model)
        .then((lines) => lines2points(lines))
        .then((points) => makeBuffer(name, points))
        .catch((error) => console.error(error.stack));
    } else if (ext == "json") {
      this.busy--;
      return fetch(name)
        .then((text) => text.json())
        .then((dict) => handleJSON(dict))
        .then((lines) => lines2points(lines))
        .then((points) => makeBuffer(name, points))
        .catch((error) => console.error(error.stack));
    } else if (ext == "shp") {
      this.busy--;
      return require("shapefile")
        .open(name)
        .then((source) => handleShapefile(source))
        .then((lines) => filterLines(lines, geometry.origin))
        .then((lines) => lines2points(lines))
        .then((points) => makeBuffer(name, points))
        .catch((error) => console.error(error.stack));
    } else {
      console.log(`%cUnable to handle ${name}`, "color: red");
      this.busy--;
    }
  }
}

async function builtInGeometryDirect(name, model) {
  let x = [];
  if (name.includes("@rings")) {
    const radii = name.split("/").slice(1);
    const sides = 64;
    const h = 0.012;
    // Apply the model matrix to make it radar-centric
    radii.forEach((radius) => {
      const r = parseFloat(radius);
      x.push([0, r, h]);
      for (let k = 1; k < sides; k++) {
        const a = (k * 2.0 * Math.PI) / sides;
        const p = [r * Math.sin(a), r * Math.cos(a), h];
        x.push(p);
        x.push(p);
      }
      x.push([0, r, h]);
    });
    x = x.map((p) => vec3.transformMat4([], p, model));
  }
  return x.flat();
}

async function builtInGeometry(name, model) {
  let lines = [];
  if (name.includes("@rings")) {
    const sides = 6;
    const radii = name.split("/").slice(1);
    radii.forEach((radius) => {
      let line = [];
      const r = parseFloat(radius);
      for (let k = 0; k < sides + 1; k++) {
        const a = (k * 2.0 * Math.PI) / sides;
        line.push(polar2coord(0, a, r, model));
      }
      lines.push(line);
    });
    console.log(lines);
  }
  return lines;
}

function handleJSON(data) {
  let lines = [];
  const w = data.transform.scale;
  const b = data.transform.translate;
  data.arcs.forEach((arc) => {
    // Ignore this line on the south pole
    let lat = w[1] * arc[0][1] + b[1];
    if (lat < -89) return;
    let line = [];
    let point = [0, 0];
    arc.forEach((p) => {
      point[0] += p[0];
      point[1] += p[1];
      let lon = w[0] * point[0] + b[0];
      let lat = w[1] * point[1] + b[1];
      line.push([lon, lat]);
    });
    lines.push(line);
  });
  return lines;
}

function handleShapefile(source) {
  let lines = [];

  const addpolygon = (polygon) => {
    lines.push(polygon);
  };

  let k = 0;
  return source.read().then(function retrieve(result) {
    if (result.done) {
      return lines;
    }
    const shape = result.value;
    // console.log(shape);
    if (shape.geometry.type.includes("MultiPolygon")) {
      shape.geometry.coordinates.forEach((multipolygon) => {
        multipolygon.forEach((polygon) => {
          addpolygon(polygon);
        });
      });
    } else if (
      shape.geometry.type.includes("Polygon") ||
      shape.geometry.type.includes("MultiLineString")
    ) {
      shape.geometry.coordinates.forEach((polygon) => {
        addpolygon(polygon);
      });
    } else if (shape.geometry.type.includes("LineString")) {
      addpolygon(shape.geometry.coordinates);
    }
    return source.read().then(retrieve);
  });
}

function filterLines(inputLines, origin) {
  const theta = 0.05;
  let outputLines = [];
  const ref = coord2point(origin.longitude, origin.latitude);
  inputLines.forEach((line) => {
    const p = coord2point(...line[0]);
    if (dotAngle(ref, p) > theta) return;
    const q = coord2point(...line[line.length - 1]);
    if (dotAngle(ref, q) > theta) return;
    outputLines.push(line);
  });
  return outputLines;
}

function lines2points(lines) {
  let segments = [];
  lines.forEach((line) => {
    let segment = [];
    line.forEach((coord) => {
      const point = coord2point(...coord);
      segment.push(point);
    });
    segments.push(segment);
  });
  // Go through each line, repeat intermediate points
  let x = [];
  segments.forEach((segment) => {
    x.push(segment[0]);
    for (let k = 1; k < segment.length - 1; k++) {
      x.push(segment[k]);
      x.push(segment[k]);
    }
    x.push(segment[segment.length - 1]);
  });
  return x.flat();
}

function makeBuffer(name, x) {
  name = name.includes("@") ? name : name.split("/").pop();
  const buffer = {
    name: name,
    data: x,
    count: x.length / 6,
  };
  const bytes = x.length * Float32Array.BYTES_PER_ELEMENT;
  const cString = buffer.count.toLocaleString();
  const xString = x.length.toLocaleString();
  const mString = bytes.toLocaleString();
  console.log(
    `Polygon: %c${name} %c${cString} lines %c(${xString} floats = ${mString} bytes)`,
    "font-weight: bold",
    "font-weight: normal",
    "color: blue"
  );
  return buffer;
}

export { Polygon };
