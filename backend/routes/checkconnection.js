// routes/checkconnection.js
const router = require('express').Router();
const { spawn } = require('child_process');

router.get('/:macaddress', (req, res) => {
    const macAddress = req.params.macaddress; // Ensure the parameter name matches here
    const pythonScriptPath = __dirname + '/pythonfiles/check_connection.py';
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);

    let output = '';

    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        res.status(500).json({ error: 'An error occurred' });
    });

    pythonProcess.on('close', (code) => {
        output = output.trim(); // Trim any extra whitespace or newline characters
        if (output === '1') {
            res.status(200).json({ connected: true });
        } else {
            res.status(200).json({ connected: false });
        }
    });
});

module.exports = router;
