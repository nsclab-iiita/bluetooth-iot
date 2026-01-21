const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const devicescanRoute = require("./routes/devicescan");
const devicedetailsRoute = require("./routes/devicedetails");
const operatingsysRoute = require("./routes/operatingsys");
const encryptionRoute = require("./routes/encryption");
const dosRoute = require("./routes/dos");
const SpoofingRoute = require("./routes/spoofing");
const OsversionRoute = require("./routes/osversion");
const checkconnectionRoute = require("./routes/checkconnection");
const devicesaveRoute = require("./routes/devicesave");
const connectionRoute = require("./routes/connection");
const disconnectionRoute = require("./routes/disconnection");
const rttRoute = require("./routes/rtt");
const responsepercentageRoute = require("./routes/reponsepercentage");
const sendFileRoute = require("./routes/send_file")
const firmwareRoute = require("./routes/firmware");
const bluetoothRoute = require("./routes/bluebutton.js");
const mitmRoute = require("./routes/mitm");

mongoose.connect('mongodb://localhost:27017/Bluetoothiot', { useNewUrlParser: true, useUnifiedTopology: true });

var cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());

app.use(express.json());

app.use(helmet());
app.use(morgan("common"));

// app.use("/files", express.static(path.join(__dirname, "routes/pythonfiles/")));
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "routes/");
//   },
//   filename: (req, file, cb) => {
//     cb(null, req.body.name);
//   },
// });

// const upload = multer({ storage: storage });
//   app.post("/upload", upload.single("file"), (req, res) => {
//   try {
//   return res.status(200).json("File uploded successfully");
//   } catch (error) {
//     console.error(error);
//   }
// });

app.use("/api/devicescan", devicescanRoute);
app.use("/api/devicedetails",devicedetailsRoute);
app.use("/api/operatingsys",operatingsysRoute);
app.use("/api/encryption/" , encryptionRoute);
app.use("/api/dos", dosRoute);
app.use("/api/spoofing" , SpoofingRoute);
app.use("/api/osversion", OsversionRoute);
app.use("/api/connectionstatus" , checkconnectionRoute);
app.use("/api/devicesave",devicesaveRoute)
app.use("/api/connect",connectionRoute);
app.use("/api/disconnect",disconnectionRoute);
app.use("/api/rtt",rttRoute);
app.use("/api/responsepercentage",responsepercentageRoute);
app.use("/api/sendfile", sendFileRoute)
app.use("/api/firmware", firmwareRoute)
app.use("/api/bluetooth", bluetoothRoute);
app.use("/api/mitm", mitmRoute);

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
