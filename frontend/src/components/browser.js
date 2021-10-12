import React, { memo } from "react";
import memoize from "memoize-one";
import { FixedSizeList, areEqual } from "react-window";

import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DatePicker from "@mui/lab/DatePicker";
import PickersDay from "@mui/lab/PickersDay";

import { SectionHeader } from "./section-header";

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
        onClick={() => load(file, k)}
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
  const date = props.archive?.data.date || new Date("2013-05-20T12:00");
  const count = props.archive?.data.count || new Array(24).fill(0);
  const files = props.archive?.data.files || [];
  const index = props.archive?.data.index || -1;

  const [day, setDay] = React.useState(date);
  const [hour, setHour] = React.useState(props.hour);
  const [hourButtons, setHourButtons] = React.useState([]);
  const [fileBrowser, setFileBrowser] = React.useState([]);

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
      <div className="filesContainer">
        {createFileButtons(files, index, props.archive.load)}
      </div>
    );
    setFileBrowser(newFileBrowser);
  }, [files, index]);

  React.useEffect(() => {
    const newButtons = Array(24);
    if (count[hour] == 0) {
      let best = count.findIndex((x) => x > 0);
      if (best >= 0) {
        console.log(`Hour ${hour} has no data, choosing ${best} ...`);
        setDayHour(day, best);
      }
    }

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

  React.useEffect(() => {
    getMonthTable(date);
  }, []);

  const setDayHour = (newDay, newHour) => {
    setDay(newDay);
    setHour(newHour);
    let tmp = newDay.toISOString();
    let yyyymmdd = tmp.slice(0, 4) + tmp.slice(5, 7) + tmp.slice(8, 10);
    let hh = newHour.toString().padStart(2, "0");
    // console.log(`calling archive.list() ... ${yyyymmdd}-${hh}00`);
    props.archive.list(`${yyyymmdd}-${hh}00`);
  };

  // console.log(`files.length = ${files.length}   index = ${index}`);

  const getMonthTable = (newMonth) => {
    let tmp = newMonth.toISOString();
    let yyyymm = tmp.slice(0, 4) + tmp.slice(5, 7);
    props.archive.month(yyyymm);
  };

  return (
    <div className="fill">
      <SectionHeader name="archive" />
      <div className="calendarContainer">
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Date"
            value={day}
            onMonthChange={(newMonth) => {
              getMonthTable(newMonth);
            }}
            onChange={(newDay) => {
              setDayHour(newDay, hour);
            }}
            renderInput={(params) => <TextField {...params} />}
            renderDay={(day, _value, DayComponentProps) => {
              let key = day.toISOString().slice(0, 10);
              const hasData =
                key in props.archive.data.month &&
                props.archive.data.month[key] > 0;
              return (
                <Badge
                  key={key}
                  color="primary"
                  overlap="circular"
                  variant={hasData ? "dot" : undefined}
                >
                  <PickersDay {...DayComponentProps} />
                </Badge>
              );
            }}
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
