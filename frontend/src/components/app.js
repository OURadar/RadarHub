//
//  App.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { colorDict, detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Scope } from "./scope";
import { Scope2 } from "./scope2";
import { Health } from "./health";
import { Control } from "./control";
import { TopBar } from "./topbar";
import { Ingest } from "./ingest";
import { theme } from "./theme";

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
    this.isMobile = detectMob();
    console.log(`isMobile = ${this.isMobile}`);
  }

  static defaultProps = {
    radar: "demo",
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
      <ThemeProvider theme={theme}>
        <TopBar ingest={this.ingest} isMobile={this.isMobile} />
        <Health dict={this.ingest.data.health} />
        <Control ingest={this.ingest} />
        <SectionHeader name="scope" />
        <h3>Single-Channel</h3>
        <div className="scopeSingle">
          <Scope data={single} colors={this.state.colors} />
        </div>
        <h3>Dual-Channel</h3>
        <div className="scopeDouble">
          <Scope2 data={this.ingest.data} colors={this.state.colors} />
        </div>
      </ThemeProvider>
    );
  }
}

export default App;
