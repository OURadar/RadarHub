//
//  overlay.loader.js
//  RadarHub
//
//  A separate web worker to load things
//
//  Created by Boonleng Cheong
//

const vec3 = require("gl-matrix").vec3;
const deg = require("./common").deg;

self.onmessage = ({ data: { type, payload } }) => {
  if (type == "poly") {
    const name = payload.name;
    const model = payload.model;
    const origin = payload.origin;
    const type = name.split(".").pop();
    if (type == "shp") {
      handleShapefile(name)
        .then((lines) => filterLines(lines, origin))
        .then((lines) => lines2points(lines))
        .then((points) => makeBuffer(name, points))
        .then((buffer) => self.postMessage({ buffer: buffer }));
    } else if (type == "json") {
      handleJSON(name)
        .then((lines) => lines2points(lines))
        .then((points) => makeBuffer(name, points))
        .then((buffer) => self.postMessage({ buffer: buffer }));
    } else if (name.includes("@")) {
      builtInGeometryDirect(name, model)
        .then((points) => makeBuffer(name, points))
        .then((buffer) => self.postMessage({ buffer: buffer }));
      //);
    } else if (name.includes("#")) {
      builtInGeometry(name, model)
        .then((lines) => lines2points(lines))
        .then((points) => makeBuffer(name, points))
        .then((buffer) => self.postMessage({ buffer: buffer }));
    } else {
      console.log(`Unable to handle ${name}`);
      self.postMessage({ buffer: null });
    }
  }
};

async function builtInGeometryDirect(name, model) {
  let x = [];
  if (name.includes("@rings")) {
    const radii = name.split("/").slice(1);
    const sides = 64;
    const h = 0.012;
    // Apply the model matrix to make it radar-centric
    // console.log(name);
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
        const a = (k * 360.0) / sides;
        line.push(deg.polar2coord(0, a, r, model));
      }
      lines.push(line);
    });
    console.log(lines);
  }
  return lines;
}

async function handleJSON(name) {
  return fetch(name)
    .then((text) => text.json())
    .then((data) => {
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
    });
}

async function handleShapefile(name) {
  return require("shapefile")
    .open(name)
    .then((source) => {
      let lines = [];
      return source.read().then(function retrieve(result) {
        if (result.done) {
          return lines;
        }
        const shape = result.value;
        if (shape.geometry.type.includes("MultiPolygon")) {
          shape.geometry.coordinates.forEach((multipolygon) => {
            multipolygon.forEach((polygon) => {
              lines.push(polygon);
            });
          });
        } else if (
          shape.geometry.type.includes("Polygon") ||
          shape.geometry.type.includes("MultiLineString")
        ) {
          shape.geometry.coordinates.forEach((polygon) => {
            lines.push(polygon);
          });
        } else if (shape.geometry.type.includes("LineString")) {
          lines.push(shape.geometry.coordinates);
        }
        return source.read().then(retrieve);
      });
    });
}

function filterLines(inputLines, origin) {
  let outputLines = [];
  const theta = Math.cos((3.0 / 180) * Math.PI);
  const o = deg.coord2point(origin.longitude, origin.latitude, 1.0);
  inputLines.forEach((line) => {
    const p = deg.coord2point(...line[0], 1.0);
    const q = deg.coord2point(...line[line.length - 1], 1.0);
    const dotP = o[0] * p[0] + o[1] * p[1] + o[2] * p[2];
    const dotQ = o[0] * q[0] + o[1] * q[1] + o[2] * q[2];
    if (dotP < theta && dotQ < theta) return;
    outputLines.push(line);
  });
  return outputLines;
}

function lines2points(lines) {
  // Go through each line, repeat intermediate points
  let x = [];
  lines.forEach((line) => {
    x.push(deg.coord2point(...line[0]));
    for (let k = 1; k < line.length - 1; k++) {
      const p = deg.coord2point(...line[k]);
      x.push(p);
      x.push(p);
    }
    x.push(deg.coord2point(...line[line.length - 1]));
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
    "color: darkorange"
  );
  return buffer;
}
