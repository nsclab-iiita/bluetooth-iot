const router = require("express").Router();
const { spawn } = require('child_process');


router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    const pythonScriptPath = __dirname + '/pythonfiles/details_2.py';

    // Spawn the Python process with the MAC address as an argument
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);

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
      console.error('Error:', data.toString());
      res.status(500).json({ error: 'Internal server error' });
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Getting deatils process exited with code:', code);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ output: output });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
