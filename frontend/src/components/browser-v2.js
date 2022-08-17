import React from "react";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

import Box from "@mui/material/Box";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];

function Calender(props) {
  const ok = props.archive.grid !== undefined;
  const day = ok ? props.archive.grid.day : new Date("2013/05/20");
  const hour = ok ? props.archive.grid.hour : -1;

  const [value, setValue] = React.useState(day);

  React.useEffect(() => setValue(day), [day]);

  return (
    <div className="calendarContainer">
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
  const ok = props.archive.grid !== undefined;
  const day = ok ? props.archive.grid.day : new Date("2013/05/20");
  const hours = ok ? props.archive.grid.hoursActive : new Array(24).fill(0);
  // React.useEffect(() => {
  //   console.log(count);
  // });
  return (
    <div className="hoursContainer">
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
  const ok = props.archive.grid !== undefined;
  const items = ok ? props.archive.grid.items : [];
  const index = ok ? props.archive.grid?.index : -1;

  React.useEffect(() => {
    if (props.archive.state.loadCount <= 1) {
      console.log(`Scroll row ${index} into view`);
    }
  }, [items, index]);

  const selectedButton = React.useRef(null);

  return (
    <div className="filesContainer">
      <div className="fileList">
        {items.map((item, k) => (
          <Button
            key={`file-${k}`}
            variant="file"
            onClick={() => {
              props.archive.load(k);
              props.onLoad(k);
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
  const ok = props.archive.grid !== undefined;
  const items = ok ? props.archive.grid.items : [];
  const index = ok ? props.archive.grid?.index : -1;

  React.useEffect(() => {
    const newFiles = ok ? props.archive.grid.items : [];
    console.log(`updating files ... len = ${newFiles.length}`);
  }, [items, index]);

  return (
    <div>
      <div id="cake" className="fullWidth container fog">
        <Calender {...props} />
        <HourList {...props} />
        <OtherList {...props} />
      </div>
      <FileList {...props} />
    </div>
  );
}

Browser.defaultProps = {
  onLoad: () => {
    console.log("Browser.onLoad()");
  },
};
