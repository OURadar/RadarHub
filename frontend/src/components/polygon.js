class Polygon {
  constructor(regl, file) {
    this.regl = regl;
    this.file = file;
    this.raw = [];
    this.points = [];
    this.busy = false;
    this.ready = false;
    this.opacity = 0.0;
    this.targetOpacity = 1.0;
    this.radius = 6357;

    this.addpolygon = this.addpolygon.bind(this);
  }

  read() {
    const handleShape = (shape) => {
      // console.log(shape);
      // console.log(shape.geometry.type);
      if (shape.geometry.type.includes("MultiPolygon")) {
        shape.geometry.coordinates.forEach((multipolygon) => {
          multipolygon.forEach((polygon) => {
            this.addpolygon(polygon);
          });
        });
      } else if (shape.geometry.type.includes("Polygon")) {
        shape.geometry.coordinates.forEach((polygon) => {
          this.addpolygon(polygon);
        });
      }
    };

    const handleShapefile = () => {
      let x = [];
      this.raw.forEach((segment) => {
        // Duplicate everything except the first and last points
        x.push(segment[0]);
        for (let k = 1; k < segment.length - 1; k++) {
          x.push(segment[k]);
          x.push(segment[k]);
        }
        x.push(segment[segment.length - 1]);
      });
      x = x.flat();
      this.points = this.regl.buffer({
        usage: "static",
        type: "float",
        data: x,
      });
      this.count = x.length / 6;
      console.log(
        "overlay " + x.length + " floats -> " + this.count + " lines"
      );
      this.ready = true;
      this.busy = false;
    };

    const handleJSON = (data) => {
      const [wx, wy] = data.transform.scale;
      const [bx, by] = data.transform.translate;
      let arcs = [];
      data.arcs.forEach((line) => {
        let lat = wy * line[0][1] + by;
        if (lat < -89) return;
        let arc = [];
        let point = [0, 0];
        line.forEach((p) => {
          point[0] += p[0];
          point[1] += p[1];
          let lon = wx * point[0] + bx;
          let lat = wy * point[1] + by;
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
      x = x.flat();
      this.points = this.regl.buffer({
        usage: "static",
        type: "float",
        data: x,
      });
      this.count = x.length / 6;
      console.log(
        "overlay " + x.length + " floats -> " + this.count + " lines"
      );
      this.ready = true;
      this.busy = false;
    };

    const ext = this.file.split(".").pop();

    if (ext == "json") {
      // fetch("/static/blob/counties-10m.json")
      // fetch("/static/blob/countries-110m.json")
      fetch(this.file)
        .then((response) => response.json())
        .then((data) => {
          handleJSON(data);
        })
        .catch((error) => console.error(error.stack));
    } else if (ext == "shp") {
      let shapefile = require("shapefile");
      shapefile
        .open(this.file)
        .then((source) =>
          source.read().then(function retrieve(result) {
            if (result.done) {
              handleShapefile();
              return;
            }
            handleShape(result.value);
            return source.read().then(retrieve);
          })
        )
        .catch((error) => console.error(error.stack));
    }
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

  addpolygon(polygon) {
    let p = [];
    polygon.forEach((c) => {
      var lon = (c[0] / 180.0) * Math.PI;
      var lat = (c[1] / 180.0) * Math.PI;
      var x = this.radius * Math.cos(lat) * Math.sin(lon);
      var y = this.radius * Math.sin(lat);
      var z = this.radius * Math.cos(lat) * Math.cos(lon);
      p.push([x, y, z]);
    });
    this.raw.push(p);
  }
}

export { Polygon };
