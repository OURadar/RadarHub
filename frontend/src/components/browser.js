import React, { memo } from "react";
import memoize from "memoize-one";

import TextField from "@mui/material/TextField";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DatePicker from "@mui/lab/DatePicker";

import { SectionHeader } from "./section-header";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { FixedSizeList, areEqual } from "react-window";

const Row = memo(({ data, index, style }) => {
  // Data passed to List as "itemData" is available as props.data
  const { items, archive } = data;
  const item = items[index];

  return (
    <ListItem style={style} key={index} component="div" disablePadding>
      <ListItemButton onClick={() => archive.load(item)}>
        <ListItemText primary={`File ${index + 1}. ${item}`} />
      </ListItemButton>
    </ListItem>
  );
}, areEqual);

const createItemData = memoize((items, archive) => ({
  items,
  archive,
}));

function Browser(props) {
  const files = props.archive?.data.list || [];
  const itemData = createItemData(files, props.archive);

  // Need to supply a event handler function from props
  let t = new Date("2013-05-20T00:00:00");
  console.log(t);

  const [value, setValue] = React.useState(t);

  return (
    <div className="fill">
      <SectionHeader name="archive" />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Collection Date"
          value={value}
          onChange={(newValue) => {
            console.log("new date picked", newValue);
            setValue(newValue);
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
          {Row}
        </FixedSizeList>
      </Box>
    </div>
  );
}

export { Browser };
