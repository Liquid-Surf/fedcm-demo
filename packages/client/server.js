import express from "express";

const app = express();
const port = process.env.PORT || 6080;
const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:${port}/`;

app.use(express.static('public'));



const clientId = {
  "client_id": `123`,
  "client_name": "test RP",
  "redirect_uris": [
    CLIENT_URL
  ],

  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}

app.get("/clientid", (req, res) => {
  res.status(200).json(clientId);
});



app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
