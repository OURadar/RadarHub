//
//  App.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { colordict } from "./common";
import { Scope } from "./scope";
import { Scope2 } from "./scope2";
import { Health } from "./health";

function StatusBar(props) {
  return (
    <div className="statusBar">
      <div className="leftPadded">{props.message}</div>
    </div>
  );
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colordict(),
      message: "Loading ...",
      cargo: 0,
      header: { type: 0, length: 0 },
      samples: new Int16Array(),
      health: { time: 0 },
      wait: 0,
      t: null,
      i: null,
      q: null,
      a: null,
      len: 0,
      tic: 0,
      u: 0,
    };
    this.connect = this.connect.bind(this);
    this.waitOrConnect = this.waitOrConnect.bind(this);
  }

  static defaultProps = {
    radar: "horus",
    receiver: 0,
  };

  waitOrConnect() {
    if (this.state.wait <= 0.5) {
      this.connect();
    } else {
      const t = this.state.wait.toFixed(0);
      var stateToChange = {
        wait: this.state.wait - 0.2,
      };
      if (t <= 3) {
        stateToChange.message =
          "Connect in " + t + " second" + (t > 1 ? "s" : "");
      }
      this.setState(stateToChange);
      setTimeout(this.waitOrConnect, 200);
    }
  }

  connect() {
    this.setState({
      message: "Connecting ...",
    });
    const url =
      "ws://" + window.location.host + "/ws/" + this.props.radar + "/";
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = (_e) => {
      this.setState({ message: "Connected" });
      setTimeout(() => {
        this.setState((state) => {
          return { message: state.message == "Connected" ? "" : "Connected" };
        });
      }, 2000);
    };
    this.socket.onmessage = (e) => {
      // Message comes in as (cargo 0) (cargo 1) (cargo 0) (cargo 1) ...
      if (this.state.cargo == 0) {
        const h = new Int32Array(e.data);
        this.setState({
          cargo: 1,
          header: { type: h[0], length: h[1] },
        });
      } else if (this.state.cargo == 1) {
        // Switch to cargo 0 no matter what
        var stateToChange = {
          cargo: 0,
        };
        // Interpret the data based on header.type
        if (this.state.header.type == 1) {
          // AScope data - convert arraybuffer to int16 typed array
          const samples = new Int16Array(e.data);
          // Parse out the array into I/Q/A arrays for Scope
          const len = Math.floor(samples.length / 2);
          const i = new Float32Array(samples.slice(0, len));
          const q = new Float32Array(samples.slice(len));
          const a = new Float32Array(len);
          for (var k = 0; k < len; k++) {
            a[k] = Math.sqrt(i[k] * i[k] + q[k] * q[k]);
          }
          stateToChange.samples = samples;
          stateToChange.i = i;
          stateToChange.q = q;
          stateToChange.a = a;
          stateToChange.tic = this.state.tic + 1;
          if (this.state.len != len) {
            stateToChange.len = len;
            stateToChange.t = new Float32Array(Array(len).keys());
          }
        } else if (this.state.header.type == 2) {
          // Health data in JSON
          const health = JSON.parse(e.data);
          stateToChange.health = health;
        } else {
          // Unknown type, ignore the data but increases the u counter
          stateToChange.u = this.state.u + 1;
        }
        this.setState(stateToChange);
      }
    };
    this.socket.onclose = (_e) => {
      this.setState({ cargo: 0, wait: 5.0, message: "No connection" });
      setTimeout(this.waitOrConnect, 200);
    };
    this.socket.onerror = (_e) => {
      this.socket.close();
    };
  }

  componentDidMount() {
    // Get notified when the desktop theme is changed
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (e.matches) {
          this.setState({
            colors: colordict("dark"),
          });
        } else {
          this.setState({
            colors: colordict("light"),
          });
        }
      });
    // Preload something before we start to connect and draw
    fetch("/static/blob/helveticaneue/HelveticaNeueMed.ttf").then(() => {
      this.connect();
    });
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.close();
    }
  }

  render() {
    let data = {
      t: this.state.t,
      i: this.state.i,
      q: this.state.q,
      a: this.state.a,
    };
    let data2 = {
      t: this.state.t,
      i1: this.state.i,
      q1: this.state.q,
      a1: this.state.a,
      i2: this.state.i,
      q2: this.state.q,
      a2: this.state.a,
    };
    return (
      <div>
        <h1>RadarHub</h1>
        <div className="leftPadded">
          radar: {this.props.radar} &nbsp; receiver: {this.props.receiver}
        </div>
        <StatusBar message={this.state.message} />
        <h2>Single-Channel Scope</h2>
        <div className="scopeSingle">
          <Scope data={data} colors={this.state.colors} />
        </div>
        <h2>Dual-Channel Scope</h2>
        <div className="scopeDouble">
          <Scope2 data={data2} colors={this.state.colors} />
        </div>
        <h2>Health Status</h2>
        <Health message={this.state.health} />
      </div>
    );
  }
}

export default App;
