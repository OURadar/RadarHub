//
//  artists.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { roundCapJoinGeometry } from "./instanced";

//  A simple 2D artist with basic shaders
export function basic(regl) {
  return regl({
    vert: `
      precision highp float;
      uniform vec4 color;
      uniform mat4 projection;
      attribute vec2 position;
      void main() {
        gl_Position = projection * vec4(position, 0.0, 1.0);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }`,

    uniforms: {
      color: regl.prop("color"),
      modelview: regl.prop("modelview"),
      projection: regl.prop("projection"),
    },

    attributes: {
      position: regl.prop("points"),
    },

    depth: {
      enable: false,
    },

    primitive: regl.prop("primitive"),
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

// A point drawing artist to paint points based on a large texture
export function sprite(regl) {
  return regl({
    vert: `
      precision highp float;
      uniform float scale;
      uniform mat4 projection;
      attribute vec2 position;
      attribute vec2 origin;
      attribute vec2 spread;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;
      void main()	{
        uv = origin;
        wh = spread;
        size = max(spread.x, spread.y);
        gl_Position = projection * vec4(position, 0.0, 1.0);
        gl_PointSize = scale * size;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      uniform vec2 bound;
      uniform vec4 color;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;

      void main()	{
        vec2 q = gl_PointCoord;
        vec2 p = (uv + q * size - 0.5 * (size - wh)) / bound;
        if (any(lessThan(q, 0.5 * (size - wh) / size)) ||
          any(greaterThan(q, 0.5 * (size + wh) / size))) {
          gl_FragColor = color;
        } else {
          gl_FragColor = texture2D(texture, p);
        }
      }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
      scale: regl.prop("scale"),
      bound: regl.prop("bound"),
      texture: regl.prop("texture"),
    },

    attributes: {
      position: regl.prop("points"),
      origin: regl.prop("origin"),
      spread: regl.prop("spread"),
    },

    depth: {
      enable: false,
    },

    primitive: "points",
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

//  A simple 2D artist to draw a rectangle
export function rect2(regl) {
  const position = regl.buffer([
    [-0.5, -0.5],
    [+0.5, -0.5],
    [+0.5, +0.5],
    [-0.5, -0.5],
    [+0.5, +0.5],
    [-0.5, +0.5],
  ]);
  const origin = regl.buffer([
    [0.0, 0.0],
    [1.0, 0.0],
    [1.0, 1.0],
    [0.0, 0.0],
    [1.0, 1.0],
    [0.0, 1.0],
  ]);
  return regl({
    vert: `
      precision highp float;
      uniform mat4 projection;
      attribute vec2 position;
      attribute vec2 origin;
      varying vec2 uv;
      void main() {
        gl_Position = vec4(position, 0, 1);
        uv = origin;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      varying vec2 uv;
      void main() {
        gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
      }`,

    uniforms: {
      projection: regl.prop("projection"),
      texture: regl.prop("texture"),
    },

    attributes: {
      position: position,
      origin: origin,
    },

    viewport: regl.prop("viewport"),
    count: 2,
  });
}

//  A simple 3D artist with basic shaders
export function basic3(regl) {
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 projection;
      void main() {
        gl_Position = projection * vec4(position, 1);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    attributes: {
      position: regl.prop("points"),
    },

    primitive: regl.prop("primitive"),
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
  });
}

export function element3(regl) {
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 modelview;
      uniform mat4 projection;
      varying vec3 n;
      varying float s;
      void main() {
        gl_Position = projection * modelview * vec4(position, 1.0);
        n = mat3(modelview) * normalize(position);
        s = dot(vec3(0.0, 0.0, 1.0), n);
        s = clamp(0.4 + 0.6 * s, 0.0, 1.0);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      varying float s;
      void main() {
        gl_FragColor = vec4(color.rgb, s);
      }`,

    uniforms: {
      color: regl.prop("color"),
      modelview: regl.prop("modelview"),
      projection: regl.prop("projection"),
    },

    attributes: {
      position: regl.prop("points"),
    },

    primitive: regl.prop("primitive"),
    elements: regl.prop("elements"),
    viewport: regl.prop("viewport"),

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

const earth = require("./earth-grid");

export function sphere(regl) {
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 modelview;
      uniform mat4 projection;
      uniform vec4 color;
      varying vec4 adjustedColor;
      varying float s;
      vec3 n;
      void main() {
        gl_Position = projection * modelview * vec4(position, 1.0);
        n = mat3(modelview) * normalize(position);
        s = clamp(1.3 * n.z, 0.2, 1.0);
        adjustedColor = color * s;
      }`,

    frag: `
      precision highp float;
      varying vec4 adjustedColor;
      void main() {
        gl_FragColor = adjustedColor;
      }`,

    uniforms: {
      modelview: regl.prop("modelview"),
      projection: regl.prop("projection"),
      color: regl.prop("color"),
    },

    attributes: {
      position: regl.buffer({
        usage: "static",
        type: "float",
        data: earth.points,
      }),
    },

    primitive: "lines",
    elements: earth.elements,
    viewport: regl.prop("viewport"),

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

// A point drawing artist to paint points based on a large texture
export function sprite3(regl) {
  return regl({
    vert: `
      precision highp float;
      uniform float scale;
      uniform mat4 projection;
      attribute vec3 position;
      attribute vec2 origin;
      attribute vec2 spread;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;
      void main()	{
        uv = origin;
        wh = spread;
        size = max(spread.x, spread.y);
        gl_Position = projection * vec4(position, 1.0);
        gl_PointSize = scale * size;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      uniform vec2 bound;
      uniform vec4 color;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;
      void main()	{
        vec2 q = gl_PointCoord;
        vec2 p = (uv + q * size - 0.5 * (size - wh)) / bound;
        if (any(lessThan(q, 0.5 * (size - wh) / size)) ||
          any(greaterThan(q, 0.5 * (size + wh) / size))) {
          gl_FragColor = color;
        } else {
          gl_FragColor = texture2D(texture, p);
        }
      }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
      scale: regl.prop("scale"),
      bound: regl.prop("bound"),
      texture: regl.prop("texture"),
    },

    attributes: {
      position: regl.prop("points"),
      origin: regl.prop("origins"),
      spread: regl.prop("spreads"),
    },

    depth: {
      enable: false,
    },

    primitive: "points",
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

//
// modified from interleavedStripRoundCapJoin3D()
// Each segment is indepedent. The end point of the previous segment is not reused.
// Why? This method is meant for a single draw call to draw many line loops, reusing
// the previous end point is not appropriate. The trade-off is, of course, more memory
// usage but there is a lot more memory than compute here.
//
export function instancedLines(regl, resolution) {
  const roundCapJoin = roundCapJoinGeometry(regl, resolution);
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      attribute vec3 pointA, pointB;
      uniform float width;
      uniform vec2 resolution;
      uniform mat4 model, view, projection;
      uniform vec4 color;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;

      void main() {
        vec4 modelPointA = model * vec4(pointA, 1.0);
        vec4 modelPointB = model * vec4(pointB, 1.0);
        vec4 clip0 = projection * view * modelPointA;
        vec4 clip1 = projection * view * modelPointB;
        vec2 screen0 = resolution * (0.5 * clip0.xy/clip0.w + 0.5);
        vec2 screen1 = resolution * (0.5 * clip1.xy/clip1.w + 0.5);
        vec2 xBasis = normalize(screen1 - screen0);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 pt0 = screen0 + width * (position.x * xBasis + position.y * yBasis);
        vec2 pt1 = screen1 + width * (position.x * xBasis + position.y * yBasis);
        vec2 pt = mix(pt0, pt1, position.z);
        vec4 clip = mix(clip0, clip1, position.z);
        gl_Position = vec4(clip.w * (2.0 * pt/resolution - 1.0), clip.z, clip.w);
        normal.xyz = normalize(mat3(view) * modelPointA.xyz);
        normal.w = clamp(dot(vec3(0.0, 0.0, 1.3), normal.xyz), 0.05, 1.0) * quad.a;
        normal.xyz *= quad.z;
        adjustedColor = color;
        adjustedColor.a *= normal.w;
      }`,

    frag: `
      precision highp float;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;
      void main() {
        if (normal.w < 0.05)
          discard;
        vec4 computedColor = vec4(normal.xzy * normal.w, normal.w);
        gl_FragColor = mix(computedColor, adjustedColor, quad.y);
      }`,

    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 3,
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 3,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      quad: regl.prop("quad"),
      model: regl.prop("model"),
      view: regl.prop("view"),
      projection: regl.prop("projection"),
      resolution: ({ viewportWidth, viewportHeight }) => [
        viewportWidth,
        viewportHeight,
      ],
    },

    depth: {
      enable: false,
    },

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },

    count: roundCapJoin.count,
    instances: regl.prop("segments"),
    viewport: regl.prop("viewport"),
  });
}

//
// Inspired by interleavedStripRoundCapJoin3D() for drawing map polygon lines.
// Here, the model matrix is always an identity matrix so it's omitted.
// Also, instead of computing the instanced geometry on the w=1 plane (screen),
// the instanced geometry is computed on the itermediate w-plane after the
// view-projection operation.
//
export function simplifiedInstancedLines(regl) {
  const roundCapJoin = roundCapJoinGeometry(regl, 0);
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      attribute vec3 pointA, pointB;
      uniform float width;
      uniform vec2 resolution;
      uniform mat4 view, projection;
      uniform vec4 color;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;

      void main() {
        mat4 mvp = projection * view;
        vec4 clip0 = mvp * vec4(pointA, 1.0);
        vec4 clip1 = mvp * vec4(pointB, 1.0);
        vec2 xBasis = normalize(clip1.xy - clip0.xy);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 anchor = (position.x * xBasis + position.y * yBasis) * 2.0 * width / resolution;
        vec2 pt0 = clip0.xy + anchor * clip0.w;
        vec2 pt1 = clip1.xy + anchor * clip1.w;
        vec2 pt = mix(pt0, pt1, position.z);
        vec4 clip = mix(clip0, clip1, position.z);
        gl_Position = vec4(pt.xy, clip.z, clip.w);
        normal.xyz = normalize(mat3(view) * pointA);
        normal.w = clamp(normal.z * 1.3, 0.0, 1.0) * quad.a;
        vec4 computedColor = vec4(normal.xzy * quad.z * normal.w, normal.w);
        adjustedColor = mix(computedColor, color * normal.w, quad.y);
      }`,

    frag: `
      precision highp float;
      varying vec4 adjustedColor;
      void main() {
        if (adjustedColor.w < 0.05)
          discard;
        gl_FragColor = adjustedColor;
      }`,

    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 3,
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 3,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      quad: regl.prop("quad"),
      view: regl.prop("view"),
      projection: regl.prop("projection"),
      resolution: ({ viewportWidth, viewportHeight }) => [
        viewportWidth,
        viewportHeight,
      ],
    },

    depth: {
      enable: false,
    },

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },

    count: roundCapJoin.count,
    instances: regl.prop("segments"),
    viewport: regl.prop("viewport"),
  });
}

// Rectangular patch instancing
export function instancedPatches(regl) {
  const buffer = regl.buffer([
    [-0.5, -0.5],
    [+0.5, -0.5],
    [+0.5, +0.5],
    [-0.5, -0.5],
    [+0.5, +0.5],
    [-0.5, +0.5],
  ]);
  return regl({
    vert: `
      precision highp float;
      uniform mat4 projection;
      uniform vec2 resolution;
      uniform vec2 bound;
      uniform float scale;
      attribute vec2 position;
      attribute vec3 point;
      attribute vec2 origin;
      attribute vec2 spread;
      attribute float opacity;
      varying vec2 uv;
      varying float a;
      vec4 modelPoint;
      void main() {
        uv = ((position + 0.5) * spread + origin) / bound;
        modelPoint = projection * vec4(point, 1.0);
        modelPoint.xy += position * spread / scale / resolution * 2.0 * modelPoint.w;
        gl_Position = modelPoint;
        a = opacity;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      varying vec2 uv;
      varying float a;
      void main() {
        if (a < 0.05) {
          discard;
        }
        gl_FragColor = texture2D(texture, uv) * a;
      }`,

    attributes: {
      position: {
        buffer: buffer,
        divisor: 0,
      },
      point: {
        buffer: regl.prop("points"),
        divisor: 1,
      },
      origin: {
        buffer: regl.prop("origins"),
        divisor: 1,
      },
      spread: {
        buffer: regl.prop("spreads"),
        divisor: 1,
      },
      opacity: {
        buffer: regl.prop("opacity"),
        divisor: 1,
      },
    },

    uniforms: {
      projection: regl.prop("projection"),
      resolution: ({ viewportWidth, viewportHeight }) => [
        viewportWidth,
        viewportHeight,
      ],
      texture: regl.prop("texture"),
      bound: regl.prop("bound"),
      scale: regl.prop("scale"),
    },

    depth: {
      enable: false,
    },

    blend: {
      enable: true,
      func: {
        src: "one",
        dst: "one minus src alpha",
      },
    },

    count: 6,
    instances: regl.prop("count"),
    viewport: regl.prop("viewport"),
  });
}

export function texturedElements(regl) {
  return regl({
    vert: `
      precision highp float;
      uniform mat4 projection;
      uniform mat4 modelview;
      attribute vec3 position;
      attribute vec2 origin;
      varying vec2 uv;
      void main() {
        uv = origin;
        gl_Position = projection * modelview * vec4(position, 1.0);
      }`,

    frag: `
      precision highp float;
      uniform sampler2D colormap;
      uniform sampler2D data;
      uniform float index;
      varying vec2 uv;
      void main() {
        float x = texture2D(data, uv).x;
        if (x < 1.0 / 255.0)
          discard;
        gl_FragColor = texture2D(colormap, vec2(x, index));
      }`,

    attributes: {
      position: regl.prop("points"),
      origin: regl.prop("origins"),
    },

    uniforms: {
      projection: regl.prop("projection"),
      modelview: regl.prop("modelview"),
      colormap: regl.prop("colormap"),
      index: regl.prop("index"),
      data: regl.prop("data"),
    },

    blend: {
      enable: true,
      func: {
        src: "one",
        dst: "one minus src alpha",
      },
    },

    elements: regl.prop("elements"),
    viewport: regl.prop("viewport"),
  });
}
