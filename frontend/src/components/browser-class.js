//
//  browser.js - Data Browser
//  RadarHub
//
//  This is a view
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

import Box from "@mui/material/Box";

import { Scroller } from "./gesture";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];

function ServerDay(props) {
  const { day, outsideCurrentMonth, ...other } = props;
  let key = day.format("YYYYMMDD");
  let num = key in props.archive.grid.daysActive ? props.archive.grid.daysActive[key] : 0;

  return num ? (
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
      <Box sx={{ pt: 1, pb: 1 }}>
        <div className="fullWidth center disabled">Hours</div>
      </Box>
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
    this.param = { ...this.param, extent: this.param.body + 2 * this.param.stem };
    this.state = {
      items: [],
      subsetItems: [],
      subsetStart: 0,
      hourlyStart: -1,
      taskPending: false,
      headPadding: -this.param.stem * props.h,
      tic: 0,
    };

    this.list = null;

    this.handleScroll = this.handleScroll.bind(this);
  }

  static defaultProps = {
    h: 32,
  };

  handleScroll(delta) {
    const h = this.props.h;
    const grid = this.props.archive.grid;
    const { body, stem, extent, fetch } = this.param;

    const maxIndex = grid.items.length - extent;

    let start = this.state.subsetStart;
    let padding = this.state.headPadding - delta;
    if (delta > 0) {
      while (padding < -stem * h && start < maxIndex) {
        padding += h;
        start += 1;
      }
      if (start == maxIndex) {
        console.log("reached the bottom");
      }
    } else if (delta < 0) {
      while (padding > (1 - stem) * h && start > 1) {
        padding -= h;
        start -= 1;
      }
      if (start == 0) {
        console.log("reached the top");
      }
    } else {
      return;
    }
    const travel = Math.abs(start - grid.index);
    if (travel > 30 && this.props.archive.state.liveUpdate != "offline") {
      console.debug("Scrolled far enough, disabling live update ...");
      this.props.archive.disableLiveUpdate();
    }
    if (padding < -2 * stem * h || padding > h) {
      padding = this.state.headPadding;
    }
    let taskPending = false;
    if (!this.state.taskPending && start != this.state.subsetStart) {
      let maxIndex = Math.max(0, grid.items.length - stem - body - fetch);
      console.log(`start = ${start} / ${fetch} / ${maxIndex}`);
      if (start < fetch && delta < 0 && grid.moreBefore) {
        taskPending = true;
        this.props.archive.prepend();
      } else if (start > maxIndex && delta > 0 && grid.moreAfter) {
        taskPending = true;
        this.props.archive.append();
      }
    }
    let hourlyStart = start;
    if (start > grid.counts[0]) {
      hourlyStart -= grid.counts[0];
    }
    let subsetItems = [];
    for (let k = start; k < Math.min(grid.items.length, start + extent); k++) {
      subsetItems.push({ index: k, label: grid.items[k] });
    }
    this.setState({
      subsetStart: start,
      headPadding: padding,
      hourlyStart: hourlyStart,
      subsetItems: subsetItems,
      taskPending: taskPending,
    });
  }

  componentDidMount() {
    // this.list = document.getElementById("listContainer");
    this.list = document.getElementById("filesContainer");
    this.scroller = new Scroller(this.list);
    this.scroller.setHandler(this.handleScroll);
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
    console.log(`%ccomponentDidUpdate%c   archive.grid.tic = ${archive.grid.tic}`, "color: dodgerblue", "");

    const grid = this.props.archive.grid;
    const { body, stem, extent } = this.param;

    let start;
    let padding = this.state.headPadding;
    if (grid.listMode == "prepend") {
      start = grid.counts[0] + this.state.hourlyStart;
    } else if (grid.listMode == "append") {
      start = this.state.hourlyStart;
    } else if (grid.listMode == "catchup") {
      start = Math.max(0, grid.index - body - stem);
      padding = -stem * this.props.h;
    } else {
      start = Math.max(0, grid.counts[0] - stem);
      padding = (start - grid.counts[0]) * this.props.h;
    }
    let hourlyStart = start;
    if (start >= grid.counts[0]) {
      hourlyStart -= grid.counts[0];
    }
    let subsetItems = [];
    for (let k = start; k < Math.min(grid.items.length, start + extent); k++) {
      subsetItems.push({ index: k, label: grid.items[k] });
    }
    let quad = `${grid.moreBefore ? "Y" : "N"},${grid.counts},${grid.moreAfter ? "Y" : "N"}`;
    console.log(
      `%ccomponentDidUpdate%c` +
        `   items.length = ${grid.items.length} [${quad}]` +
        `   start = ${start}` +
        `   hour = ${grid.hour}` +
        `   index = ${grid.index}` +
        `   subsetItems.length = ${subsetItems.length}`,
      "color: dodgerblue",
      ""
    );
    this.setState({
      subsetStart: start,
      headPadding: padding,
      hourlyStart: hourlyStart,
      subsetItems: subsetItems,
      taskPending: false,
    });
  }

  render() {
    const archive = this.props.archive;
    const ok = archive.grid !== null;
    const day = ok ? dayjs.utc(archive.grid.dateTimeString.slice(0, 8)) : dayjs.utc();
    const hour = ok ? archive.grid.hour : -1;
    const index = ok ? archive.grid.index : -1;
    const hourHasData = ok ? archive.grid.hourHasData : new Array(24).fill(false);
    return (
      <div>
        <div id="browserTop" className="fullWidth container fog blur">
          <Calendar archive={archive} day={day} />
          <Hours archive={archive} day={day} hourHasData={hourHasData} selected={hour} />
        </div>
        <div id="filesContainer" style={{ marginTop: this.state.headPadding }}>
          <div id="filesContainerHead"></div>
          {this.state.subsetItems.map((item) => (
            <Button
              key={`f-${item.label.slice(0, 15)}`}
              variant="file"
              onClick={() => archive.loadIndex(item.index)}
              selected={item.index == index}
            >
              {item.label}
            </Button>
          ))}
          <div id="filesContainerTail"></div>
        </div>
      </div>
    );
  }
}

export { Browser };
