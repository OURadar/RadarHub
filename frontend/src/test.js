gl = require("gl-matrix");
const mat4 = gl.mat4;
const vec3 = gl.vec3;
const quat = gl.quat;

const earthRadius = 6371.0;

//

function speed_test() {
  console.log("===========");
  console.log("Speed Tests");
  console.log("===========");
  console.log("mat4.fromTranslation() -> mat4.fromQuat() -> mat4.multiply()");

  let dest = mat4.create();
  let quatMat = mat4.create();
  let v = vec3.fromValues(1, 2, 4);
  let q = quat.fromValues(1, 0, 0, 0.25);

  let t = performance.now();

  const count = 10000000;

  for (let k = 0; k < count; k++) {
    mat4.fromTranslation(dest, v);
    mat4.fromQuat(quatMat, q);
    mat4.multiply(dest, dest, quatMat);
  }

  dt1 = performance.now() - t;
  dt1 *= 1000 / count;

  console.log(`Elapsed time = ${dt1.toFixed(4)} ms`);
  console.log(dest);
  console.log("...");
  console.log("mat4.fromRotationTranslation()");

  t = performance.now();

  for (let k = 0; k < count; k++) {
    mat4.fromRotationTranslation(dest, q, v);
  }

  dt2 = performance.now() - t;
  dt2 *= 1000 / count;

  console.log(`Elapsed time = ${dt2.toFixed(4)} ms`);
  console.log(dest);

  let ratio = dt1 / dt2;

  console.log(`Ratio = ${ratio.toFixed(2)}`);
}

function dolly_test() {
  console.log("============");
  console.log("dolll_test()");
  console.log("============");

  let longitude = -97.422413;
  let latitude = 35.25527;

  let f = 1.2;
  let r = 169.0;
  let v = vec3.fromValues(0, 0, earthRadius);
  let e = vec3.fromValues(0, 0.01, r);

  // The radar
  let model = mat4.create();
  let quaternion = quat.create();
  quat.fromEuler(quaternion, -latitude, longitude, 0);
  mat4.fromQuat(model, quaternion);
  mat4.translate(model, model, v);
  // mat4.getTranslation(v, model);
  // mat4.getRotation(quaternion, model);
  // mat4.fromRotationTranslation(model, quaternion, v);

  // Te target
  let targetModel = mat4.clone(model);
  let targetTranslation = vec3.create();
  let targetQuaternion = quat.create();
  let targetScale = vec3.create();
  mat4.scale(targetModel, targetModel, [0.03, 0.03, 0.03]);
  mat4.getTranslation(targetTranslation, targetModel);
  mat4.getRotation(targetQuaternion, targetModel);
  mat4.getScaling(targetScale, targetModel);

  // The eye
  let eyeModel = mat4.clone(model);
  let eyeTranslation = vec3.create();
  let eyeQuaternion = quat.create();
  let eyeScale = vec3.create();
  let b = r * f;
  mat4.translate(eyeModel, eyeModel, e);
  // mat4.scale(eyeModel, eyeModel, [b, b, r]);
  // mat4.scale(eyeModel, eyeModel, [r, r, r]);

  mat4.getTranslation(eyeTranslation, eyeModel);
  mat4.getRotation(eyeQuaternion, eyeModel);
  mat4.getScaling(eyeScale, eyeModel);

  // mat4.fromRotationTranslationScale(
  //   eyeModel,
  //   eyeQuaternion,
  //   eyeTranslation,
  //   eyeScale
  // );

  geo = {
    fov: f,
    eye: {
      range: r,
      model: eyeModel,
      quaternion: eyeQuaternion,
      translation: eyeTranslation,
      scale: eyeScale,
      up: vec3.fromValues(0, 1, 0),
    },
    target: {
      range: earthRadius,
      model: targetModel,
      quaternion: targetQuaternion,
      translation: targetTranslation,
      scale: targetScale,
    },
    view: mat4.create(),
    projection: mat4.create(),
  };

  show(geo);
  console.log("...");

  // getRotation(eyeQuaternion, eyeModel);
  // console.log("---");
  // quat.normalize(eyeQuaternion, eyeQuaternion);

  // fromRotationTranslationScale(
  //   eyeModel,
  //   eyeQuaternion,
  //   eyeTranslation,
  //   eyeScale
  // );
  mat4.fromRotationTranslation(eyeModel, eyeQuaternion, eyeTranslation);
  mat4.scale(eyeModel, eyeModel, eyeScale);

  mat4.getTranslation(eyeTranslation, eyeModel);
  mat4.getRotation(eyeQuaternion, eyeModel);
  mat4.getScaling(eyeScale, eyeModel);

  show(geo);

  console.log("...");

  // fromRotationTranslationScale(
  //   eyeModel,
  //   eyeQuaternion,
  //   eyeTranslation,
  //   eyeScale
  // );
  mat4.fromRotationTranslation(eyeModel, eyeQuaternion, eyeTranslation);
  mat4.scale(eyeModel, eyeModel, eyeScale);

  mat4.getTranslation(eyeTranslation, eyeModel);
  mat4.getRotation(eyeQuaternion, eyeModel);
  mat4.getScaling(eyeScale, eyeModel);

  show(geo);

  // updateProjection(geo);

  // console.log("---");

  // dolly(geo, 1);

  // console.log("---");

  // show(geo);
}

