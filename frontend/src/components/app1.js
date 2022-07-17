//
//  app1.js - Scope
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import { detectMob } from "./common";
import { Scope } from "./scope";
import { Scope2 } from "./scope2";
import { Health } from "./health";
import { Control } from "./control";
import { TopBar } from "./topbar";
import { Ingest } from "./ingest";
import { theme, colorDict } from "./theme";

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
    this.ingest.connect();
  }

  componentWillUnmount() {
    this.ingest.disconnect();
  }

  render() {
    let single = { t: this.ingest.data.t, ...this.ingest.data.ch1 };
    let double = this.ingest.data;
    return (
      <ThemeProvider theme={theme}>
        <TopBar ingest={this.ingest} isMobile={this.isMobile} />
        <Health dict={this.ingest.data.health} />
        <Control ingest={this.ingest} />
        <Scope data={single} colors={this.state.colors} />
        <Scope2 data={double} colors={this.state.colors} showHeader={false} />
      </ThemeProvider>
    );
  }
}

export default App;
