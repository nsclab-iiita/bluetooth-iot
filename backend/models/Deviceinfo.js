const mongoose = require('mongoose');
const DeviceinfoSchema = new mongoose.Schema({
    BDAddress: String,
    Devicedetails: {
      Devicename: String,
      LMPversion: String,
      OUIcompany: String,
      Manufacturer: String,
      Modalias: String,
      Class: String,
      Icon: String,
      RSSI: String,
      BatteryPercentage: String,
      UUID: [String],
    },
    DosAttack: String,
    MACSpoofing: String,
    OperatingSys: String,
    OsVersion: String,
    Encryption: String,
  });

const Deviceinfo = mongoose.model('Deviceinfo', DeviceinfoSchema);
module.exports = Deviceinfo;