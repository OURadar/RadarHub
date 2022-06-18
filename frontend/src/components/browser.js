import React, { memo } from "react";
import memoize from "memoize-one";
import { FixedSizeList, areEqual } from "react-window";

import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

import { SectionHeader } from "./section-header";
// import { getMonth } from "date-fns";

const badgeColors = ["warning", "gray", "clear", "rain", "heavy"];
const Item = memo(({ data, index, style }) => {
  const { list, selectedIndex, loadItem } = data;
  const selected = index == selectedIndex;
  const item = list[index];

  return (
    <Button
      key={index}
      onClick={() => loadItem(item, index)}
      style={{ ...style, overflow: "hidden", textOverflow: "ellipsis" }}
      selected={selected}
    >
      {item}
    </Button>
  );
}, areEqual);

const createFileList = memoize((list, index, load) => ({
  list: list,
  loadItem: load,
  selectedIndex: index,
}));

const createFileButtons = (list, index, load) => {
  const fileButtons = Array(list.length);
  for (let k = 0, l = list.length; k < l; k++) {
    const selected = k == index;
    const file = list[k];
    fileButtons[k] = (
      <Button
        key={k}
        variant="file"
        onClick={() => load(k)}
        style={{ height: 36, overflow: "hidden", textOverflow: "ellipsis" }}
        selected={selected}
      >
        {file}
      </Button>
    );
  }
  return fileButtons;
};

function Browser(props) {
  const count = props.archive.grid.hourlyAvailability;
  const files = props.archive.grid.fileList;
  const day = props.archive.grid.day;
  const hour = props.archive.grid.hour;
  const index = props.archive.grid.index;

  const radar = props.radar;

  const [hourButtons, setHourButtons] = React.useState([]);
  const [fileBrowser, setFileBrowser] = React.useState([]);

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
    const newFileBrowser = props.useMemo ? (
      <Box
        sx={{
          width: "100%",
          height: 600,
          backgroundColor: "var(--system-background)",
        }}
      >
        <FixedSizeList
          height={600}
          itemSize={32}
          itemCount={files.length}
          itemData={createFileList(files, index, props.archive.load)}
          overscanCount={5}
        >
          {Item}
        </FixedSizeList>
      </Box>
    ) : (
      <div className="filesContainer" ref={setElements}>
        {createFileButtons(files, index, props.archive.load)}
      </div>
    );
    setFileBrowser(newFileBrowser);
  }, [files, index]);

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
          onClick={() => {
            setDayHour(day, k);
          }}
        >
          {hourString}
        </Button>
      );
    }
    setHourButtons(newButtons);
  }, [day, hour, count]);

  // View did mount
  React.useEffect(() => {
    props.archive.catchup(radar);
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
    if (parseInt(n.slice(0, 4)) < 2000) {
      return;
    }
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
            value={day}
            onYearChange={(newDay) => {
              getMonthTable(newDay);
            }}
            onMonthChange={(newDay) => {
              if (day != newDay) {
                getMonthTable(newDay);
              }
            }}
            onChange={(newDay) => {
              if (newDay === null || newDay == "Invalid Date") {
                return;
              }
              // console.log(`DatePicker ${newDay.toISOString()}`);
              setDayHour(newDay, hour);
            }}
            onOpen={() => {
              getMonthTable(day);
            }}
            renderInput={(params) => <TextField {...params} />}
            renderDay={(day, _selectedDay, pickersDayProps) => {
              let key = day.toISOString().slice(0, 10);
              let num =
                key in props.archive.grid.dailyAvailability
                  ? props.archive.grid.dailyAvailability[key]
                  : 0;
              let variant = num ? "dot" : undefined;
              return (
                <Badge
                  key={key}
                  color={badgeColors[num]}
                  overlap="circular"
                  variant={variant}
                >
                  <PickersDay {...pickersDayProps} />
                </Badge>
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
