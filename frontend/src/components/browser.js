import React, { memo } from "react";
import memoize from "memoize-one";

import TextField from "@mui/material/TextField";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DatePicker from "@mui/lab/DatePicker";

import { SectionHeader } from "./section-header";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { FixedSizeList, areEqual } from "react-window";

const Item = memo(({ data, index, style }) => {
  const { list, selectedIndex, loadItem } = data;
  const selected = index == selectedIndex;
  const item = list[index];

  return (
    <Button
      key={index}
      onClick={() => loadItem(item, index)}
      style={{ ...style, overflow: "hidden", textOverflow: "ellipsis" }}
      variant="file"
      selected={selected}
    >
      {item}
    </Button>
  );
}, areEqual);

const createItemData = memoize((list, index, load) => ({
  list: list,
  selectedIndex: index,
  loadItem: load,
}));

function Browser(props) {
  const files = props.archive?.data.list || [];
  const index = props.archive?.data.index || -1;
  const itemData = createItemData(files, index, props.archive.load);

  // Need to supply a event handler function from props
  let t = new Date("2013-05-20T00:00:00");
  // const [value, setValue] = React.useState(null);

  return (
    <div className="fill">
      <SectionHeader name="archive" />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Collection Date"
          value={t}
          onChange={(newValue) => {
            console.log("new date picked", newValue);
            // setValue(newValue);
            // props.archive.list()
          }}
          renderInput={(params) => <TextField {...params} />}
        />
      </LocalizationProvider>
      <SectionHeader name="files" />
      <Box sx={{ width: "100%", height: 600, bgcolor: "background.paper" }}>
        <FixedSizeList
          height={600}
          itemSize={40}
          itemCount={files.length}
          itemData={itemData}
          overscanCount={5}
        >
          {Item}
        </FixedSizeList>
      </Box>
    </div>
  );
}

export { Browser };
