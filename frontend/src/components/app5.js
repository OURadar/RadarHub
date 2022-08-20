//
//  app5.js - Control Interface
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Split from "split.js";
import { ThemeProvider } from "@mui/material/styles";
import { colorDict, makeTheme } from "./theme";
import { detectMob, clamp } from "./common";
import { SectionHeader } from "./section-header";
import { Scope2 } from "./scope2";
import { Health } from "./health";
import { Control } from "./control";
import { Product } from "./product";
import { TopBar } from "./topbar";
import { Ingest } from "./ingest";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
    };
    this.ingest = new Ingest(props.radar);
    this.ingest.onUpdate = () => {
      this.forceUpdate();
    };
    this.handleModeChange = this.handleModeChange.bind(this);
    document.documentElement.setAttribute("theme", this.state.colors.name);
    this.isMobile = detectMob();
    console.log(props);
  }

  static defaultProps = {
    radar: "demo",
    debug: false,
    profileGL: false,
  };

  componentDidMount() {
    // Get notified when the desktop theme is changed
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("theme", mode);
        this.setState({
          colors: colorDict(mode),
          theme: makeTheme(mode),
        });
      });
    if (!this.isMobile) {
      // const w = 40;
      var w = localStorage.getItem("split-live-w");
      if (w) {
        w = clamp(parseFloat(JSON.parse(w)), 300, window.innerWidth - 400);
      } else {
        w = 300;
      }
      let v = (w / window.innerWidth) * 100;
      Split(["#split-panel-left", "#split-panel-right"], {
        sizes: [100 - v, v],
        minSize: [400, 500],
        expandToMin: true,
        elementStyle: (_dimension, elementSize, _gutterSize, index) => {
          if (index == 0)
            return {
              width: `calc(100% - ${w}px)`,
            };
          else {
            w = (window.innerWidth * elementSize) / 100;
            return {
              width: `${w}px`,
            };
          }
        },
        onDragEnd: (_sizes) => {
          w = parseFloat(w).toFixed(1);
          localStorage.setItem("split-live-w", JSON.stringify(w));
        },
      });
    }
    this.ingest.connect();
  }

  render() {
    if (this.isMobile)
      return (
        <ThemeProvider theme={this.state.theme}>
          <TopBar isMobile={true} />
          <SectionHeader name="product" />
          <Product
            colors={this.state.colors}
            debug={this.props.debug}
            profileGL={this.props.profileGL}
          />
        </ThemeProvider>
      );
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar
          mode={this.state.colors.name}
          ingest={this.ingest}
          onModeChange={this.handleModeChange}
        />
        <div id="flex">
          <div id="left">
            <div>
              <SectionHeader name="product" isMobile={false} />
              <Product
                colors={this.state.colors}
                debug={this.props.debug}
                profileGL={this.props.profileGL}
              />
            </div>
          </div>
          <div id="right">
            <Health dict={this.ingest.data.health} />
            <Control ingest={this.ingest} />
            <Scope2 data={this.ingest.data} colors={this.state.colors} />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  handleModeChange() {
    let mode = this.state.colors.name == "light" ? "dark" : "light";
    console.log(`App5.handleModeChange() -> ${mode}`);
    document.documentElement.setAttribute("theme", mode);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
  }
}

export default App;
