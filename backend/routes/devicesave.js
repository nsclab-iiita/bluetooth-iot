const mongoose = require('mongoose');
const DeviceinfoModel = require("../models/Deviceinfo");
const router = require("express").Router();

router.post('/', async (req, res) => {
  try {
    const formData = req.body;
    const newForm = new DeviceinfoModel(formData);
    await newForm.save();
    res.status(200).send('Data saved successfully!');
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).send('Failed to save data.');
  }
});

module.exports = router;