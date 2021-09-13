class Rings {
  constructor(regl, radii = [250], sides = 16) {
    this.regl = regl;

    let buffer = [];
    const h = 0.012;
    radii.forEach((radius) => {
      let points = [];
      for (let k = 0; k < 2 * Math.PI; k += (2 * Math.PI) / sides) {
        points.push([radius * Math.sin(k), radius * Math.cos(k), h]);
      }
      points.push([0, radius, h]);
      // Duplicate everything except the start and end
      buffer.push(points[0]);
      for (let k = 1; k < points.length - 1; k++) {
        buffer.push(points[k]);
        buffer.push(points[k]);
      }
      buffer.push(points[points.length - 1]);
    });

    buffer = buffer.flat();
    this.points = this.regl.buffer({
      usage: "static",
      type: "float",
      data: buffer,
    });
    this.count = buffer.length / 6;
  }
}

export { Rings };
