//
//  browser.js - Data Browser
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

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

const useConstructor = (callback = () => {}) => {
  const used = React.useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

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
          slotProps={{ day: { archive: archive } }}
          disableHighlightToday={true}
        />
      </LocalizationProvider>
    </div>
  );
});

const Hours = React.memo(function Hours({ archive, hours, selected }) {
  return (
    <div>
      <div id="hoursContainer">
        {hours.map((_, k) => (
          <Button
            key={`h-${k}`}
            variant="hour"
            disabled={hours[k] == 0}
            selected={hours[k] > 0 && k == selected}
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

const Scans = React.memo(function Scans({ archive, scans, selected, top, handleWheel }) {
  return (
    <div className="fill" onWheel={handleWheel}>
      <div id="filesContainer" style={{ marginTop: top }}>
        <div id="filesContainerHead"></div>
        {scans.map((item) => (
          <Button
            key={`f-${item.label.slice(0, 15)}`}
            variant="file"
            onClick={() => {
              archive.loadIndex(item.index);
            }}
            selected={item.index == selected}
          >
            {item.label}
          </Button>
        ))}
        <div id="filesContainerTail"></div>
      </div>
    </div>
  );
});

export function Browser(props) {
  const ok = props.archive.grid !== null;
  const day = ok ? dayjs.utc(props.archive.grid.dateTimeString.slice(0, 8)) : dayjs.utc();
  const hour = ok ? props.archive.grid.hour : -1;
  const items = ok ? props.archive.grid.items : [];
  const index = ok ? props.archive.grid?.index : -1;
  const hours = ok ? props.archive.grid.hoursActive : new Array(24).fill(0);

  // const scroller = React.useRef(null);

  const stem = 5;
  const body = 15;
  const fetch = 50;
  const extent = body + 2 * stem;
  const fetchEnd = items.length - stem - body - fetch;

  const [subsetItems, setSubsetItems] = React.useState([]);
  const [subsetStart, setSubsetStart] = React.useState(0);
  const [hourlyStart, setHourlyStart] = React.useState(-1);
  const [taskPending, setTaskPending] = React.useState(false);
  const [headPadding, setHeadPadding] = React.useState(-stem * props.h);

  const updateSubset = (start) => {
    setSubsetStart(start);
    if (start >= props.archive.grid.counts[0]) {
      setHourlyStart(start - props.archive.grid.counts[0]);
    } else {
      setHourlyStart(start);
    }
    let data = [];
    for (let k = start; k < Math.min(items.length, start + extent); k++) {
      data.push({ index: k, label: items[k] });
    }
    setSubsetItems(data);
  };

  const scroll = (delta) => {
    // console.log(`Browser.scroll ${delta}`);
    let start = subsetStart;
    let padding = headPadding - delta;
    let maxIndex = items.length - extent;
    if (delta > 0) {
      while (padding < -stem * props.h && start < maxIndex) {
        padding += props.h;
        start += 1;
      }
      if (start == maxIndex) {
        console.log("reached the bottom");
      }
    } else if (delta < 0) {
      while (padding > (1 - stem) * props.h && start > 1) {
        padding -= props.h;
        start -= 1;
      }
      if (start == 0) {
        console.log("reached the top");
      }
    }
    let travel = Math.abs(start - index);
    if (travel > 30 && props.archive.state.liveUpdate != "offline") {
      // console.debug("Scrolled far enough, disabling live update ...");
      props.archive.disableLiveUpdate();
    }
    if (padding > -2 * stem * props.h && padding < props.h) {
      setHeadPadding(padding);
    }
    if (!taskPending && start != subsetStart) {
      updateSubset(start);
      if (start < fetch && props.archive.grid.moreBefore) {
        setTaskPending(true);
        props.archive.prepend();
      } else if (start > fetchEnd && props.archive.grid.moreAfter) {
        setTaskPending(true);
        props.archive.append();
      }
    }
  };

  const handleWheel = (e) => {
    scroll(e.deltaY);
  };

  // useConstructor(() => {
  //   scroller.current = new Scroller();
  //   scroller.current.handlePanY = scroll;
  // });

  React.useEffect(() => {
    if (props.archive?.grid == null) {
      return;
    }
    let start;
    if (props.archive.grid.listMode == "prepend") {
      start = props.archive.grid.counts[0] + hourlyStart;
    } else if (props.archive.grid.listMode == "append") {
      start = hourlyStart;
    } else if (props.archive.grid.listMode == "catchup") {
      start = Math.max(0, props.archive.grid.index - body - stem);
      setHeadPadding(-stem * props.h);
    } else {
      start = Math.max(0, props.archive.grid.counts[0] - stem);
      setHeadPadding((start - props.archive.grid.counts[0]) * props.h);
    }
    console.debug(
      `%cReact.useEffect%c([items])` +
        `   items.length = ${items.length} [${props.archive.grid.counts}]` +
        `   start = ${start}` +
        `   hour = ${props.archive.grid.hour}` +
        `   hourlyStart = ${hourlyStart}` +
        `   index = ${index}`,
      "color: dodgerblue",
      ""
    );
    updateSubset(start);
    setTaskPending(false);
  }, [items]);

  return (
    <div>
      <div id="browserTop" className="fullWidth container fog blur">
        <Calendar archive={props.archive} day={day} />
        <Hours archive={props.archive} day={day} hours={hours} selected={hour} />
      </div>
      <Scans archive={props.archive} scans={subsetItems} selected={index} top={headPadding} handleWheel={handleWheel} />
    </div>
  );
}

Browser.defaultProps = {
  onSelect: (archive, k) => {
    console.log(`Browser.onSelect() k = ${k}`);
    archive.disableLiveUpdate();
  },
};
