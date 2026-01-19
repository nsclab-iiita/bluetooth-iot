const fs = require('fs');
const router = require("express").Router();
const { spawn } = require('child_process');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    const pythonScriptPath = __dirname + '/pythonfiles/dos.py';

    // Spawn the Python process with the MAC address as an argument
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);

    const outStream = fs.createWriteStream('dos.txt');
    pythonProcess.stdout.pipe(outStream);  

    let output = 'Dos Attack is successfull on ';
    output += macAddress;
    console.log(output);

    // Listen for data on stderr
    // pythonProcess.stderr.on('data', (data) => {
    //   console.error('Error:', data.toString());
    //   res.status(500).json({ error: 'Internal server error' });
    // });

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
