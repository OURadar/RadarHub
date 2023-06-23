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
  const tolerance = 5;
  const toleranceHeight = tolerance * props.h;
  const stride = count + 2 * tolerance;
  const maxIndex = items.length - 1;
  const minIndex = 0;

  const [offset, setOffset] = React.useState(0);
  const [subsetItems, setSubsetItems] = React.useState([]);
  const [headPadding, setHeadPadding] = React.useState(0);
  const [tailPadding, setTailPadding] = React.useState(maxIndex * props.h);

  const update = ({ target: { scrollTop } }) => {
    let o = minIndex + Math.floor((scrollTop - toleranceHeight) / props.h);
    if (o == offset) {
      return;
    }
    setOffset(o);
    const head = Math.max(minIndex, offset);
    const tail = Math.min(maxIndex, offset + stride - 1);
    const data = [];
    for (let i = head; i <= tail; i++) {
      data.push({ index: i, label: items[i] });
    }
    setSubsetItems(data);

    console.log(`udpate [${offset}..${offset + stride - 1}] -> [${head}..${tail}] out of ${items.length}`);

    let p = Math.max((offset - minIndex) * props.h, 0);
    setHeadPadding(p);
    setTailPadding(Math.max((maxIndex - minIndex + 1) * props.h - data.length * props.h - p, 0));
  };

  React.useEffect(() => {
    if (fileListRef.current == null || fileListRef.current?.children?.length == 0) {
      return;
    }
    if (props.archive.state.loadCount <= 1 && index != -1) {
      // fileListRef.current.children[index].scrollIntoViewIfNeeded();
      let o = minIndex + fileListRef.current.children.length;
      console.log("fileListRef", fileListRef.current, o);
      update({ target: { scrollTop: o * props.h } });
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
        {subsetItems.map((item) => (
          <Button
            key={`file-${item.index}`}
            variant="file"
            onClick={() => {
              props.archive.loadIndex(item.index);
              props.onSelect(item.index);
            }}
            selected={item.index == index}
          >
            {item.label}
          </Button>
        ))}
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
  onSelect: (k) => {
    console.log(`Browser.onSelect() k = ${k}`);
  },
};
