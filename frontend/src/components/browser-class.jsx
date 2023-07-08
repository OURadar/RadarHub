//
//  browser.js - Data Browser
//  RadarHub
//
//  This is a view
//
//  Implemented as a class component as Javascript closure limits the lexical
//  environment that is accessible by the other class embeded in this view, i.e.,
//  the Scroller class for handling the pan gesture.
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";

import { Scroller } from "./scroller";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];

function ServerDay(props) {
  const { day, outsideCurrentMonth, ...other } = props;
  let key = day.format("YYYYMMDD");
  let num = key in props.archive.grid.daysActive ? props.archive.grid.daysActive[key] : 0;

  return num && !outsideCurrentMonth ? (
    <Badge key={key} color={badgeColors[num]} overlap="circular" variant="dot">
      <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />
    </Badge>
  ) : (
    <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} disabled={true} />
  );
}

const Calendar = React.memo(function Calendar({ archive, day }) {
  return (
    <div id="calendarContainer">
      <LocalizationProvider dateAdapter={AdapterDayjs} dateLibInstance={dayjs.utc}>
        <DatePicker
          label="Date"
          value={day}
          minDate={dayjs.utc("20000101")}
          maxDate={dayjs.utc().endOf("month")}
          onOpen={() => archive.getMonthTable(day)}
          onChange={(newDay) => archive.setDayHour(newDay, null)}
          onYearChange={(newDay) => archive.getMonthTable(newDay)}
          onMonthChange={(newDay) => archive.getMonthTable(newDay)}
          slots={{ day: ServerDay }}
          slotProps={{ day: { archive } }}
          disableHighlightToday={true}
        />
      </LocalizationProvider>
    </div>
  );
});

const Hours = React.memo(function Hours({ archive, hourHasData, selected }) {
  return (
    <div>
      <div id="hoursContainer">
        {hourHasData.map((hasData, k) => (
          <Button
            key={`h-${k}`}
            variant="hour"
            disabled={!hasData}
            selected={hasData && k == selected}
            onClick={() => archive.setDayHour(null, k)}
          >
            {k.toString().padStart(2, "0")}
          </Button>
        ))}
      </div>
      <div className="sectionBar fullWidth center disabled">Hours</div>
    </div>
  );
});

class Browser extends Component {
  constructor(props) {
    super(props);
    this.param = {
      stem: 5,
      body: 15,
      fetch: 72,
    };
    this.value = {
      subsetStart: 0,
      subsetDepth: 0,
      hourlyStart: 0,
      headPadding: 0,
      taskPending: false,
    };
    this.state = {
      subsetItems: [],
      headPadding: 0,
      tic: 0,
    };

    this.listRef = null;

    this.handleQuery = this.handleQuery.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
  }

  static defaultProps = {
    h: 32,
    onSelect: (k) => console.log(`Browser.onSelect() k = ${k}`),
  };

  handleQuery(delta) {
    const { body, header, heightMinusFooter, marginMinusHeader } = this.param;
    const bound = this.props.archive.grid.items.length - body - 2;
    // console.log(`handleQuery ${delta.toFixed(1)} ${this.value.subsetStart} ${bound}`);
    if (this.value.subsetStart == 0 && delta > 0) {
      return this.value.headPadding - marginMinusHeader;
    } else if (this.value.subsetStart >= bound && delta < 0) {
      let target = heightMinusFooter + 2;
      let offset = this.value.headPadding + header + this.value.subsetDepth * this.props.h;
      return offset - target;
    } else {
      return 0;
    }
  }

  handleScroll(delta) {
    const h = this.props.h;
    const grid = this.props.archive.grid;
    const { body, stem, bodyPlusStems, heightMinusFooter, marginMinusHeader, fetch, header } = this.param;

    let start = this.value.subsetStart;
    let padding = this.value.headPadding + delta;
    // console.log(`handleScroll  ${padding}`);
    if (delta < 0) {
      while (padding < marginMinusHeader - stem * h) {
        padding += h;
        start++;
      }
      if (padding + header + this.value.subsetDepth * this.props.h <= heightMinusFooter) {
        this.scroller.addStretch();
      } else {
        this.scroller.resetStretch();
      }
    } else if (delta > 0) {
      while (padding > marginMinusHeader + (1 - stem) * h && start > 0) {
        padding -= h;
        start--;
      }
      if (start <= 0 && padding > marginMinusHeader) {
        this.scroller.addStretch();
      } else if (start > 0) {
        this.scroller.resetStretch();
      }
    } else {
      return;
    }
    const travel = Math.abs(start - grid.index);
    if (travel > 30 && this.props.archive.state.liveUpdate != "offline") {
      console.debug("Scrolled far enough, disabling live update ...");
      this.props.archive.disableLiveUpdate();
    }
    if (!this.value.taskPending && start != this.value.subsetStart) {
      let maxIndex = Math.max(0, grid.items.length - stem - body - fetch);
      // let quad = `${grid.moreBefore ? "Y" : "N"},${grid.counts},${grid.moreAfter ? "Y" : "N"}`;
      // console.log(`start = ${start} / ${grid.items.length} [${quad}] [${fetch},${maxIndex}]`);
      if (start < fetch && delta > 0 && grid.moreBefore) {
        this.value.taskPending = true;
        this.props.archive.prepend();
      } else if (start > maxIndex && delta < 0 && grid.moreAfter) {
        this.value.taskPending = true;
        this.props.archive.append();
      }
    }
    if (this.value.subsetStart != start) {
      let hourlyStart = start;
      if (start > grid.counts[0]) {
        hourlyStart -= grid.counts[0];
      }
      let items = [];
      for (let k = Math.max(0, start); k < Math.min(grid.items.length, start + bodyPlusStems); k++) {
        items.push({ index: k, label: grid.items[k] });
      }
      this.value.subsetStart = start;
      this.value.subsetDepth = items.length;
      this.value.hourlyStart = hourlyStart;
      this.setState({ subsetItems: items });
    }
    this.value.headPadding = padding;
    this.setState({ headPadding: padding });
  }

