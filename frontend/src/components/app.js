//
//  App.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { colorDict } from "./common";
import { Ingest } from "./ingest";
import { Scope } from "./scope";
import { Scope2 } from "./scope2";
import { Health } from "./health";
import { Control } from "./control";
import { Pad } from "./simple";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      tic: 0,
    };
    this.ingest = new Ingest(props.radar);
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
            colors: colorDict("dark"),
          });
        } else {
          this.setState({
            colors: colorDict("light"),
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
        <div className="topbar">
          <h1>RadarHub</h1>
          <div className="leftPadded">
            {this.props.radar}{" "}
            {this.ingest.message.length ? " / " + this.ingest.message : ""}
          </div>
        </div>
        <Pad />
        <h2>Control</h2>
        <Control ingest={this.ingest} />
        <h2>Health Status</h2>
        <Health dict={this.ingest.data.health} />
        <h2>Scopes</h2>
        <h3>Single-Channel</h3>
        <div className="scopeSingle">
          <Scope data={single} colors={this.state.colors} />
        </div>
        <h3>Dual-Channel</h3>
        <div className="scopeDouble">
          <Scope2 data={this.ingest.data} colors={this.state.colors} />
        </div>
      </div>
    );
  }
}

export default App;
