//
//  common.js
//  RadarHub
//
//  Created by Boonleng Cheong
//
//  A collection of common functions
//

import { vec3 } from "gl-matrix";

// A globally-average value is usually considered to be 6,371 kilometres
// https://en.wikipedia.org/wiki/Earth_radius
export const earthRadius = 6371.0;

/**
 * Clamp a value to between lo and hi boundaries
 *
 * @param {*} x the input
 * @param {*} lo the lower bound
 * @param {*} hi the upper bound
 * @returns the clamped value
 */
export function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

/**
 * Convert an angle from degrees to radians
 *
 * @param {x} x the input angle in degrees
 * @returns angle in radians
 */
export function deg2rad(x) {
  return x * (Math.PI / 180.0);
}

/**
 * Convert an angle from radians to degrees
 *
 * @param {x} x the input angle in radians
 * @returns angle in degrees
 */
export function rad2deg(x) {
  return x * (180.0 / Math.PI);
}

export function ticksInRange(count, min, max, choices) {
  const ticks = [];
  // Attempt to fit (count) ticks in range
  const range = (max - min) / count;
  let score = 1;
  let delta = choices[0];
  choices.forEach((x) => {
    let tmp = Math.abs(range - x) / x;
    if (score >= tmp) {
      score = tmp;
      delta = x;
    }
  });
  for (let k = Math.floor(min / delta); k < Math.ceil(max / delta); k++) {
    ticks.push(k * delta);
  }
  return ticks;
}

export function tickChoices(i, count) {
  var a = [];
  for (let k = 0; k < count; k++) {
    let e = i * 10 ** k;
    a.push([e, 2 * e, 2.5 * e, 5 * e]);
  }
  return a.flat();
}

export function prettyString(input) {
  return input
    .replace(/degC/g, "°C")
    .replace(/degF/g, "°F")
    .replace(/(?:[\s])deg/g, "°");
}

//
// Copied from
// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
//
export function detectMob() {
  const toMatch = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ];

  return toMatch.some((toMatchItem) => {
    return navigator.userAgent.match(toMatchItem);
  });
}

/**
 * Transform the (lon, lat) coordinate to (x, y, z)
 *
 * @param {float} lon the longitude in radians
 * @param {float} lat the latitude in radians
 * @returns {Array3} [x, y, z] in km
 */
function _coord2point(lon, lat, r = earthRadius) {
  const clat = Math.cos(lat);
  const slat = Math.sin(lat);
  const clon = Math.cos(lon);
  const slon = Math.sin(lon);
  return [r * clat * slon, r * slat, r * clat * clon];
}

/**
 * Transform the (lon, lat) coordinate to (x, y, z)
 *
 * @param {float} lon the longitude in degrees
 * @param {float} lat the latitude in degrees
 * @returns {Array3} [x, y, z] in km
 */
function coord2point(lon, lat, r = earthRadius) {
  return _coord2point(deg2rad(lon), deg2rad(lat), r);
}

/**
 * Transform a radar coordinate (e, a, r) to [x, y, z, w]
 *
 * @param {float} e the elevation angle in radians
 * @param {float} a the azimuth angle in radians
 * @param {float} r the range in km
 * @param {ReadonlyMat4} model matrix to transform with
 * @returns {vec4} out in km
 */
function _polar2point(e, a, r, model) {
  const ce = Math.cos(e);
  const se = Math.sin(e);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const rce = r * ce;
  const p = [rce * sa, rce * ca, r * se, 1.0];
  const q = vec3.transformMat4([], p, model);
  return q;
}

/**
 * Transform a radar coordinate (e, a, r) to [x, y, z, w]
 *
 * @param {float} e the elevation angle in degrees
 * @param {float} a the azimuth angle in degrees
 * @param {float} r the range in km
 * @param {ReadonlyMat4} model matrix to transform with
 * @returns {vec4} out in km
 */
function polar2point(e, a, r, model) {
  return _polar2point(deg2rad(e), deg2rad(a), r, model);
}

/**
 * Transform a radar coordinate (e, a, r) to [lon, lat]
 *
 * @param {float} e the elevation angle in radians
 * @param {float} a the azimuth angle in radians
 * @param {float} r the range in km
 * @param {ReadonlyMat4} model matrix to transform with
 * @returns {Array2} out [lon, lat] in radians
 */
function _polar2coord(e, a, r, model) {
  const point = _polar2point(e, a, r, model);
  return _point2coord(...point);
}

/**
 * Transform a radar coordinate (e, a, r) to [lon, lat]
 *
 * @param {float} e the elevation angle in degrees
 * @param {float} a the azimuth angle in degrees
 * @param {float} r the range in km
 * @param {ReadonlyMat4} model matrix to transform with
 * @returns {Array2} out [lon, lat] in degrees
 */
function polar2coord(e, a, r, model) {
  const point = polar2point(e, a, r, model);
  return point2coord(...point);
}

/**
 * Transform a point (x, y, z) to [lon, lat]
 *
 * @param {float} x the x-component in km
 * @param {float} y the y-component in km
 * @param {float} z the z-component in km
 * @returns {Array2} out [lon, lat] in degrees
 */
function _point2coord(x, y, z) {
  const lat = Math.atan2(y, Math.sqrt(x ** 2 + z ** 2));
  const lon = Math.atan2(x, z);
  return [lon, lat];
}

