//
//  overlay-worker.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

let text;

onmessage = (e) => {
  if (e.data.type == "init") {
    console.log(e.data);
    text = e.data.text;
    self.postMessage({
      reply: "init",
    });
  } else if (e.data.type == "update") {
    if (text === undefined) return;
    const opacity = reviseOpacity(e.data.geometry);
    self.postMessage({
      type: "opacity",
      opacity: opacity,
    });
  }
};

// Viewpoint is always 2R from the center of the sphere
// Maximum visible longitude = acos(R / 2R) = 1.047
function reviseOpacity(geometry) {
  let pass1 = 0;
  let pass2 = 0;
  let pass3 = 0;
  let pass4 = 0;
  let indices = [];
  let rectangles = [];
  let visibility = new Array(text.points.length).fill(0);
  const ar = geometry.viewport.width / geometry.viewport.height;
  const theta = 0.5 * geometry.fov;
  const satCoord = geometry.satCoordinate;
  const limitX = Math.min(1.047, 1.6 * theta);
  const limitY = Math.min(1.047, (1.6 * theta) / ar);

  const t2 = new Date().getTime();

  const points = text.points;
  const extents = text.extents;
  const viewportWidth = geometry.viewport.width;
  const viewportHeight = geometry.viewport.height;
  const maxWeight = 4.5 + 0.5 / geometry.fov;
  for (let k = 0, l = text.points.length; k < l; k++) {
    const coord = text.coords[k];
    const deltaX = satCoord[0] - coord[0];
    if (deltaX < -limitX || deltaX > limitX) {
      pass1++;
      continue;
    }
    const deltaY = satCoord[1] - coord[1];
    if (deltaY < -limitY || deltaY > limitY) {
      pass2++;
      continue;
    }
    if (text.weights[k] > maxWeight) {
      pass3++;
      continue;
    }

    visibility[k] = 1;
    const [w, h] = extents[k];
    const t = transformMat4([], points[k], geometry.viewprojection);
    const x = (t[0] / t[3]) * viewportWidth;
    const y = (t[1] / t[3]) * viewportHeight;
    const rect = [x - w, y - h, x + w, y + h];
    rectangles.push(rect);
    indices.push(k);
  }

  const t1 = new Date().getTime();

  indices.forEach((i, k) => {
    const rect = rectangles[k];
    for (let j = 0; j < k; j++) {
      const t = indices[j];
      if (visibility[t] && doOverlap(rect, rectangles[j])) {
        visibility[i] = 0;
        pass4++;
        return;
      }
    }
  });

  const t0 = new Date().getTime();

  const v = visibility.reduce((a, x) => a + x);
  console.log(
    `${(t1 - t2).toFixed(2)} ms  ${(t0 - t1).toFixed(2)} ms` +
      `  minWeight = ${maxWeight.toFixed(1)}` +
      `  limitX = ${rad2deg(limitX).toFixed(2)}` +
      `  limitY = ${rad2deg(limitY).toFixed(2)}` +
      `  pass1-lon = ${pass1}  pass2-lat = ${pass2}  pass3-pop = ${pass3}  pass4-ovr = ${pass4}` +
      `  visible = ${indices.length} --> ${v}`
  );

  return visibility;
}

/**
 * Determines if two retangles overlap
 *
 *                     1[2, 3]
 *      +---------------+
 *      |               |   2[2, 3]
 *      |      +--------+------+
 *      |      |        |      |
 *      +------+--------+      |
 *   1[0, 1]   |               |
 *             +---------------+
 *          2[0, 1]
 *
 * @param {Array4} rect1 the 1st rectangle
 * @param {Array4} rect2 the 2nd rectangle
 * @returns {boolean} out
 */
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

/**
 * Transforms the vec4 with a mat4.
 * Simplified version where w = 1.0 and z is not calculated
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec4} out
 */
function transformMat4(out, a, m) {
  let x = a[0],
    y = a[1],
    z = a[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  // out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  out[2] = 0.0;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

function rad2deg(x) {
  return (x / Math.PI) * 180.0;
}
