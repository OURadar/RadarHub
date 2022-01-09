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
  const count = props.archive?.data.hourlyCount || new Array(24).fill(0);
  const files = props.archive?.data.fileList || [];
  const index = props.archive?.data.index;

  const [day, setDay] = React.useState();
  const [hour, setHour] = React.useState();
  const [hourButtons, setHourButtons] = React.useState([]);
  // const [fileBrowser, setFileBrowser] = React.useState([]);

  const listRef = React.createRef();

  const scrollToIndex = () => {
    console.log(listRef);
    console.log(`Scroll list to index ${index}`);
    listRef.current.scrollToItem(index);
  };

  React.useEffect(() => {
    // const newFileBrowser = props.useMemo ? (
    //   <Box
    //     sx={{
    //       width: "100%",
    //       height: 600,
    //       backgroundColor: "var(--system-background)",
    //     }}
    //   >
    //     <FixedSizeList
    //       height={600}
    //       itemSize={32}
    //       itemCount={files.length}
    //       itemData={createFileList(files, index, props.archive.load)}
    //       overscanCount={5}
    //       ref={listRef}
    //     >
    //       {Item}
    //     </FixedSizeList>
    //   </Box>
    // ) : (
    //   <div className="filesContainer" ref={listRef}>
    //     {createFileButtons(files, index, props.archive.load)}
    //   </div>
    // );
    // setFileBrowser(newFileBrowser);
    console.log(
      `loadCountSinceList = ${props.archive.data.loadCountSinceList}   autoLoad = ${props.archive.autoLoad}`
    );
    if (props.archive.autoLoad && props.archive.data.loadCountSinceList == 1) {
      setTimeout(() => {
        scrollToIndex();
      }, 1000);
    }
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
    fetch("/data/date/")
      .then((response) => {
        if (response.status == 200) {
          response.json().then((buffer) => {
            let initialDay = new Date(buffer.dayISOString);
            let initialHour = buffer.hour;
            getMonthTable(initialDay);
            setDayHour(initialDay, initialHour);
          });
        } else {
          console.log(response);
          let initialDay = new Date("2022/01/02");
          getMonthTable(initialDay);
          setDayHour(initialDay, 21);
        }
      })
      .catch((error) => {
        console.log(`Unexpected error ${error}`);
        let initialDay = new Date("2013/05/20");
        // let initialDay = new Date("2018/02/14");
        // let initialDay = new Date("2018/08/10");
        // let initialDay = new Date("2022/01/02");
        getMonthTable(initialDay);
        setDayHour(initialDay, 19);
      });
  }, []);

  const setDayHour = (newDay, newHour) => {
    //console.log(`newDay = ${newDay}`);
    let tmp = newDay.toISOString();
    let y = parseInt(tmp.slice(0, 4));
    if (y < 2012) {
      console.log("No data prior to 2013");
      return;
    }
    let ymd = tmp.slice(0, 10).replace(/-/g, "");
    let hh = newHour.toString().padStart(2, "0");
    if (day != newDay) {
      props.archive.count(ymd);
    }
    if (day != newDay || hour != newHour) {
      props.archive.list(`${ymd}-${hh}00`);
    }
    setDay(newDay);
    setHour(newHour);
    console.log(
      `files.length = ${files.length}   index = ${index}   hour = ${hour}`
    );
  };

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
            onYearChange={(newDay) => {
              getMonthTable(newDay);
            }}
            onMonthChange={(newDay) => {
              getMonthTable(newDay);
            }}
            onChange={(newDay) => {
              if (newDay === null || newDay == "Invalid Date") {
                return;
              }
              setDayHour(newDay, hour);
            }}
            renderInput={(params) => <TextField {...params} />}
            renderDay={(day, _value, DayComponentProps) => {
              let key = day.toISOString().slice(0, 10);
              const hasData =
                key in props.archive.data.dailyAvailability &&
                props.archive.data.dailyAvailability[key] > 0;
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
      {props.useMemo ? (
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
            ref={listRef}
          >
            {Item}
          </FixedSizeList>
        </Box>
      ) : (
        <div className="filesContainer" ref={listRef}>
          {createFileButtons(files, index, props.archive.load)}
        </div>
      )}
      ;
    </div>
  );
}

export { Browser };