/**
 * Transform a point (x, y, z) to [lon, lat]
 *
 * @param {float} x the x-component in km
 * @param {float} y the y-component in km
 * @param {float} z the z-component in km
 * @returns {Array2} out [lon, lat] in degrees
 */
function point2coord(x, y, z) {
  const [lon, lat] = _point2coord(x, y, z);
  return [rad2deg(lon), rad2deg(lat)];
}

/**
 * Returns the angle between two vectors
 *
 * @param {*} a input vector 1
 * @param {*} b input vector 2
 * @returns angle between vector a and b in radians
 */
function _dotAngle(a, b) {
  const m = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const n = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(dot / (m * n));
}

/**
 * Returns the angle between two vectors
 *
 * @param {*} a input vector 1
 * @param {*} b input vector 2
 * @returns angle between vector a and b in degrees
 */
function dotAngle(a, b) {
  return rad2deg(_dotAngle(a, b));
}

/**
 * Functions collected in a two dictionaries:
 * deg.[func] are functions that operate in degrees
 * rad.[func] are functions that operate in radians
 */

export const deg = {
  coord2point: coord2point,
  polar2point: polar2point,
  polar2coord: polar2coord,
  point2coord: point2coord,
  dotAngle: dotAngle,
};

export const rad = {
  coord2point: _coord2point,
  polar2point: _polar2point,
  polar2coord: _polar2coord,
  point2coord: _point2coord,
  dotAngle: _dotAngle,
};

/**
 * Normalized dot product between two vectors
 *
 * @param {ReadonlyVec3} a input vector 1
 * @param {ReadonlyVec3} b input vector 2
 * @returns out
 */
export function ndot(a, b) {
  const m = Math.hypot(a[0], a[1], a[2]);
  const n = Math.hypot(b[0], b[1], b[2]);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return dot / (m * n);
}

/**
 * Show the u, v, w components of a 4 x 4 matrix
 *
 * @param {ReadonlyMat4} m input matrix
 * @param {*} dec number of decimals to show (opt, default = 3)
 * @param {*} len length of string to show (opt, default = 9)
 * @param {bool} all values (opt, default = true)
 */
export const mat4String = function (m, dec = 3, len = 9, all = true) {
  let u0 = m[0].toFixed(dec).padStart(len, " ");
  let u1 = m[1].toFixed(dec).padStart(len, " ");
  let u2 = m[2].toFixed(dec).padStart(len, " ");
  let u3 = m[3].toFixed(dec).padStart(len, " ");

  let v0 = m[4].toFixed(dec).padStart(len, " ");
  let v1 = m[5].toFixed(dec).padStart(len, " ");
  let v2 = m[6].toFixed(dec).padStart(len, " ");
  let v3 = m[7].toFixed(dec).padStart(len, " ");

  let w0 = m[8].toFixed(dec).padStart(len, " ");
  let w1 = m[9].toFixed(dec).padStart(len, " ");
  let w2 = m[10].toFixed(dec).padStart(len, " ");
  let w3 = m[11].toFixed(dec).padStart(len, " ");

  let t0 = m[12].toFixed(dec).padStart(len, " ");
  let t1 = m[13].toFixed(dec).padStart(len, " ");
  let t2 = m[14].toFixed(dec).padStart(len, " ");
  let t3 = m[15].toFixed(dec).padStart(len, " ");

  if (all)
    return (
      `${u0} ${u1} ${u2} ${u3}\n` +
      `    ${v0} ${v1} ${v2} ${v3}\n` +
      `    ${w0} ${w1} ${w2} ${w3}\n` +
      `    ${t0} ${t1} ${t2} ${t3}`
    );
  else
    return `${u0} ${u1} ${u2} ${u3}   ${v0} ${v1} ${v2} ${v3}   ${w0} ${w1} ${w2} ${w3}   ${t0} ${t1} ${t2} ${t3}`;
};

/**
 * Show the components of a 3 x 1 vector
 *
 * @param {ReadonlyVec3} v input vector
 * @param {*} dec number of decimals to show (opt, default = 3)
 * @param {*} len length of string to show (opt, default = 9)
 */
export const vec3String = function (v, dec = 3, len = 9) {
  let v0 = v[0].toFixed(dec).padStart(len, " ");
  let v1 = v[1].toFixed(dec).padStart(len, " ");
  let v2 = v[2].toFixed(dec).padStart(len, " ");
  return `${v0} ${v1} ${v2}`;
};

/**
 * Show the components of a 4 x 1 vector
 *
 * @param {ReadonlyVec4} v input vector
 * @param {*} dec number of decimals to show (opt, default = 3)
 * @param {*} len length of string to show (opt, default = 9)
 */
export const vec4String = function (v, dec = 3, len = 9) {
  let v0 = v[0].toFixed(dec).padStart(len, " ");
  let v1 = v[1].toFixed(dec).padStart(len, " ");
  let v2 = v[2].toFixed(dec).padStart(len, " ");
  let v3 = v[3].toFixed(dec).padStart(len, " ");
  return `${v0} ${v1} ${v2} ${v3}`;
};

/**
 *
 * @param {string} text
 * @param {string} font
 * @returns width of text rendered using font
 */
export function displayTextWidth(text, font) {
  let canvas =
    displayTextWidth.canvas ||
    (displayTextWidth.canvas = document.createElement("canvas"));
  let context = canvas.getContext("2d");
  context.font = font;
  let metrics = context.measureText(text);
  return metrics.width;
}
