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

// import Scroller from "./scroller";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];

function ServerDay(props) {
  const { day, outsideCurrentMonth, ...other } = props;
  let key = day.format("YYYYMMDD");
  let num = key in props.archive.grid.daysActive && !outsideCurrentMonth ? props.archive.grid.daysActive[key] : 0;

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

  const [value, setValue] = React.useState(day);

  return (
    <div id="calendarContainer">
      <LocalizationProvider dateAdapter={AdapterDayjs} dateLibInstance={dayjs.utc}>
        <DatePicker
          label="Date"
          defaultValue={value}
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
  return (
    <div id="hoursContainer">
      {hours.map((_, k) => (
        <Button
          key={`hour-${k}`}
          variant="hour"
          disabled={hours[k] == 0}
          selected={hours[k] > 0 && k == props.archive.grid.hour}
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

  const count = 30;
  const minIndex = 0;
  const maxIndex = 100;
  const tolerance = 5;
  const toleranceHeight = tolerance * props.h;

  const [headPadding, setHeadPadding] = React.useState(0);
  const [tailPadding, setTailPadding] = React.useState(maxIndex * props.h);
  const [subsetItems, setSubsetItems] = React.useState([]);

  const update = ({ target: { scrollTop } }) => {
    const offset = minIndex + Math.floor((scrollTop - toleranceHeight) / props.h);
    const stride = count + 2 * tolerance;
    const head = Math.max(minIndex, offset);
    const tail = Math.min(maxIndex, offset + stride - 1);
    const data = [];
    for (let i = head; i <= tail; i++) {
      data.push({ index: i, text: `item ${i}` });
    }
    setSubsetItems(data);

    console.log(`udpate [${offset}..${offset + stride - 1}] -> [${head}..${tail}] out of ${items.length}`);

    setHeadPadding(Math.max((offset - minIndex) * props.h, 0));
    setTailPadding(Math.max((maxIndex - minIndex + 1) * props.h - data.length * props.h, 0));
  };

  const row = (item) => (
    <Button
      key={`file-${item.index}`}
      variant="file"
      onClick={() => {
        props.archive.loadIndex(item.index);
        props.archive.onSelect(item.index);
      }}
      selected={item.index == index}
    >
      {item.text}
    </Button>
  );

  React.useEffect(() => {
    update({ target: { scrollTop: 0 } });
  }, []);

  React.useEffect(() => {
    if (fileListRef.current == null || fileListRef.current?.children?.length == 0) {
      return;
    }
    if (props.archive.state.loadCount <= 1 && index != -1) {
      //fileListRef.current.children[index].scrollIntoViewIfNeeded();
      console.log("fileListRef", fileListRef.current);
    } else if (props.archive.grid?.latestHour > -1) {
      props.archive.disableLiveUpdate();
    }
  }, [items, index]);

  const loadFunc = () => {
    console.log("loading more ...");
  };

  return (
    <div id="filesContainer" onScroll={update}>
      <div id="fileList" ref={fileListRef}>
        <div style={{ height: headPadding }}></div>
        {subsetItems.map(row)}
        <div style={{ height: tailPadding }}></div>
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
  onSelect: () => {
    console.log("Browser.onSelect()");
  },
};
