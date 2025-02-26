import express from "express";

const app = express();
const port = process.env.PORT  || 6080; // Accept from env, CLI args, or default

app.use(express.static('public'));



const clientId = {
  "client_id": `123`,
  "client_name": "test RP",
  "redirect_uris": [
    // `http://localhost:${port}/`
    `http://rp.localhost:${port}/`
  ],
}

app.get("/clientid", (req, res) => {
  res.status(200).json(clientId);
});



app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
