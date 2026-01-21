const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.post('/:state', (req, res) => {
  const stateParam = req.params.state.toLowerCase();

  if (stateParam !== 'on' && stateParam !== 'off') {
    return res.status(400).json({ error: 'Invalid state. Use "on" or "off".' });
  }

  // Command to unblock or block using rfkill
  const rfkillCommand = stateParam === 'on'
    ? 'sudo rfkill unblock bluetooth'
    : 'sudo rfkill block bluetooth';

  // Command to power on/off using bluetoothctl
  const btctlCommand = `echo -e 'power ${stateParam}\\nquit' | sudo bluetoothctl`;

  // Run both commands in sequence
  exec(`${rfkillCommand} && ${btctlCommand}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${stderr || error.message}`);
      return res.status(500).json({ error: stderr || error.message });
    }

    res.status(200).json({
      message: `Bluetooth ${stateParam === 'on' ? 'enabled' : 'disabled'}`,
      output: stdout.trim(),
    });
  });
});

module.exports = router;
