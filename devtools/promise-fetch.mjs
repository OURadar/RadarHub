//
//   M a i n
//

items = ["20230719-150514-E4.0-Z", "20230719-150715-E4.0-Z", "20230719-150915-E4.0-Z"];

Promise.all(
  items.map(async (item) => {
    const url = `https://radarhub.arrc.ou.edu/data/load/px1000/${item}/`;
    console.log(url);
    return fetch(url, { cache: "force-cache" })
      .then((response) => {
        if (response.code == 200) {
          return response.arrayBuffer();
        }
      })
      .catch((error) => console.error(`Unexpected error ${error}`));
  })
).then((values) => {
  console.log(values);
});
