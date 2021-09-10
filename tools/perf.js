const { mat4, vec3 } = require("gl-matrix");

function deg2rad(x) {
  return (x * Math.PI) / 180.0;
}

function rad2deg(x) {
  return (x * 180.0) / Math.PI;
}

function coord2point(lon, lat) {
  const r = 6358.0;
  const rlon = deg2rad(lon);
  const rlat = deg2rad(lat);
  const clat = Math.cos(rlat);
  const slat = Math.sin(rlat);
  const clon = Math.cos(rlon);
  const slon = Math.sin(rlon);
  return [r * clat * slon, r * slat, r * clat * clon];
}

function polar2point(e, a, r, model) {
  const re = deg2rad(e);
  const ra = deg2rad(a);
  const ce = Math.cos(re);
  const se = Math.sin(re);
  const ca = Math.cos(ra);
  const sa = Math.sin(ra);
  const p = [r * ce * sa, r * ce * ca, r * se];
  const q = vec3.transformMat4([], p, model);
  return q;
}

function polar2coord(e, a, r, model) {
  const p = polar2point(e, a, r, model);
  return point2coord(p[0], p[1], p[2]);
}

function point2coord(x, y, z) {
  const lat = Math.atan2(y, Math.sqrt(x ** 2 + z ** 2));
  const lon = Math.atan2(x, z);
  return [rad2deg(lon), rad2deg(lat)];
}

function doOverlap(rect1, rect2) {
  if (
    rect1[2] <= rect2[0] ||
    rect1[0] >= rect2[2] ||
    rect1[3] <= rect2[1] ||
    rect1[1] >= rect2[3]
  )
    return false;
  return true;
}

