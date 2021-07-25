//
//  App.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { colordict } from "./common";
import { Data } from "./data";
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
      tic: 0,
    };
    this.ingest = new Data(props.radar);
    this.ingest.onupdate = () => {
      this.forceUpdate();
    };
  }

  static defaultProps = {
    radar: "horus",
    receiver: 0,
  };

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
      this.ingest.connect();
    });
  }

  componentWillUnmount() {
    this.ingest.disconnect();
  }

  render() {
    let single = { t: this.ingest.data.t, ...this.ingest.data.ch1 };
    return (
      <div>
        <h1>RadarHub</h1>
        <div className="leftPadded">
          radar: {this.props.radar} &nbsp; receiver: {this.props.receiver}
        </div>
        <StatusBar message={this.ingest.message} />
        <h2>Single-Channel Scope</h2>
        <div className="scopeSingle">
          <Scope data={single} colors={this.state.colors} />
        </div>
        <h2>Dual-Channel Scope</h2>
        <div className="scopeDouble">
          <Scope2 data={this.ingest.data} colors={this.state.colors} />
        </div>
        <h2>Health Status</h2>
        <Health message={this.ingest.data.health} />
      </div>
    );
  }
}

export default App;
