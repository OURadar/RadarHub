import React from "react";

import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { SectionHeader } from "./section-header";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];

const createFileButtons = (list, index, load) => {
  if (list.length == 0) return [];
  const fileButtons = Array(list.length);
  for (let k = 0, l = list.length; k < l; k++) {
    const file = list[k];
    fileButtons[k] = (
      <Button
        key={k}
        variant="file"
        onClick={() => load(k)}
        style={{ height: 36, overflow: "hidden", textOverflow: "ellipsis" }}
        selected={k == index}
      >
        {file}
      </Button>
    );
  }
  return fileButtons;
};

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

function Browser(props) {
  const archive = props.archive;

  const ok = archive.grid !== null;
  const day = ok ? dayjs.utc(archive.grid.dateTimeString.slice(0, 8)) : dayjs.utc();
  const hour = ok ? archive.grid.hour : -1;
  const count = ok ? archive.grid.hoursActive : new Array(24).fill(0);
  const items = ok ? archive.grid.items : [];
  const index = ok ? archive.grid?.index : -1;

  const [hourButtons, setHourButtons] = React.useState([]);
  const [fileBrowser, setFileBrowser] = React.useState([]);
  const [value, setValue] = React.useState(day);

  // console.log(`day = ${day}   hour = ${hour}`);
  const setElements = (elements) => {
    if (elements == null || elements.children == null || elements.children.length == 0 || index < 0) {
      return;
    }
    // Expect loadCount == 1 during live update
    // console.log(`loadCount = ${props.archive.state.loadCount}`);
    // let visible = elements.children[index];
    // let child = elements.children[index];
    // let style = window.getComputedStyle(elements.children[index]);
    // console.log(child.offsetHeight, child.getClientRects().length);
    // console.log(`index = ${index}`);
    if (archive.state.loadCount <= 1) {
      // console.log(`Scroll ${index} / ${elements.children.length}`);
      // console.log(elements.children[index]);
      elements.children[index]?.scrollIntoViewIfNeeded();
    }
  };

  React.useEffect(() => {
    const newFileBrowser = (
      <div id="filesContainer" ref={setElements}>
        {createFileButtons(items, index, archive.loadIndex)}
      </div>
    );
    setFileBrowser(newFileBrowser);
  }, [items, index]);

  React.useEffect(() => {
    const newButtons = Array(24);
    for (let k = 0; k < 24; k++) {
      const hourString = k.toString().padStart(2, "0") + ":00";
      const selected = count[k] > 0 && k == hour;
      const disabled = count[k] == 0;
      newButtons[k] = (
        <Button key={k} variant="hour" disabled={disabled} selected={selected} onClick={() => setDayHour(day, k)}>
          {hourString}
        </Button>
      );
    }
    setHourButtons(newButtons);
    setValue(day);
  }, [day, hour, count]);

  const setDayHour = (newDay, newHour) => {
    if (isNaN(newDay) || newDay.year() < 2000 || newDay.year() > 2100) {
      return;
    }
    let symbol = props.archive.grid.symbol;
    let t = day instanceof dayjs ? "DayJS" : "Not DayJS";
    let n = newDay.format("YYYYMMDD");
    let o = day.format("YYYYMMDD");
    console.info(
      `%cbrowser.setDayHour()%c   day = %c${n}%c ← ${o} (${t})   hour = %c${newHour}%c ← ${hour}    ${symbol}`,
      "color: lightseagreen",
      "",
      "color: mediumpurple",
      "",
      "color: mediumpurple",
      ""
    );
    archive.list(newDay, newHour, symbol);
  };

  return (
    <div className="fill paper">
      <div className="spacerTop" />
      <SectionHeader name="archive" />
      <div id="calendarContainer">
        <LocalizationProvider dateAdapter={AdapterDayjs} dateLibInstance={dayjs.utc}>
          <DatePicker
            defaultValue={value}
            minDate={dayjs.utc("20000101")}
            maxDate={dayjs.utc().endOf("month")}
            onOpen={() => archive.getMonthTable(day)}
            onYearChange={(newDay) => archive.getMonthTable(newDay)}
            onMonthChange={(newDay) => archive.getMonthTable(newDay)}
            onChange={(newValue) => {
              setValue(newValue);
              setDayHour(newValue, hour);
            }}
            slots={{ day: ServerDay }}
            slotProps={{ day: { archive: archive } }}
            disableHighlightToday={true}
          />
        </LocalizationProvider>
      </div>
      <div id="hoursContainer">{hourButtons}</div>
      <SectionHeader name="scans" />
      {fileBrowser}
    </div>
  );
}

export { Browser };
