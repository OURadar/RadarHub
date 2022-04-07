//
//  ingest.worker.js
//  RadarHub
//
//  A separate web worker to ingest in the background
//
//  Created by Boonleng Cheong
//

let socket = null;
let radar;
let url;
let enums = {
  Definition: 1,
  Control: 1,
  Health: 1,
  Scope: 1,
  Response: 1,
  RadialZ: 1,
  RadialV: 1,
  RadialW: 1,
  RadialD: 1,
  RadialP: 1,
  RadialR: 1,
};
let message = "";
let wait = 0;
let scope = {
  ch1: {
    i: [],
    q: [],
    a: [],
  },
  ch2: {
    i: [],
    q: [],
    a: [],
  },
  count: 0,
};

self.onmessage = ({ data: { task, payload } }) => {
  if (task == "connect") {
    radar = payload.radar || "demo";
    url = payload.url || "localhost:8000";
    if (url === undefined) {
      return self.postMessage({
        type: "message",
        payload: "Error using connect",
      });
    }
    connect(payload.radar || "demo", payload.url);
  } else if (task == "execute") {
    console.log(`Sending in command ${payload}`);
    socket?.send(
      JSON.stringify({
        command: "userMessage",
        payload: payload,
        radar: radar,
      })
    );
  }
};

function connect(newRadar, url) {
  radar = newRadar;
  self.postMessage({ type: "message", payload: "Connecting ..." });

  socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  socket.onopen = (_e) => {
    self.postMessage({ type: "message", payload: "Hub Connected" });
    socket.send(
      JSON.stringify({
        radar: radar,
        command: "userConnect",
      })
    );
  };

  socket.onmessage = (e) => {
    const type = new Int8Array(e.data.slice(0, 1));
    // Interpret the data
    if (type == enums.Definition) {
      // Update payload definition
      const text = new TextDecoder().decode(e.data.slice(1));
      const update = JSON.parse(text);
      enums = { ...enums, ...update };
      //   console.log(enums);
    } else if (type == enums.Control) {
      // Control data in JSON
      const text = new TextDecoder().decode(e.data.slice(1));
      const dict = JSON.parse(text);
      if (dict.name == radar) {
        self.postMessage({
          type: "control",
          payload: dict.Controls,
        });
      } else {
        console.log(`dict.name = ${dict.name} /= ${radar}`);
      }
    } else if (type == enums.Health) {
      // Health data in JSON
      const text = new TextDecoder().decode(e.data.slice(1));
      const health = JSON.parse(text);
      self.postMessage({
        type: "health",
        payload: health,
      });
    } else if (type == enums.Scope) {
      // AScope data - convert arraybuffer to int16 typed array
      const samples = new Int16Array(e.data.slice(1));
      // Parse out the array into I/Q arrays for Scope
      const count = Math.floor(samples.length / 4);
      if (scope.count != count) {
        scope.count = count;
        scope.ch1.i = new Float32Array(count);
        scope.ch1.q = new Float32Array(count);
        scope.ch1.a = new Float32Array(count);
        scope.ch2.i = new Float32Array(count);
        scope.ch2.q = new Float32Array(count);
        scope.ch2.a = new Float32Array(count);
      }
      const offset1 = count;
      const offset2 = count * 2;
      const offset3 = count * 3;
      for (var k = 0; k < count; k++) {
        var i = samples[k];
        var q = samples[k + offset1];
        scope.ch1.i[k] = i;
        scope.ch1.q[k] = q;
        scope.ch1.a[k] = Math.sqrt(i * i + q * q);
        var i = samples[k + offset2];
        var q = samples[k + offset3];
        scope.ch2.i[k] = i;
        scope.ch2.q[k] = q;
        scope.ch2.a[k] = Math.sqrt(i * i + q * q);
      }
      self.postMessage({
        type: "scope",
        payload: scope,
      });
    } else if (type == enums.Response) {
      // Response of a command
      let text = new TextDecoder().decode(e.data.slice(1));
        if (text[0] == "N") {
          text = ` 👎🏼 ${text.slice(1)} <div class='emotion'>😿</div>`;
        } else if (text[0] == "A") {
          text = ` 👍🏼 ${text.slice(1)} <div class='emotion'>👻</div>`;
        } else {
          text = "";
        }
        if (text.length > 1) {
          self.postMessage({
            type: "response",
            payload: text,
          });
        } else {
          self.postMessage({ type: "response", payload: "hide" });
        }
      }
    }
  };

  socket.onclose = (_e) => {
    wait = 5.0;
    message = "No connection";
    setTimeout(waitOrConnect, 200);
  };

  socket.onerror = (_e) => {
    socket.close();
  };
}

function waitOrConnect() {
  if (wait <= 0.5) {
    connect(radar, url);
  } else {
    const t = wait.toFixed(0);
    if (t <= 3) {
      message = `Connect in ${t} second${t > 1 ? "s" : ""}`;
      self.postMessage({
        type: "message",
        payload: message,
      });
    }
    setTimeout(waitOrConnect, 200);
    wait = wait - 0.2;
  }
}
