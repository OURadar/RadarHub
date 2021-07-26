//
//  data.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/25/2021.
//

class Data {
  constructor(radar) {
    this.radar = radar;
    this.socket = null;
    this.data = {
      t: null,
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
      health: { time: 0 },
      ppi: {
        az: null,
        z: [],
      },
    };
    this.u = 0;
    this.tic = 0;
    this.wait = 0;
    this.message = "Loading ...";
    this.onupdate = (_data) => {};

    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.waitOrConnect = this.waitOrConnect.bind(this);
  }

  waitOrConnect() {
    if (this.wait <= 0.5) {
      this.connect();
    } else {
      const t = this.wait.toFixed(0);
      if (t <= 3) {
        this.message = "Connect in " + t + " second" + (t > 1 ? "s" : "");
        this.onupdate(this.tic++);
      }
      setTimeout(this.waitOrConnect, 200);
      this.wait = this.wait - 0.2;
    }
  }

  connect() {
    this.message = "Connecting ...";
    this.onupdate(this.tic++);
    const p = window.location.protocol == "https:" ? "wss" : "ws";
    const url = p + "://" + window.location.host + "/ws/" + this.radar + "/";
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = (_e) => {
      this.message = "Connected";
      setTimeout(() => {
        if (this.message == "Connected") {
          this.message = "";
          this.onupdate(this.tic++);
        }
      }, 2000);
      this.onupdate(this.tic++);
    };
    this.socket.onmessage = (e) => {
      const type = new Int8Array(e.data.slice(0, 1));
      let newData = {};
      // Interpret the data based on header.type
      if (type == 1) {
        // AScope data - convert arraybuffer to int16 typed array
        const samples = new Int16Array(e.data.slice(1));
        // Parse out the array into I/Q/A arrays for Scope
        const len = Math.floor(samples.length / 2);
        const i = new Float32Array(samples.slice(0, len));
        const q = new Float32Array(samples.slice(len));
        const a = new Float32Array(len);
        for (var k = 0; k < len; k++) {
          a[k] = Math.sqrt(i[k] * i[k] + q[k] * q[k]);
        }
        newData.ch1 = {
          i: i,
          q: q,
          a: a,
        };
        // Pretend H & V are the same for the time being... sorry future self
        newData.ch2 = {
          i: i,
          q: q,
          a: a,
        };
        if (this.data.t === null || this.data.t.length != len) {
          newData.t = new Float32Array(Array(len).keys());
        }
        this.tic += 1;
      } else if (type == 2) {
        // Health data in JSON
        const text = new TextDecoder().decode(e.data.slice(1));
        const health = JSON.parse(text);
        newData.health = health;
        this.tic += 1;
      } else {
        // Unknown type, ignore the data but increases the u counter
        this.u += 1;
      }
      this.data = { ...this.data, ...newData };
      this.onupdate(this.tic);
    };
    this.socket.onclose = (_e) => {
      this.wait = 5.0;
      this.message = "No connection";
      setTimeout(this.waitOrConnect, 200);
      this.onupdate(this.tic++);
    };
    this.socket.onerror = (_e) => {
      this.socket.close();
    };
  }

  disconnect() {
    this.socket.close();
  }
}

export { Data };
