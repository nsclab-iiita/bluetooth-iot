const router = require("express").Router();
const { spawn } = require('child_process');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    const pythonScriptPath = __dirname + '/pythonfiles/connection.py';

    // Spawn the Python process with the MAC address as an argument
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);
    let output = '';

    // Listen to stdout data from the Python process
    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    // Listen to stderr data from the Python process
    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
        res.status(500).send(`Error: ${data.toString()}`);
    });

    // Handle process close event
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.send(`${output}`);
        } else {
            res.status(500).send(`Script failed with code ${code}`);
        }
    });

  } catch (error) {
    console.error(`Exception: ${error.message}`);
    res.status(500).send(`Exception: ${error.message}`);
  }
});

module.exports = router;
