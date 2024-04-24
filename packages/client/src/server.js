import express from "express";

const app = express();
const port = 6080;

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
