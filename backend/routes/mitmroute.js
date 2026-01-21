const router = require("express").Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let currentAttackProcess = null;

// Config file path
const configFilePath = path.join(__dirname, 'pythonfiles', 'mitm_config.json');

// GET route to fetch current config
router.get('/config', (req, res) => {
    try {
        if (fs.existsSync(configFilePath)) {
            const configData = fs.readFileSync(configFilePath, 'utf8');
            const config = JSON.parse(configData);
            
            // Return only the relevant fields
            const configFields = {
                victim_earbuds_mac: config.victim_earbuds_mac || "",
                victim_phone_mac: config.victim_phone_mac || "",
                original_spoof_adapter_mac: config.original_spoof_adapter_mac || "",
                connecting_adapter_mac: config.connecting_adapter_mac || "",
                fake_earbuds_name: config.fake_earbuds_name || "",
                original_adapter_name: config.original_adapter_name || ""
            };
            
            res.json(configFields);
        } else {
            // Return empty fields if config doesn't exist
            res.json({
                victim_earbuds_mac: "",
                victim_phone_mac: "",
                original_spoof_adapter_mac: "",
                connecting_adapter_mac: "",
                fake_earbuds_name: "",
                original_adapter_name: ""
            });
        }
    } catch (error) {
        console.error('Error reading config file:', error);
        res.status(500).json({ error: 'Failed to read config file' });
    }
});

// POST route to update config
router.post('/config', (req, res) => {
    try {
        const {
            victim_earbuds_mac,
            victim_phone_mac,
            original_spoof_adapter_mac,
            connecting_adapter_mac,
            fake_earbuds_name,
            original_adapter_name
        } = req.body;

        // Read existing config or create new one
        let config = {};
        if (fs.existsSync(configFilePath)) {
            const configData = fs.readFileSync(configFilePath, 'utf8');
            config = JSON.parse(configData);
        }

        // Update config with new values
        config.victim_earbuds_mac = victim_earbuds_mac;
        config.victim_phone_mac = victim_phone_mac;
        config.original_spoof_adapter_mac = original_spoof_adapter_mac;
        config.connecting_adapter_mac = connecting_adapter_mac;
        config.fake_earbuds_name = fake_earbuds_name;
        config.original_adapter_name = original_adapter_name;

        // Ensure other fields exist
        config._comment = config._comment || "Bluetooth MITM Attack Configuration File";
        config._instructions = config._instructions || "Fill in the MAC addresses below with your actual device addresses";
        config.recording_file = config.recording_file || "captured_audio.wav";
        config._notes = config._notes || [
            "earbuds_mac: MAC address of the target earbuds you want to impersonate",
            "phone_mac: MAC address of the victim's phone",
            "original_adapter_mac: Original MAC of your Bluetooth adapter before spoofing",
            "spoofing_adapter: Bluetooth adapter used for spoofing (usually hci1 or hci2)",
            "connecting_adapter: Bluetooth adapter used to connect to real earbuds (usually hci0)",
            "fake_earbuds_name: Name that will appear to the victim's phone",
            "original_adapter_name: Original name of your Bluetooth adapter"
        ];

        // Write updated config back to file
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));

        res.json({ message: 'Config updated successfully' });
    } catch (error) {
        console.error('Error updating config file:', error);
        res.status(500).json({ error: 'Failed to update config file' });
    }
});

// POST route to start MITM attack
router.post('/attack', (req, res) => {
    try {
        // Check if attack is already running
        if (currentAttackProcess && !currentAttackProcess.killed) {
            return res.status(400).json({ error: 'Attack is already running' });
        }

        const pythonScriptPath = path.join(__dirname, 'pythonfiles', 'bluetooth_mitm_automation.py');
        
        // Check if script exists
        if (!fs.existsSync(pythonScriptPath)) {
            return res.status(404).json({ error: 'MITM script not found' });
        }

        // Start the Python script with sudo
        currentAttackProcess = spawn('sudo', ['python3', pythonScriptPath], {
            cwd: path.join(__dirname, 'pythonfiles')
        });

        let output = '';
        let errorOutput = '';

        currentAttackProcess.stdout.on('data', (data) => {
            const dataStr = data.toString();
            output += dataStr;
            console.log('MITM stdout:', dataStr);
        });

        currentAttackProcess.stderr.on('data', (data) => {
            const dataStr = data.toString();
            errorOutput += dataStr;
            console.error('MITM stderr:', dataStr);
        });

        currentAttackProcess.on('close', (code) => {
            console.log('MITM attack exited with code:', code);
            currentAttackProcess = null;
        });

        currentAttackProcess.on('error', (error) => {
            console.error('Failed to start MITM attack:', error);
            currentAttackProcess = null;
        });

        // Give it a moment to start and return initial response
        setTimeout(() => {
            if (currentAttackProcess && !currentAttackProcess.killed) {
                res.json({ 
                    message: 'MITM attack started successfully',
                    output: output,
                    pid: currentAttackProcess.pid
                });
            } else {
                res.status(500).json({ 
                    error: 'Failed to start MITM attack',
                    output: output,
                    errorOutput: errorOutput
                });
            }
        }, 2000);

    } catch (error) {
        console.error('Error starting MITM attack:', error);
        res.status(500).json({ error: 'Failed to start MITM attack' });
    }
});

// POST route to stop MITM attack
router.post('/stop', (req, res) => {
    try {
        if (currentAttackProcess && !currentAttackProcess.killed) {
            currentAttackProcess.kill('SIGTERM');
            currentAttackProcess = null;
            res.json({ message: 'MITM attack stopped successfully' });
        } else {
            res.status(400).json({ error: 'No attack is currently running' });
        }
    } catch (error) {
        console.error('Error stopping MITM attack:', error);
        res.status(500).json({ error: 'Failed to stop MITM attack' });
    }
});

// GET route to check attack status
router.get('/status', (req, res) => {
    const isRunning = currentAttackProcess && !currentAttackProcess.killed;
    res.json({ 
        isRunning: isRunning,
        pid: isRunning ? currentAttackProcess.pid : null
    });
});

module.exports = router;
