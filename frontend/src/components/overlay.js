class Overlay {
  constructor(regl) {
    this.regl = regl;
    this.raw = [];
    this.points = [];
    this.busy = false;
    this.ready = false;
    this.opacity = 0.0;
    this.targetOpacity = 1.0;

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

    const handleDone = () => {
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
        "overlay " + this.points.length + " floats -> " + this.count + " lines"
      );
      this.ready = true;
      this.busy = false;
    };

    let shapefile = require("shapefile");
    shapefile
      .open("/static/blob/shapefiles/World/ne_50m_admin_0_countries.shp")
      .then((source) =>
        source.read().then(function retrieve(result) {
          if (result.done) {
            handleDone();
            return;
          }
          handleShape(result.value);
          return source.read().then(retrieve);
        })
      )
      .catch((error) => console.error(error.stack));
  }

  async update() {
    if (this.busy) {
      return;
    }
    if (window.requestIdleCallback) {
      console.log("low priotity ...");
      window.requestIdleCallback(this.read(), { timeout: 500 });
    } else {
      this.read();
    }
  }

  addpolygon(polygon) {
    let p = [];
    polygon.forEach((c) => {
      var lon = (c[0] / 180.0) * Math.PI;
      var lat = (c[1] / 180.0) * Math.PI;
      var x = 6357 * Math.cos(lat) * Math.sin(lon);
      var y = 6357 * Math.sin(lat);
      var z = 6357 * Math.cos(lat) * Math.cos(lon);
      p.push([x, y, z]);
    });
    this.raw.push(p);
  }
}

export { Overlay };
