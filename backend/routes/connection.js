const fs = require('fs');
const router = require("express").Router();
const { spawn } = require('child_process');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    const pythonScriptPath = __dirname + '/pythonfiles/connection.py';

    // Spawn the Python process with the MAC address as an argument
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);
    const outStream = fs.createWriteStream('os.txt');
    pythonProcess.stdout.pipe(outStream);
    let output = '';
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Getting details process exited with code:', code);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        // Send the output string as is
        // res.json({ output });
        fs.readFile('os.txt', 'utf8', (err, data) => {
          if (err) {
              console.error('Error reading the file:', err);
              return;
          }
         
          const lines = data.trim().split('\n');
          output = lines[lines.length - 1];
         
          console.log('Last line:', output);
          res.json({ output });
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
