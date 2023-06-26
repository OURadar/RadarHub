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

function Calender(props) {
  const ok = props.archive.grid !== null;
  const day = ok ? dayjs.utc(props.archive.grid.dateTimeString.slice(0, 8)) : dayjs.utc();
  const hour = ok ? props.archive.grid.hour : -1;

  return (
    <div id="calendarContainer">
      <LocalizationProvider dateAdapter={AdapterDayjs} dateLibInstance={dayjs.utc}>
        <DatePicker
          label="Date"
          defaultValue={day}
          minDate={dayjs.utc("20000101")}
          maxDate={dayjs.utc().endOf("month")}
          onOpen={() => props.archive.getMonthTable(day)}
          onChange={(newDay) => props.archive.setDayHour(newDay, hour)}
          onYearChange={(newDay) => props.archive.getMonthTable(newDay)}
          onMonthChange={(newDay) => props.archive.getMonthTable(newDay)}
          slots={{ day: ServerDay }}
          slotProps={{ day: { archive: props.archive } }}
          disableHighlightToday={true}
        />
      </LocalizationProvider>
    </div>
  );
}

function HourList(props) {
  const ok = props.archive.grid !== null;
  const day = ok ? dayjs.utc(props.archive.grid.dateTimeString.slice(0, 8)) : dayjs.utc();
  const hours = ok ? props.archive.grid.hoursActive : new Array(24).fill(0);
  const hour = ok ? props.archive.grid.hour : -1;
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    forceUpdate();
  }, [hour]);

  return (
    <div id="hoursContainer">
      {hours.map((_, k) => (
        <Button
          key={`hour-${k}`}
          variant="hour"
          disabled={hours[k] == 0}
          selected={hours[k] > 0 && k == hour}
          onClick={() => props.archive.setDayHour(day, k)}
        >
          {k.toString().padStart(2, "0")}
        </Button>
      ))}
    </div>
  );
}

function FileList(props) {
  const items = props.archive.grid?.items || [];
  const index = props.archive.grid?.index || -1;

  const fileListRef = React.useRef(null);

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
    for (let k = start; k < start + extent; k++) {
      data.push({ index: k, label: items[k] });
    }
    setSubsetItems(data);
  };

  const update = (e) => {
    e.preventDefault();
    let start = subsetStart;
    let padding = headPadding - e.deltaY;
    if (e.deltaY > 0) {
      while (padding < -stem * props.h && start < items.length - extent) {
        padding += props.h;
        start += 1;
      }
    } else if (e.deltaY < 0) {
      while (padding > (1 - stem) * props.h && start > 1) {
        padding -= props.h;
        start -= 1;
      }
    }
    if (padding > -stem * props.h && padding < stem * props.h) {
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

  React.useEffect(() => {
    if (props.archive?.grid == null || fileListRef.current == null || fileListRef.current?.children?.length == 0) {
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
      setHeadPadding(-stem * props.h);
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
    <div className="fill" onWheel={update}>
      <div id="filesContainer" ref={fileListRef} style={{ marginTop: headPadding }}>
        <div id="filesContainerHead"></div>
        {subsetItems.map((item) => (
          <Button
            key={`file-${item.index}`}
            variant="file"
            onClick={() => {
              props.archive.loadIndex(item.index);
              props.onSelect(props.archive, item.index);
            }}
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

function OtherList(props) {
  return (
    <Box sx={{ pt: 1, pb: 1 }}>
      <div className="fullWidth center disabled">Hours</div>
    </Box>
  );
}

export function Browser(props) {
  return (
    <div>
      <div id="browserTop" className="fullWidth container fog blur">
        <Calender {...props} />
        <HourList {...props} />
        <OtherList {...props} />
      </div>
      <FileList {...props} />
    </div>
  );
}

Browser.defaultProps = {
  onSelect: (archive, k) => {
    console.log(`Browser.onSelect() k = ${k}`);
    archive.disableLiveUpdate();
  },
};