  componentDidMount() {
    this.listRef = document.getElementById("filesViewport");
    this.scroller = new Scroller(this.listRef);
    this.scroller.setHandler(this.handleScroll);
    this.scroller.setReporter(this.handleQuery);

    this.param.height = document.body.clientHeight;
    this.param.margin = document.getElementById("browserTop").clientHeight;
    this.param.header = document.getElementById("filesViewportHeader").clientHeight;
    this.param.footer = document.getElementById("filesViewportFooter").clientHeight;

    let height = this.param.height - this.param.margin;

    this.param.body = Math.floor(height / this.props.h);
    this.param.bodyPlusStems = this.param.body + 2 * this.param.stem;
    this.param.marginMinusHeader = this.param.margin - this.param.header;
    this.param.heightMinusFooter = this.param.height - this.param.footer;
    // console.log("Revised params", this.param);

    this.value.headPadding = this.param.marginMinusHeader - this.param.stem * this.props.h;
  }

  componentDidUpdate() {
    const archive = this.props.archive;
    if (archive.grid == null || archive.grid.items.length == 0) {
      return;
    }
    if (archive.grid.tic == this.state.tic) {
      return;
    }
    this.setState({ tic: archive.grid.tic });

    const grid = this.props.archive.grid;
    const { body, stem, bodyPlusStems, marginMinusHeader, heightMinusFooter } = this.param;

    let start;
    let padding = this.value.headPadding;

    if (grid.mode == "prepend") {
      start = grid.counts[0] + this.value.hourlyStart;
    } else if (grid.mode == "append") {
      start = this.value.hourlyStart;
    } else if (grid.mode == "catchup") {
      start = Math.max(0, grid.items.length - 1 - body);
      padding = heightMinusFooter - (bodyPlusStems - 1) * this.props.h + marginMinusHeader + 2;
    } else if (grid.mode == "select") {
      start = Math.max(0, grid.counts[0] - stem);
      padding = marginMinusHeader + (start - grid.counts[0]) * this.props.h;
    } else if (grid.mode == "navigate") {
      let delta = 0;
      start = this.value.subsetStart;
      if (start > grid.index - stem - 1) {
        start = grid.index - stem - 1;
        delta = (start - this.value.subsetStart + 1) * this.props.h;
      } else if (start < grid.index - body - stem + 1) {
        start = grid.index - body - stem + 1;
        delta = (start - this.value.subsetStart + 1) * this.props.h;
      }
      if (grid.items.length - grid.index > 24 && this.props.archive.state.liveUpdate != "offline") {
        console.debug("Navigated far enough, disabling live update ...");
        this.props.archive.disableLiveUpdate();
      }
      let iter = 0;
      let interval = setInterval(() => {
        if (iter++ > 4) {
          clearInterval(interval);
        }
        this.handleScroll(-0.25 * delta);
      }, 17);
      return;
    } else {
      start = this.value.subsetStart;
    }
    let hourlyStart = start;
    if (start >= grid.counts[0]) {
      hourlyStart -= grid.counts[0];
    }
    let subsetItems = [];
    for (let k = start; k < Math.min(grid.items.length, start + bodyPlusStems); k++) {
      subsetItems.push({ index: k, label: grid.items[k] });
    }
    let quad = `${grid.moreBefore ? "Y" : "N"},${grid.counts},${grid.moreAfter ? "Y" : "N"}`;
    console.log(
      `%ccomponentDidUpdate%c` +
        `   ${grid.mode}` +
        `   tic = ${archive.grid.tic}` +
        `   [${quad}]` +
        `   @ ${start}-${grid.index}-${grid.items.length} (${subsetItems.length})`,
      "color: dodgerblue",
      ""
    );
    this.value.subsetStart = start;
    this.value.subsetDepth = subsetItems.length;
    this.value.hourlyStart = hourlyStart;
    this.value.headPadding = padding;
    this.value.taskPending = false;
    this.setState({ subsetItems: subsetItems, headPadding: padding });
  }

  render() {
    const archive = this.props.archive;
    const ok = archive.grid !== null;
    const day = ok ? dayjs.utc(archive.grid.dateTimeString.slice(0, 8)) : dayjs.utc();
    const hour = ok ? archive.grid.hour : -1;
    const index = ok ? archive.grid.index : -1;
    const hourHasData = ok ? archive.grid.hourHasData : new Array(24).fill(false);
    return (
      <div className="fullHeight">
        <div id="browserTop" className="fullWidth container fog blur">
          <Calendar archive={archive} day={day} />
          <Hours archive={archive} day={day} hourHasData={hourHasData} selected={hour} />
        </div>
        <div id="filesViewport" style={{ marginTop: this.state.headPadding }}>
          <div id="filesViewportHeader"></div>
          {this.state.subsetItems.map((item) => (
            <Button
              key={`f-${item.label.slice(0, 20)}`}
              variant="file"
              onClick={() => {
                archive.loadIndex(item.index);
                this.props.onSelect(item.index);
              }}
              selected={item.index == index}
            >
              {item.label}
            </Button>
          ))}
          <div id="filesViewportFooter"></div>
          <div className="filesViewportSpacer"></div>
        </div>
      </div>
    );
  }
}

export { Browser };
