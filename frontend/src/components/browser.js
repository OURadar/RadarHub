import React from "react";

import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

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

function Browser(props) {
  const ok = props.archive.grid !== undefined;
  const day = ok ? props.archive.grid.day : new Date("2013/05/20");
  const hour = ok ? props.archive.grid.hour : -1;
  const count = ok ? props.archive.grid.hoursActive : new Array(24).fill(0);
  const items = ok ? props.archive.grid.items : [];
  const index = ok ? props.archive.grid?.index : -1;
  const radar = props.radar;

  const [hourButtons, setHourButtons] = React.useState([]);
  const [fileBrowser, setFileBrowser] = React.useState([]);
  const [value, setValue] = React.useState(day);

  // console.log(`hour = ${hour}`);
  const setElements = (elements) => {
    if (
      elements == null ||
      elements.children == null ||
      elements.children.length == 0 ||
      index < 0
    ) {
      return;
    }
    // Expect loadCount <= 1 during live update
    // console.log(`loadCount = ${props.archive.state.loadCount}`);
    if (props.archive.state.loadCount == 1) {
      // console.log(`Scroll row ${index} into view`);
      elements.children[index].scrollIntoView();
    } else if (props.archive.grid.latestHour) {
      props.archive.disableLiveUpdate();
    }
  };

  React.useEffect(() => {
    const newFileBrowser = (
      <div className="filesContainer" ref={setElements}>
        {createFileButtons(items, index, props.archive.load)}
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
        <Button
          key={k}
          variant="hour"
          disabled={disabled}
          selected={selected}
          onClick={() => setDayHour(day, k)}
        >
          {hourString}
        </Button>
      );
    }
    setHourButtons(newButtons);
    setValue(day);
  }, [day, hour, count]);

  // View did mount
  React.useEffect(() => {
    props.archive.catchup();
  }, []);

  const setDayHour = (newDay, newHour) => {
    let symbol = props.archive.grid.symbol;
    let t = day instanceof Date ? "Date" : "Not Date";
    let n = newDay.toISOString().slice(0, 10);
    let o = day.toISOString().slice(0, 10);
    console.log(
      `%cbrowser.setDayHour()%c   day = %c${n}%c ← ${o} (${t})   hour = %c${newHour}%c ← ${hour}    ${symbol}`,
      "color: deeppink",
      "color: inherit",
      "color: mediumpurple",
      "color: inherit",
      "color: mediumpurple",
      "color: inherit"
    );
    props.archive.count(radar, newDay, newHour, symbol);
  };

  const getMonthTable = (newMonth) => {
    let tmp = newMonth.toISOString();
    let yyyymm = tmp.slice(0, 4) + tmp.slice(5, 7);
    props.archive.month(radar, yyyymm);
  };

  return (
    <div className="fill">
      <SectionHeader name="archive" />
      <div className="calendarContainer">
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Date"
            value={value}
            onOpen={() => getMonthTable(day)}
            onYearChange={(newDay) => getMonthTable(newDay)}
            onMonthChange={(newDay) => getMonthTable(newDay)}
            onChange={(newValue) => {
              setValue(newValue);
              if (newValue instanceof Date) {
                setDayHour(newValue, hour);
              }
            }}
            renderInput={(params) => <TextField {...params} />}
            renderDay={(day, _selectedDay, pickersDayProps) => {
              let key = day.toISOString().slice(0, 10);
              let num =
                key in props.archive.grid.daysActive
                  ? props.archive.grid.daysActive[key]
                  : 0;
              return num ? (
                <Badge
                  key={key}
                  color={badgeColors[num]}
                  overlap="circular"
                  variant="dot"
                >
                  <PickersDay {...pickersDayProps} />
                </Badge>
              ) : (
                <PickersDay {...pickersDayProps} disabled={true} />
              );
            }}
            shouldDisableYear={(date) => {
              let y = date.getYear();
              return (
                y < 0 || y >= 200 || props.archive.grid.yearsActive[y] == 0
              );
            }}
            disableHighlightToday={true}
          />
        </LocalizationProvider>
      </div>
      <div className="hoursContainer">{hourButtons}</div>
      <SectionHeader name="files" />
      {fileBrowser}
    </div>
  );
}

export { Browser };
