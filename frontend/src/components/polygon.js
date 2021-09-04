import { vec3 } from "gl-matrix";
import { deg2rad } from "./common";

//
// regl - the shared regl object attached to a canvas
// file - the file containing the points
// geometry - geometry dictionary of projection matrices
//
class Polygon {
  constructor(regl) {
    this.regl = regl;
    this.points = [];
    this.count = 0;
    this.busy = false;
    this.radius = 6357;
    // Binding methods
    this.update = this.update.bind(this);
    this.makeBuffer = this.makeBuffer.bind(this);
    this.handleJSON = this.handleJSON.bind(this);
    this.handleShapefile = this.handleShapefile.bind(this);
  }

  async update(file, geometry) {
    if (this.busy) return;
    this.busy = true;
    const ext = file.split(".").pop();
    if (ext == "json") {
      return fetch(file)
        .then((text) => text.json())
        .then((dict) => this.handleJSON(dict))
        .then((points) => {
          return this.makeBuffer(file, points);
        })
        .catch((error) => console.error(error.stack));
    } else if (ext == "shp") {
      return require("shapefile")
        .open(file)
        .then((source) => this.handleShapefile(source))
        .then((points) => {
          return this.makeBuffer(file, points);
        })
        .catch((error) => console.error(error.stack));
    } else if (file.includes("@")) {
      return this.builtInGeometry(file, geometry)
        .then((points) => {
          return this.makeBuffer(file, points);
        })
        .catch((error) => console.error(error.stack));
    }
  }

  async builtInGeometry(file, geometry) {
    let x = [];
    if (file.includes("@rings")) {
      const radii = file.split("/").slice(1);
      const sides = 12;
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
      x = x.map((p) => vec3.transformMat4([], p, geometry.model));
    }
    return x.flat();
  }

  makeBuffer(file, x) {
    const buffer = {
      points: this.regl.buffer({
        usage: "static",
        type: "float",
        data: x,
      }),
      count: x.length / 6,
    };
    const name = file.includes("@") ? file : file.split("/").pop();
    const cString = buffer.count.toLocaleString();
    const xString = x.length.toLocaleString();
    const mString = (
      x.length * Float32Array.BYTES_PER_ELEMENT
    ).toLocaleString();
    console.log(
      `Polygon: %c${name} %c${cString} lines %c(${xString} floats = ${mString} bytes)`,
      "font-weight: bold",
      "font-weight: normal",
      "color: blue"
    );
    this.busy = false;
    return buffer;
  }

  handleJSON(data) {
    const w = data.transform.scale;
    const b = data.transform.translate;
    let arcs = [];
    data.arcs.forEach((line) => {
      // Ignore this line on the south pole
      let lat = w[1] * line[0][1] + b[1];
      if (lat < -89) return;
      let arc = [];
      let point = [0, 0];
      line.forEach((p) => {
        point[0] += p[0];
        point[1] += p[1];
        let lon = w[0] * point[0] + b[0];
        let lat = w[1] * point[1] + b[1];
        arc.push([lon, lat]);
      });
      arcs.push(arc);
    });

    let ll = [];
    arcs.forEach((arc) => {
      let l = [];
      arc.forEach((coord) => {
        const lon = deg2rad(coord[0]);
        const lat = deg2rad(coord[1]);
        const x = this.radius * Math.cos(lat) * Math.sin(lon);
        const y = this.radius * Math.sin(lat);
        const z = this.radius * Math.cos(lat) * Math.cos(lon);
        l.push([x, y, z]);
      });
      ll.push(l);
    });
    // Go through each line loop
    let x = [];
    ll.forEach((arc) => {
      x.push(arc[0]);
      for (let k = 1; k < arc.length - 1; k++) {
        x.push(arc[k]);
        x.push(arc[k]);
      }
      x.push(arc[arc.length - 1]);
    });
    return x.flat();
  }

  handleShapefile(source) {
    let raw = [];

    const digest = () => {
      let x = [];
      raw.forEach((segment) => {
        // Duplicate everything except the first and last points
        x.push(segment[0]);
        for (let k = 1; k < segment.length - 1; k++) {
          x.push(segment[k]);
          x.push(segment[k]);
        }
        x.push(segment[segment.length - 1]);
      });
      return x.flat();
    };

    const addpolygon = (polygon) => {
      let p = [];
      polygon.forEach((c) => {
        var lon = (c[0] / 180.0) * Math.PI;
        var lat = (c[1] / 180.0) * Math.PI;
        var x = this.radius * Math.cos(lat) * Math.sin(lon);
        var y = this.radius * Math.sin(lat);
        var z = this.radius * Math.cos(lat) * Math.cos(lon);
        p.push([x, y, z]);
      });
      raw.push(p);
    };

    return source.read().then(function retrieve(result) {
      if (result.done) {
        return digest();
      }
      const shape = result.value;
      // console.log(shape);
      // console.log(shape.geometry.type);
      if (shape.geometry.type.includes("MultiPolygon")) {
        shape.geometry.coordinates.forEach((multipolygon) => {
          multipolygon.forEach((polygon) => {
            addpolygon(polygon);
          });
        });
      } else if (shape.geometry.type.includes("Polygon")) {
        shape.geometry.coordinates.forEach((polygon) => {
          addpolygon(polygon);
        });
      }
      return source.read().then(retrieve);
    });
  }
}

export { Polygon };
