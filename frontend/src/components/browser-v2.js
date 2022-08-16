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

  const [value, setValue] = React.useState();

  const getMonthTable = (newMonth) => {
    let tmp = newMonth.toISOString();
    let yyyymm = tmp.slice(0, 4) + tmp.slice(5, 7);
    props.archive.month(yyyymm);
  };

  const setDayHour = (newDay, newHour) => {
    if (
      isNaN(newDay) ||
      newDay.getFullYear() < 2000 ||
      newDay.getFullYear() > 2023
    ) {
      return;
    }
    let symbol = props.archive.grid.symbol;
    let t = day instanceof Date ? "Date" : "Not Date";
    let n = newDay.toISOString().slice(0, 10);
    let o = day.toISOString().slice(0, 10);
    console.log(
      `%cbrowser.setDayHour()%c   day = %c${n}%c ← ${o} (${t})   hour = %c${newHour}%c ← ${hour}    ${symbol}`,
      "color: deeppink",
      "",
      "color: mediumpurple",
      "",
      "color: mediumpurple",
      ""
    );
    props.archive.count(newDay, newHour, symbol);
  };

  return (
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
  const count = ok ? props.archive.grid.hoursActive : new Array(24).fill(0);
  // React.useEffect(() => {
  //   console.log(count);
  // });
  return (
    <div className="hoursContainer">
      {count.map((x, k) => (
        <Button key={`h${k}`} variant="hour" disabled={count[k] == 0}>
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
  return <div></div>;
}

export function Browser(props) {
  const ok = props.archive.grid !== undefined;
  const items = ok ? props.archive.grid.items : [];
  const index = ok ? props.archive.grid?.index : -1;

  const [files, setFiles] = React.useState([]);
  const [hours, setHours] = React.useState([]);

  React.useEffect(() => {
    const newFiles = ok ? props.archive.grid.items : [];
    console.log(`updating files ... len = ${newFiles.length}`);
    setFiles(newFiles);
  }, [items, index]);

  return (
    <div className="fullHeight fullWidth paper container">
      <Calender {...props} />
      <HourList {...props} />
    </div>
    // <div className="fullHeight fullWidth paper scrollable container">
    //   <Box sx={{ pt: 6, pb: 10 }}>
    //     <List>
    //       {files.map((value, index) => (
    //         <ListItem key={index}>
    //           <ListItemText primary={value} secondary={index} />
    //         </ListItem>
    //       ))}
    //     </List>
    //   </Box>
    // </div>
  );
}
