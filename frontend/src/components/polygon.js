class Polygon {
  constructor(regl, line, color, file) {
    this.regl = regl;
    this.file = file;
    this.line = line;
    this.color = color == [] ? [0.5, 0.5, 0.5] : color;
    this.points = [];
    this.count = 0;
    this.busy = false;
    this.ready = false;
    this.opacity = 0.0;
    this.targetOpacity = 1.0;
    this.radius = 6357;
    // Binding methods
    this.read = this.read.bind(this);
    this.update = this.update.bind(this);
    this.makeBuffer = this.makeBuffer.bind(this);
    this.handleJSON = this.handleJSON.bind(this);
    this.handleShapefile = this.handleShapefile.bind(this);
  }

  read() {
    this.busy = true;
    const ext = this.file.split(".").pop();
    if (ext == "json") {
      fetch(this.file)
        .then((text) => text.json())
        .then((dict) => this.handleJSON(dict))
        .then((points) => this.makeBuffer(points))
        .catch((error) => console.error(error.stack));
    } else if (ext == "shp") {
      require("shapefile")
        .open(this.file)
        .then((source) => this.handleShapefile(source))
        .then((points) => this.makeBuffer(points))
        .catch((error) => console.error(error.stack));
    }
  }

  makeBuffer(x) {
    this.busy = false;
    this.ready = true;
    this.points = this.regl.buffer({
      usage: "static",
      type: "float",
      data: x,
    });
    this.count = x.length / 6;
    console.log(
      "Polygon: " +
        this.file.split("/").pop() +
        " " +
        this.count.toLocaleString() +
        " lines (" +
        x.length.toLocaleString() +
        " floats = " +
        (x.length * 4).toLocaleString() +
        " bytes)"
    );
  }

  async update() {
    if (this.busy) {
      return;
    }
    if (window.requestIdleCallback) {
      console.log("low priotity ...");
      window.requestIdleCallback(
        () => {
          this.read();
        },
        { timeout: 500 }
      );
    } else {
      this.read();
    }
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
        let lon = (coord[0] / 180.0) * Math.PI;
        let lat = (coord[1] / 180.0) * Math.PI;
        var x = this.radius * Math.cos(lat) * Math.sin(lon);
        var y = this.radius * Math.sin(lat);
        var z = this.radius * Math.cos(lat) * Math.cos(lon);
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
