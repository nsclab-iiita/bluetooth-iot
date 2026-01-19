const router = require("express").Router();
const { spawn } = require('child_process');
const Scaninstant = require("../models/Scaninstant")


router.get('/', (req, res) => {
    const pythonScriptPath = __dirname + '/pythonfiles/devicescan.py';
      const pythonProcess = spawn('python3', [pythonScriptPath]);
    
      let output = [];
      let errorOutput = '';
    
      pythonProcess.stdout.on('data', (data) => {
        try {
          const jsonData = JSON.parse(data.toString());
          output.push(jsonData);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          output.push(data.toString()); 
        }
      });
    
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    
      pythonProcess.on('close', (code) => {
        console.log('Device scan exited with code:', code);
    
        if (code === 0) {
          res.json({ output: output });
        } else {
          // Error during execution
          console.error('Error executing Python script:', errorOutput || 'Unknown error');
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });
    });

    router.get('/prev/:timestamp', async (req, res) => {
      const timestamp = req.params.timestamp;
          const deviceData = await Scaninstant.find({ timestamp: timestamp });
          res.json(deviceData);
  });


  router.post('/', async (req, res) => {
    const { timestamp, devices } = req.body; 

    const scanInstantData = new Scaninstant({ 
        timestamp: timestamp,
        devices: devices
    });

    try {
        const newScanInstant = await scanInstantData.save();
        res.status(201).json(newScanInstant);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/prev/:timestamp', async (req, res) => {
  const timestamp = req.params.timestamp;
  
  try {
      const deletedScanInstant = await Scaninstant.findOneAndDelete({ timestamp });

      if (!deletedScanInstant) {
          return res.status(404).json({ message: 'Scan instant not found' });
      }

      res.status(200).json({ message: 'Scan instant deleted successfully', deletedScanInstant });
  } catch (error) {
      console.error('Error deleting scan instant:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;