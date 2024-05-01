import express from "express";

const app = express();
const port = 6080;

app.use(express.static('public'));



const clientId = {
  "client_id": `123`,
  "client_name": "test RP",
  "redirect_uris": [
    `http://localhost:${port}/`
  ],
}

app.get("/clientid", (req, res) => {
  res.status(200).json(clientId);
});



app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
