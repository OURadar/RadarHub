//
//  app5.js - Control Interface
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";
import Split from "split.js";

import { ThemeProvider } from "@mui/material/styles";

import { clamp } from "./common";
import { User } from "./user";

import { SectionHeader } from "./section-header";
import { Scope2 } from "./scope2";
import { Health } from "./health";
import { Control } from "./control";
import { Product } from "./product";
import { TopBar } from "./topbar";
import { Live } from "./live";

export class App extends React.Component {
  constructor(props) {
    super(props);

    this.ingest = new Live(props.pathway);
    this.ingest.onUpdate = () => this.forceUpdate();

    this.user = new User();
    this.user.onUpdate = () => this.forceUpdate();

    this.handleOverlayLoad = this.handleOverlayLoad.bind(this);

    console.log(props);
  }

  static defaultProps = {
    pathway: "demo",
    debug: false,
    profileGL: false,
  };

  componentDidMount() {
    document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${this.props.css_hash}`);
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
    this.ingest.connect();
  }

  render() {
    return (
      <ThemeProvider theme={this.user.preference.theme}>
        <TopBar
          mode={this.user.preference.colors.name}
          ingest={this.ingest}
          onThemeChange={() => user.current.nextMode()}
        />
        <div id="split-panel">
          <div id="split-panel-left" className="container">
            <div className="fullHeight">
              <SectionHeader name="product" isMobile={false} />
              <Product
                colors={this.user.preference.colors}
                gravity="right"
                debug={this.props.debug}
                profileGL={this.props.profileGL}
                onOverlayLoad={this.handleOverlayLoad}
              />
            </div>
          </div>
          <div id="split-panel-right" className="container">
            <div className="spacerTop" />
            <Health dict={this.ingest.data.health} />
            <Control ingest={this.ingest} />
            <Scope2 data={this.ingest.data} colors={this.user.preference.colors} />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  handleOverlayLoad() {}
}
