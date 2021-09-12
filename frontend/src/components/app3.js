//
//  App3.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Split from "split.js";
import { ThemeProvider } from "@material-ui/core/styles";
import { colorDict, detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Scope } from "./scope";
import { Scope2 } from "./scope2";
import { Health } from "./health";
import { Control } from "./control";
import { Product } from "./product";
import { theme } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";
import { Ingest } from "./ingest";

class App3 extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
    };
    this.ingest = new Ingest(props.radar);
    this.ingest.onupdate = () => {
      this.forceUpdate();
    };
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
    if (!this.isMobile) {
      const w = 33;
      Split(["#left", "#right"], {
        sizes: [100 - w, w],
        minSize: [400, 500],
        expandToMin: true,
      });
    }
    // Preload something before we start to connect and draw
    fetch("/static/blob/helveticaneue/HelveticaNeueMed.ttf").then(() => {
      this.ingest.connect();
    });
  }

  render() {
    const mobileLayout = (
      <ThemeProvider theme={theme}>
        <TopBar isMobile={true} />
        <SectionHeader name="product" />
        <Product
          colors={this.state.colors}
          debug={this.props.debug}
          showStats={true}
          profileGL={this.props.profileGL}
        />
      </ThemeProvider>
    );
    if (this.isMobile) return mobileLayout;
    let single = { t: this.ingest.data.t, ...this.ingest.data.ch1 };
    return (
      <ThemeProvider theme={theme}>
        <TopBar ingest={this.ingest} />
        <div id="flex">
          <div id="left">
            <div>
              <SectionHeader name="product" isMobile={false} />
              <Product
                colors={this.state.colors}
                debug={this.props.debug}
                showStats={true}
                profileGL={this.props.profileGL}
              />
            </div>
          </div>
          <div id="right">
            <Health dict={this.ingest.data.health} />
            <Control ingest={this.ingest} />
            {/* <SectionHeader name="scope" />
            <h3>Single-Channel</h3>
            <div className="scopeSingle">
              <Scope data={single} colors={this.state.colors} />
            </div> */}
          </div>
        </div>
      </ThemeProvider>
    );
  }
}

export default App3;
