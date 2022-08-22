import React from "react";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

import Box from "@mui/material/Box";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];

function Calender(props) {
  const ok = props.archive.grid !== null;
  const day = ok ? props.archive.grid.day : new Date("2013/05/20");
  const hour = ok ? props.archive.grid.hour : -1;

  const [value, setValue] = React.useState(day);

  React.useEffect(() => setValue(day), [day]);

  return (
    <div id="calendarContainer">
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Date"
          value={value}
          onOpen={() => props.archive.getMonthTable(day)}
          onYearChange={(newDay) => props.archive.getMonthTable(newDay)}
          onMonthChange={(newDay) => props.archive.getMonthTable(newDay)}
          onChange={(newDay) => {
            setValue(newDay);
            if (newDay instanceof Date) {
              props.archive.setDayHour(newDay, hour);
            }
          }}
          renderInput={(params) => <TextField {...params} />}
          renderDay={(day, _selected, pickersDayProps) => {
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
            return y < 0 || y >= 200 || props.archive.grid.yearsActive[y] == 0;
          }}
          disableHighlightToday={true}
        />
      </LocalizationProvider>
    </div>
  );
}

function HourList(props) {
  const ok = props.archive.grid !== null;
  const day = ok ? props.archive.grid.day : new Date("2013/05/20");
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
  const ok = props.archive.grid !== null;
  const items = ok ? props.archive.grid.items : [];
  const index = ok ? props.archive.grid?.index : -1;

  const fileListRef = React.useRef(null);

  React.useEffect(() => {
    if (
      fileListRef.current == null ||
      fileListRef.current.children.length == 0
    ) {
      return;
    }
    if (props.archive.state.loadCount <= 1 && index != -1) {
      fileListRef.current.children[index].scrollIntoViewIfNeeded();
    } else if (props.archive.grid.latestHour > -1) {
      props.archive.disableLiveUpdate();
    }
  }, [items, index]);

  return (
    <div id="filesContainer">
      <div id="fileList" ref={fileListRef}>
        {items.map((item, k) => (
          <Button
            key={`file-${k}`}
            variant="file"
            onClick={() => {
              props.archive.load(k);
              props.onSelect(k);
            }}
            selected={k == index}
          >
            {item}
          </Button>
        ))}
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