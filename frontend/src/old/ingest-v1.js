//
//  ingest.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/25/2021.
//

class Ingest {
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
      control: { time: 0 },
      ppi: {
        az: null,
        z: [],
      },
    };
    this.u = 0;
    this.tic = 0;
    this.wait = 0;
    this.message = "Loading ...";
    this.response = "";
    this.onUpdate = (_data) => {};
    this.enums = {
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

    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.waitOrConnect = this.waitOrConnect.bind(this);
    this.execute = this.execute.bind(this);
  }

  connect() {
    this.message = "Connecting ...";
    this.onUpdate(this.tic++);
    const p = window.location.protocol == "https:" ? "wss" : "ws";
    const url = `${p}://${window.location.host}/ws/${this.radar}/`;
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = (_e) => {
      this.message = "Hub connected";
      setTimeout(() => {
        if (this.message == "Hub connected") {
          this.message = "";
          this.onUpdate(this.tic++);
        }
      }, 2000);
      this.socket.send(
        JSON.stringify({
          radar: this.radar,
          command: "userConnect",
        })
      );
      this.onUpdate(this.tic++);
    };
    this.socket.onmessage = (e) => {
      const type = new Int8Array(e.data.slice(0, 1));
      let newData = {};
      // Interpret the data
      if (type == this.enums.Definition) {
        // Update payload definition
        const text = new TextDecoder().decode(e.data.slice(1));
        const enums = JSON.parse(text);
        this.enums = { ...this.enums, ...enums };
        console.log(this.enums);
      } else if (type == this.enums.Control) {
        // Control data in JSON
        const text = new TextDecoder().decode(e.data.slice(1));
        const dict = JSON.parse(text);
        if (dict.name) {
          newData.control = dict["Controls"];
        } else {
          console.log(`dict.name = ${dict.name} /= ${this.radar}`);
        }
      } else if (type == this.enums.Health) {
        // Health data in JSON
        const text = new TextDecoder().decode(e.data.slice(1));
        const health = JSON.parse(text);
        newData.health = health;
        this.tic += 1;
      } else if (type == this.enums.Scope) {
        // AScope data - convert arraybuffer to int16 typed array
        const samples = new Int16Array(e.data.slice(1));
        // Parse out the array into I/Q/A arrays for Scope
        const len = Math.floor(samples.length / 2);
        const i = new Float32Array(samples.slice(0, len));
        const q = new Float32Array(samples.slice(len));
        const a = new Float32Array(len);
        for (var k = 0; k < len; k++) {
          a[k] = Math.hypot(i[k], q[k]);
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
      } else if (type == this.enums.Response) {
        // Response of a command
        let text = new TextDecoder().decode(e.data.slice(1));
        if (text.includes("not") || text.includes("NAK")) {
          text = ` 👎🏼 ${text} <div class='emotion'>😿</div>`;
        } else {
          text = ` 👍🏼 ${text} <div class='emotion'>👻</div>`;
        }
        this.response = text;
        setTimeout(() => {
          if (this.response == text) {
            this.response = "";
            this.onUpdate(this.tic++);
          }
        }, 2000);
      } else {
        // Unknown type, ignore the data but increases the u counter
        this.u += 1;
      }
      this.data = { ...this.data, ...newData };
      this.onUpdate(this.tic++);
    };
    this.socket.onclose = (_e) => {
      this.wait = 5.0;
      this.message = "No connection";
      setTimeout(this.waitOrConnect, 200);
      this.onUpdate(this.tic++);
    };
    this.socket.onerror = (_e) => {
      this.socket.close();
    };
  }

  disconnect() {
    this.socket.close();
  }

  waitOrConnect() {
    if (this.wait <= 0.5) {
      this.connect();
    } else {
      const t = this.wait.toFixed(0);
      if (t <= 3) {
        this.message = `Connect in ${t} second${t > 1 ? "s" : ""}`;
        this.onUpdate(this.tic++);
      }
      setTimeout(this.waitOrConnect, 200);
      this.wait = this.wait - 0.2;
    }
  }

  execute(command) {
    this.socket.send(
      JSON.stringify({
        radar: this.radar,
        command: "userMessage",
        payload: command,
      })
    );
  }
}

export { Ingest };
