const router = require("express").Router();
const { spawn } = require('child_process');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    const pythonScriptPath = __dirname + '/pythonfiles/spoof_mac.py';

    // Spawn the Python process with the MAC address as an argument
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);

    let output = '';

    // Listen for data on stdout
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString(); // Append data to output string
    });

    // Listen for data on stderr
    pythonProcess.stderr.on('data', (data) => {
        console.error('Error:', data.toString());
        res.status(500).json({ error: 'Internal server error' });
    });
    
    // Listen for error event
    pythonProcess.on('error', (error) => {
       console.error('Python process encountered an error:', error);
       res.status(500).json({ error: 'Internal server error' });
     });

    // Listen for close event
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Getting details process exited with code:', code);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        // Send the output string as is
        res.json({ output });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
