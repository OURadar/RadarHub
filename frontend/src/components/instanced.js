//
//  Mostly copy pasta from:
//
//  https://github.com/wwwtyro/instanced-lines-demos
//
//  All credits go to Rye Terrell.
//  Checkout his article 'Instanced Line Rendering', at
//  https://wwwtyro.net/2019/11/18/instanced-lines.html
//

const segmentInstanceGeometry = [
  [0, -0.5],
  [1, -0.5],
  [1, 0.5],
  [0, -0.5],
  [1, 0.5],
  [0, 0.5],
];

function interleavedStrip(regl) {
  return regl({
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute vec2 pointA, pointB;
      uniform float width;
      uniform mat4 projection;
  
      void main() {
        vec2 xBasis = pointB - pointA;
        vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
        vec2 point = pointA + xBasis * position.x + yBasis * width * position.y;
        gl_Position = projection * vec4(point, 0, 1);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }`,

    attributes: {
      position: {
        buffer: regl.buffer(segmentInstanceGeometry),
        divisor: 0,
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 2,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    cull: {
      enable: true,
      face: "back",
    },

    depth: {
      enable: false,
    },

    count: segmentInstanceGeometry.length,
    instances: regl.prop("segments"),
  });
}

function circleGeometry(regl, resolution) {
  const position = [[0, 0]];
  for (let wedge = 0; wedge <= resolution; wedge++) {
    const theta = (2 * Math.PI * wedge) / resolution;
    position.push([0.5 * Math.cos(theta), 0.5 * Math.sin(theta)]);
  }
  return {
    buffer: regl.buffer(position),
    count: position.length,
  };
}

function roundJoin(regl, resolution) {
  const roundBuffer = circleGeometry(regl, resolution);
  return regl({
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute vec2 point;
      uniform float width;
      uniform mat4 projection;
  
      void main() {
        gl_Position = projection * vec4(width * position + point, 0, 1);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }`,

    depth: {
      enable: false,
    },

    attributes: {
      position: {
        buffer: roundBuffer.buffer,
        divisor: 0,
      },
      point: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 2,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    cull: {
      enable: true,
      face: "back",
    },

    primitive: "triangle fan",
    count: roundBuffer.count,
    instances: regl.prop("instances"),
  });
}

function roundCapJoinGeometry(regl, resolution) {
  const instanceRoundRound = [
    [0, -0.5, 0],
    [0, -0.5, 1],
    [0, 0.5, 1],
    [0, -0.5, 0],
    [0, 0.5, 1],
    [0, 0.5, 0],
  ];
  // Add the left cap.
  for (let step = 0; step < resolution; step++) {
    const theta0 = Math.PI / 2 + ((step + 0) * Math.PI) / resolution;
    const theta1 = Math.PI / 2 + ((step + 1) * Math.PI) / resolution;
    instanceRoundRound.push([0, 0, 0]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta0),
      0.5 * Math.sin(theta0),
      0,
    ]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta1),
      0.5 * Math.sin(theta1),
      0,
    ]);
  }
  // Add the right cap.
  for (let step = 0; step < resolution; step++) {
    const theta0 = (3 * Math.PI) / 2 + ((step + 0) * Math.PI) / resolution;
    const theta1 = (3 * Math.PI) / 2 + ((step + 1) * Math.PI) / resolution;
    instanceRoundRound.push([0, 0, 1]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta0),
      0.5 * Math.sin(theta0),
      1,
    ]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta1),
      0.5 * Math.sin(theta1),
      1,
    ]);
  }
  return {
    buffer: regl.buffer(instanceRoundRound),
    count: instanceRoundRound.length,
  };
}

function interleavedStripRoundCapJoin(regl, resolution) {
  const roundCapJoin = roundCapJoinGeometry(regl, resolution);
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 pointA, pointB;
      uniform float width;
      uniform mat4 projection;
  
      void main() {
        vec2 xBasis = normalize(pointB - pointA);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 offsetA = pointA + width * (position.x * xBasis + position.y * yBasis);
        vec2 offsetB = pointB + width * (position.x * xBasis + position.y * yBasis);
        vec2 point = mix(offsetA, offsetB, position.z);
        gl_Position = projection * vec4(point, 0, 1);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }`,

    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 2,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    depth: {
      enable: false,
    },

    cull: {
      enable: true,
      face: "back",
    },

    count: roundCapJoin.count,
    instances: regl.prop("segments"),
  });
}

function customPoints(regl) {
  return regl({
    vert: `
    precision highp float;
    attribute vec2 position;
    attribute vec2 point;
    uniform float width;
    uniform mat4 projection;
    void main() {
      gl_Position = projection * vec4(width * position + point, 0, 1);
    }`,

    frag: `
    precision highp float;
    uniform vec4 color;
    void main() {
      gl_FragColor = color;
    }`,

    depth: {
      enable: false,
    },

    attributes: {
      position: {
        buffer: regl.prop("pointGeometry"),
        divisor: 0,
      },
      point: {
        buffer: regl.prop("points"),
        divisor: 1,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    cull: {
      enable: true,
      face: "back",
    },

    primitive: regl.prop("pointPrimitive"),
    count: regl.prop("pointCount"),
    instances: regl.prop("instances"),
    viewport: regl.prop("viewport"),
  });
}

function noninterleavedStripRoundCapJoin(regl, resolution) {
  const roundCapJoin = roundCapJoinGeometry(regl, resolution);

  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      attribute float ax, ay, bx, by;
      uniform float width;
      uniform vec2 resolution;
      uniform mat4 projection;
  
      void main() {
        vec2 clipA = (projection * vec4(ax, ay, 0, 1)).xy;
        vec2 clipB = (projection * vec4(bx, by, 0, 1)).xy;
        vec2 offsetA = resolution * (0.5 * clipA + 0.5);
        vec2 offsetB = resolution * (0.5 * clipB + 0.5);
        vec2 xBasis = normalize(offsetB - offsetA);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 pointA = offsetA + width * (position.x * xBasis + position.y * yBasis);
        vec2 pointB = offsetB + width * (position.x * xBasis + position.y * yBasis);
        vec2 point = mix(pointA, pointB, position.z);
        gl_Position = vec4(2.0 * point/resolution - 1.0, 0, 1);
      }`,

    frag: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }`,

    depth: {
      enable: false,
    },

    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
      },
      ax: {
        buffer: regl.prop("dataX"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
      ay: {
        buffer: regl.prop("dataY"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
      bx: {
        buffer: regl.prop("dataX"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 1,
      },
      by: {
        buffer: regl.prop("dataY"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 1,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      resolution: regl.prop("resolution"),
      projection: regl.prop("projection"),
    },

    cull: {
      enable: true,
      face: "back",
    },

    count: roundCapJoin.count,
    instances: regl.prop("segments"),
    viewport: regl.prop("viewport"),
  });
}

export {
  interleavedStrip,
  interleavedStripRoundCapJoin,
  noninterleavedStripRoundCapJoin,
};