function dolly(geo, m) {
  let q = geo.eye.quaternion;
  let t = geo.eye.translation;
  let s = geo.eye.scale;
  let d = vec3.subtract([], t, geo.target.translation);
  let l = vec3.length(d);
  // console.log(`d = ${vec3.string(d)} (${l.toFixed(2)})  [ m = ${m} ]`);
  let n = clamp(l / m, 10, 1.2 * earthRadius);
  vec3.scale(d, d, n / l);
  // console.log(`d = ${vec3.string(d)} (${l.toFixed(2)})  [ m = ${m} ]`);
  let b = l * geo.fov;
  vec3.set(s, b, b, l);
  geo.eye.range = l;

  console.log("...");
  show(geo);

  // console.log("d = " + vec3.string(d));
  vec3.add(t, geo.target.translation, d);
  // console.log("t = " + vec3.string(t));
  console.log("...");

  show(geo);
  console.log("...");

  mat4.fromRotationTranslationScale(geo.eye.model, q, t, s);
  show(geo);

  updateProjection(geo);

  return geo;
}

function updateProjection(geo) {
  const t = geo.target.translation;
  const e = geo.eye.translation;

  let u = vec3.fromValues(geo.eye.model[4], geo.eye.model[5], geo.eye.model[6]);
  vec3.normalize(u, u);

  console.log("u = " + vec3.string(u));

  mat4.lookAt(geo.view, e, t, u);

  return geo;
}

function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

mat4.string = function (m, dec = 3, len = 9, all = true) {
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

vec3.string = function (v, dec = 3, len = 9) {
  let v0 = v[0].toFixed(dec).padStart(len, " ");
  let v1 = v[1].toFixed(dec).padStart(len, " ");
  let v2 = v[2].toFixed(dec).padStart(len, " ");

  return `${v0} ${v1} ${v2}`;
};

quat.string = function (v, dec = 3, len = 9) {
  let v0 = v[0].toFixed(dec).padStart(len, " ");
  let v1 = v[1].toFixed(dec).padStart(len, " ");
  let v2 = v[2].toFixed(dec).padStart(len, " ");
  let v3 = v[3].toFixed(dec).padStart(len, " ");

  return `${v0} ${v1} ${v2} ${v3}`;
};

function show(geo) {
  let u = vec3.fromValues(geo.eye.model[4], geo.eye.model[5], geo.eye.model[6]);
  // vec3.normalize(u, u);
  let m = quat.length(geo.eye.quaternion).toFixed(4);
  console.log("m = " + mat4.string(geo.eye.model));
  console.log("q = " + quat.string(geo.eye.quaternion) + `  (${m})`);
  console.log("v = " + vec3.string(geo.eye.translation, 1));
  console.log("s = " + vec3.string(geo.eye.scale, 1));
  console.log("u = " + vec3.string(u));
}

function getRotation(out, mat) {
  let scaling = new gl.glMatrix.ARRAY_TYPE(3);
  mat4.getScaling(scaling, mat);
  let is1 = 1 / scaling[0];
  let is2 = 1 / scaling[1];
  let is3 = 1 / scaling[2];
  let sm11 = mat[0] * is1;
  let sm12 = mat[1] * is2;
  let sm13 = mat[2] * is3;
  let sm21 = mat[4] * is1;
  let sm22 = mat[5] * is2;
  let sm23 = mat[6] * is3;
  let sm31 = mat[8] * is1;
  let sm32 = mat[9] * is2;
  let sm33 = mat[10] * is3;
  let trace = sm11 + sm22 + sm33;
  console.log(`trace = ${trace}`);
  let S = 0;
  if (trace > 0) {
    S = Math.sqrt(trace + 1.0) * 2;
    out[3] = 0.25 * S;
    out[0] = (sm23 - sm32) / S;
    out[1] = (sm31 - sm13) / S;
    out[2] = (sm12 - sm21) / S;
  } else if (sm11 > sm22 && sm11 > sm33) {
    S = Math.sqrt(1.0 + sm11 - sm22 - sm33) * 2;
    out[3] = (sm23 - sm32) / S;
    out[0] = 0.25 * S;
    out[1] = (sm12 + sm21) / S;
    out[2] = (sm31 + sm13) / S;
  } else if (sm22 > sm33) {
    S = Math.sqrt(1.0 + sm22 - sm11 - sm33) * 2;
    out[3] = (sm31 - sm13) / S;
    out[0] = (sm12 + sm21) / S;
    out[1] = 0.25 * S;
    out[2] = (sm23 + sm32) / S;
  } else {
    S = Math.sqrt(1.0 + sm33 - sm11 - sm22) * 2;
    out[3] = (sm12 - sm21) / S;
    out[0] = (sm31 + sm13) / S;
    out[1] = (sm23 + sm32) / S;
    out[2] = 0.25 * S;
  }
  return out;
}

function fromRotationTranslationScale(out, q, v, s) {
  // Quaternion math
  let x = q[0],
    y = q[1],
    z = q[2],
    w = q[3];
  let x2 = x + x;
  let y2 = y + y;
  let z2 = z + z;
  let xx = x * x2;
  let xy = x * y2;
  let xz = x * z2;
  let yy = y * y2;
  let yz = y * z2;
  let zz = z * z2;
  let wx = w * x2;
  let wy = w * y2;
  let wz = w * z2;
  let sx = s[0];
  let sy = s[1];
  let sz = s[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}

//

console.log("Running tests ...");

dolly_test();

speed_test();