function transformMat4(out, a, m) {
  let x = a[0],
    y = a[1],
    z = a[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

function handleShapefile(source, fields) {
  let raw = [];
  let stringKey = "";
  let weightKey = "";

  const digest = () => {
    raw.sort((a, b) => {
      if (a.weight < b.weight) return +1;
      if (a.weight > b.weight) return -1;
      return 0;
    });
    // console.log(`raw has ${raw.length.toLocaleString()} elements`);
    raw = raw.slice(-2000);
    return raw;
  };

  const handleLabel = (label) => {
    if (stringKey == "") {
      const keys = Object.keys(label.properties);
      stringKey = keys[fields[0]];
      weightKey = keys[fields[1]];
      console.log(`${stringKey}, ${weightKey}`);
    }
    const lon = label.geometry.coordinates[0][0];
    const lat = label.geometry.coordinates[0][1];
    raw.push({
      text: label.properties[stringKey],
      weight: label.properties[weightKey],
      coord: [deg2rad(lon), deg2rad(lat)],
      point: coord2point(lon, lat),
      color: "$ffffff",
      stroke: "#000000",
    });
  };
  return source.read().then(function retrieve(result) {
    if (result.done) {
      return digest();
    }
    handleLabel(result.value);
    return source.read().then(retrieve);
  });
}

function makeBuffer(file, labels) {
  const name = file.includes("@") ? file : file.split("/").pop();
  const p = Math.ceil(1.5 * 3 * 1.5);
  const q = Math.ceil(3 * 1.5);
  let f = 0;
  let u = 0.5;
  let v = 0.5;
  let coords = [];
  let points = [];
  let origins = [];
  let spreads = [];
  const canvas = { width: 4096, height: 4096 };
  labels.forEach((label) => {
    const w = label.text.length * 8;
    const h = 20;
    const ww = w + 2 * p;
    const hh = h + 2 * q;
    f = Math.max(f, h);
    if (u + ww > canvas.width) {
      v += Math.ceil(f + 2 * q + 1);
      u = 0.5;
      f = 0;
    }
    coords.push(label.coord);
    points.push(label.point);
    origins.push([u - 0.5, v - 0.5]);
    spreads.push([ww + 1, hh + 1]);
    u += ww + 1;
  });
  console.log(v, canvas.height);
  const buffer = {
    name: name,
    bound: [canvas.width, canvas.height],
    raw: {
      coords: coords,
      points: points,
      origins: origins,
      spreads: spreads,
    },
    count: labels.length
  };
  return buffer;
}

function reviseOpacity(buffer, geometry) {
  let rectangles = [];
  let visibility = [];
  let s = 2.0 / 1.5;
  for (let k = 0; k < buffer.count; k++) {
    const point = buffer.raw.points[k];
    const spread = buffer.raw.spreads[k];
    const t = transformMat4([], point, geometry.viewprojection);
    const x = t[0] / t[3];
    const y = t[1] / t[3];
    const z = t[2] / t[3];
    if (z > 0.98 || x > 0.95 || x < -0.95 || y > 0.95 || y < -0.95) {
      visibility.push(0);
      rectangles.push([]);
    } else {
      visibility.push(1);
      const p = [
        x * geometry.viewport.width,
        y * geometry.viewport.height,
      ];
      const r = [p[0], p[1], p[0] + spread[0] * s, p[1] + spread[1] * s];
      rectangles.push(r);
    }
  }

  rectangles.forEach((d, k) => {
    if (k == 0 || visibility[k] == 0) return;
    let v = 1;
    for (let j = 0; j < k; j++) {
      if (visibility[j] && doOverlap(d, rectangles[j])) {
        v = 0;
        break;
      }
    }
    visibility[k] = v;
  })
  return visibility;
}

function reviseOpacity2(buffer, geometry, verbose = 1) {
  let indices = [];
  let rectangles = [];
  let visibility = new Array(buffer.count).fill(0);
  let s = 2.0 / 1.5;
  for (let k = 0; k < buffer.count; k++) {
    const d = geometry.satCoord[0] - buffer.raw.coords[k][0]
    if (d > 1.5 || d < -1.5) continue;

    const point = buffer.raw.points[k];
    const t = transformMat4([], point, geometry.viewprojection);
    const x = t[0] / t[3];
    const y = t[1] / t[3];
    const z = t[2] / t[3];
    if (z > 0.98 || x > 0.95 || x < -0.95 || y > 0.95 || y < -0.95)
      continue;

    const p = [
      x * geometry.viewport.width,
      y * geometry.viewport.height,
    ];
    const spread = buffer.raw.spreads[k];
    const r = [p[0], p[1], p[0] + spread[0] * s, p[1] + spread[1] * s];
    rectangles.push(r);
    indices.push(k);
    visibility[k] = 1;
  }

  if (verbose) {
    console.log(indices);
    console.log(indices.length, rectangles.length, visibility.reduce((a, x) => a + x));
  }

  // indices.forEach((i) => {
  //   console.log(`i = ${i}  visibility = ${visibility[i]}`)
  // });

  // // let survived = [indices[0]];
  // indices.forEach((i, k) => {
  //   if (k == 0 || visibility[i] == 0) return;
  //   const rect1 = rectangles[k];
  //   for (let j = 0; j < k; j++) {
  //     if (doOverlap(rect1, rectangles[j])) {
  //       visibility[i] = 0;
  //       return;
  //     }
  //   }
  //   // survived.push(i);
  // })
  // // console.log(survived);

  let survived = [indices[0]];
  for (let k = 1; k < indices.length; k++) {
    const i = indices[k];
    if (visibility[i] == 0) continue;
    const rect = rectangles[k];
    for (let j = 0; j < k; j++) {
      const t = indices[j];
      if (visibility[t] && doOverlap(rect, rectangles[j])) {
        visibility[i] = 0;
        break;
      }
    }
    survived.push(i);
  }
  if (verbose)
    console.log(survived);

  return visibility;
}

function getGeometry(buffer) {
  const radius = 6357;
  const a = [Math.random() * 360 - 180, 40 + Math.random() * 150 - 75];
  const c = [deg2rad(a[0]), deg2rad(a[1]), 2 * radius];
  const x = c[2] * Math.cos(c[1]) * Math.sin(c[0]);
  const y = c[2] * Math.sin(c[1]);
  const z = c[2] * Math.cos(c[1]) * Math.cos(c[0]);
  const w = buffer.bound.width;
  const h = buffer.bound.height;
  const fov = 0.25;
  const satPosition = [x, y, z];
  const view = mat4.lookAt([], satPosition, [0, 0, 0], [0, 1, 0]);
  const projection = mat4.perspective([], fov, w / h, 100, 30000.0);
  return {
    fov: fov,
    satCoord: a,
    satPosition: satPosition,
    view: view,
    projection: projection,
    viewport: {x:0, y:0, width: 1600, height: 900},
    viewprojection: mat4.multiply([], projection, view),
  }  
}

function single(buffer) {
  const geometry = getGeometry(buffer);
  const visibility = reviseOpacity2(buffer, geometry);

  console.log(geometry.satCoord, visibility.reduce((a, x) => a + x));
  console.log(`satPosition = ${geometry.satPosition}`);
  let satCoordinate = point2coord(...geometry.satPosition);
  console.log(`satCoordinate = ${satCoordinate}`);
}

function eval(buffer) {
  // console.log(buffer);
  const count = 50000;
  
  const geometry = getGeometry(buffer);
  const visibility = reviseOpacity(buffer, geometry);
  console.log(geometry.satCoord, visibility.reduce((a, x) => a + x));


  let t2, t1, t0;

  t2 = new Date().getTime();
  const geoms = [];
  for (let k = 0; k < count; k++) {
    const geometry = getGeometry(buffer);
    geoms.push(geometry);
  }
  t1 = new Date().getTime();
  console.log(`getGeometry: ${(t1 - t2) / count}`);

  //  

  t1 = new Date().getTime();
  for (let k = 0; k < count; k++) {
    const geometry = geoms[k];
    const visibility = reviseOpacity2(buffer, geometry);
  }
  t0 = new Date().getTime();
  console.log(`reviseOpacity: ${(t0 - t1) / count}`);


  t1 = new Date().getTime();
  for (let k = 0; k < count; k++) {
    const geometry = geoms[k];
    const visibility = reviseOpacity(buffer, geometry);
  }
  t0 = new Date().getTime();
  console.log(`reviseOpacity2: ${(t0 - t1) / count}`);
}

const file = "../static/blob/shapefiles/World/cities.shp";
const buffer = require("shapefile")
  .open(file)
  .then((source) => handleShapefile(source, [0, 6]))
  .then((labels) => makeBuffer(file, labels))
  .then((buffer) => single(buffer));

// console.log(buffer);
