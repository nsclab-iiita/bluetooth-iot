const router = require("express").Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Store recording terminal processes
const recordingProcesses = new Map();

const configPath = path.join(__dirname, 'pythonfiles', 'mitm_config.json');
const pythonScriptPath = path.join(__dirname, 'pythonfiles', 'bluetooth_mitm_automation.py');

let attackProcess = null;
let attackOutput = '';
let attackError = '';
let isStopping = false;

// Function to clean ANSI color codes and control characters
function cleanOutput(text) {
    // Minimal cleaning - only remove color codes and keep everything else
    return text
        // Remove only color codes like [0;93m, [0m, [1;39m
        .replace(/\x1b\[[0-9;]*m/g, '') 
        // Remove cursor positioning but keep content
        .replace(/\x1b\[[0-9]*[AB]/g, '') // Cursor up/down
        // Remove clear line sequences but keep the content
        .replace(/\x1b\[[0-9]*K/g, '') 
        // Keep everything else including brackets, prompts, device info, etc.
}

// Get current config
router.get('/config', (req, res) => {
    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // Remove comments and notes for frontend
            const cleanConfig = {
                victim_earbuds_mac: config.victim_earbuds_mac || "",
                victim_phone_mac: config.victim_phone_mac || "",
                original_spoof_adapter_mac: config.original_spoof_adapter_mac || "",
                connecting_adapter_mac: config.connecting_adapter_mac || "",
                fake_earbuds_name: config.fake_earbuds_name || "",
                original_adapter_name: config.original_adapter_name || ""
            };
            
            res.json(cleanConfig);
        } else {
            res.status(404).json({ error: 'Config file not found' });
        }
    } catch (error) {
        console.error('Error reading config:', error);
        res.status(500).json({ error: 'Failed to read config file' });
    }
});

// Update config
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

        // Read existing config to preserve comments
        let existingConfig = {};
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            existingConfig = JSON.parse(configData);
        }

        // Update config with new values
        const updatedConfig = {
            ...existingConfig,
            victim_earbuds_mac,
            victim_phone_mac,
            original_spoof_adapter_mac,
            connecting_adapter_mac,
            fake_earbuds_name,
            original_adapter_name
        };

        fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 4));
        res.json({ message: 'Config updated successfully' });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Failed to update config file' });
    }
});

// Start MITM attack
router.post('/attack', (req, res) => {
    try {
        if (attackProcess) {
            console.log('Attack already in progress with PID:', attackProcess.pid);
            return res.status(400).json({ error: 'Attack already in progress' });
        }

        // Check if Python script exists
        if (!fs.existsSync(pythonScriptPath)) {
            console.error('Python script not found:', pythonScriptPath);
            return res.status(400).json({ error: 'MITM script not found' });
        }

        console.log('Starting MITM attack with script:', pythonScriptPath);
        
        // Reset output buffers
        attackOutput = '';
        attackError = '';
        isStopping = false;
        
        // Use sudo with stdbuf to force unbuffered output for real-time capture
        // -oL forces line-buffered stdout, -eL forces line-buffered stderr
        // Spawn process in new process group and enable detached mode for proper signal handling
        attackProcess = spawn('sudo', ['stdbuf', '-oL', '-eL', 'python3', '-u', pythonScriptPath], {
            cwd: path.dirname(pythonScriptPath),
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: true // This allows the process to receive signals properly
        });

        let hasResponded = false;

        attackProcess.stdout.on('data', (data) => {
            const rawChunk = data.toString();
            const cleanChunk = cleanOutput(rawChunk);
            
            // Always add output immediately
            attackOutput += cleanChunk;
            console.log('MITM stdout (real-time):', cleanChunk);
            
            // Check if all steps completed successfully
            if (cleanChunk.includes('[+] All steps completed successfully!')) {
                console.log('Attack completed successfully, adding recording command...');
                
                // Read config to get victim MAC addresses
                try {
                    if (fs.existsSync(configPath)) {
                        const configData = fs.readFileSync(configPath, 'utf8');
                        const config = JSON.parse(configData);
                        
                        const victimPhoneMac = config.victim_phone_mac || '<PHONE_MAC>';
                        const victimEarbudsMac = config.victim_earbuds_mac || '<EARBUDS_MAC>';
                        
                        const recordingCommand = `cd /home/iot-lab/Desktop/bluetoothgui/backend/routes/pythonfiles && ./record_stealth ${victimPhoneMac} ${victimEarbudsMac}`;
                        const recordingMessage = '\n\n[🎙️] RECORDING COMMAND:\n' +
                                               `${recordingCommand}\n\n` +
                                               '[📋] Run the command manually in a new terminal to start recording\n';
                        
                        attackOutput += recordingMessage;
                        console.log('Added recording command to output');
                    }
                } catch (error) {
                    console.error('Error reading config for recording command:', error);
                    attackOutput += '\n\n[!] Error: Could not generate recording command - check config file\n';
                }
            }
        });

        attackProcess.stderr.on('data', (data) => {
            const rawChunk = data.toString();
            const cleanChunk = cleanOutput(rawChunk);
            
            // Always add error output immediately
            attackError += cleanChunk;
            attackOutput += cleanChunk; // Also add to output for display
            console.log('MITM stderr (real-time):', cleanChunk);
        });

        attackProcess.on('close', (code) => {
            console.log('MITM attack exited with code:', code);
            
            if (code === 0) {
                console.log('MITM attack completed successfully');
                attackOutput += '\n[+] Attack completed successfully';
            } else if (code === 130) {
                // Exit code 130 typically means SIGINT (Ctrl+C) - normal user interruption
                console.log('MITM attack was interrupted by user (SIGINT)');
                attackOutput += '\n[+] Attack stopped and cleanup completed successfully';
            } else {
                console.error('MITM attack failed with code:', code);
                console.error('Error output:', attackError);
                attackOutput += `\n[-] Attack failed with exit code: ${code}`;
            }
            
            // Set attackProcess to null after a delay to allow stop button to be visible
            setTimeout(() => {
                attackProcess = null;
                isStopping = false;
            }, 3000);
        });

        attackProcess.on('error', (error) => {
            console.error('Failed to start MITM attack:', error);
            attackProcess = null;
            if (!hasResponded) {
                hasResponded = true;
                return res.status(500).json({ error: 'Failed to start MITM attack: ' + error.message });
            }
        });

        // Respond immediately since the script requires sudo and may take time
        hasResponded = true;
        res.json({ 
            message: 'MITM attack started successfully',
            output: 'Attack initiated with sudo privileges. Check terminal output below for progress...'
        });

    } catch (error) {
        console.error('Error starting MITM attack:', error);
        attackProcess = null;
        res.status(500).json({ error: 'Failed to start MITM attack: ' + error.message });
    }
});

// Stop MITM attack
router.post('/stop', (req, res) => {
    try {
        if (attackProcess) {
            console.log('Stopping MITM attack with PID:', attackProcess.pid);
            isStopping = true;
            
            // First try to kill the entire process group
            try {
                process.kill(-attackProcess.pid, 'SIGINT');
            } catch (e) {
                console.log('Failed to kill process group, trying direct process kill');
            }

            // Send SIGINT directly to process as backup
            attackProcess.kill('SIGINT');
            attackOutput += '\n[!] Attack stopped by user - performing cleanup...';

            // Check if process is still running after 5 seconds
            setTimeout(() => {
                if (attackProcess && !attackProcess.killed) {
                    console.log('Process still running after SIGINT, trying SIGTERM...');
                    try {
                        process.kill(-attackProcess.pid, 'SIGTERM');
                    } catch (e) {
                        attackProcess.kill('SIGTERM');
                    }
                    attackOutput += '\n[!] Sent SIGTERM to cleanup process...';
                    
                    // Final force kill after 5 more seconds if still running
                    setTimeout(() => {
                        if (attackProcess && !attackProcess.killed) {
                            console.log('Force killing MITM attack with PID:', attackProcess.pid);
                            try {
                                process.kill(-attackProcess.pid, 'SIGKILL');
                            } catch (e) {
                                attackProcess.kill('SIGKILL');
                            }
                            attackOutput += '\n[!] Attack force stopped (cleanup may be incomplete)';
                            attackProcess = null;
                            isStopping = false;
                        }
                    }, 5000);
                }
            }, 5000);
            
            // Always respond immediately
            res.json({ message: 'MITM attack stop signal sent - cleanup in progress' });
        } else {
            res.status(400).json({ error: 'No attack in progress' });
        }
    } catch (error) {
        console.error('Error stopping MITM attack:', error);
        attackProcess = null;
        res.status(500).json({ error: 'Failed to stop MITM attack' });
    }
});

// Get attack output
router.get('/output', (req, res) => {
    res.json({ 
        output: attackOutput,
        error: attackError
    });
});

// Get raw attack output (for debugging)
router.get('/output/raw', (req, res) => {
    res.json({ 
        output: attackOutput,
        error: attackError,
        raw: true
    });
});

// Get attack status
router.get('/status', (req, res) => {
    res.json({ 
        isRunning: attackProcess !== null || isStopping,
        pid: attackProcess ? attackProcess.pid : null,
        isStopping: isStopping
    });
});

// Reset attack state (for debugging)
router.post('/reset', (req, res) => {
    try {
        if (attackProcess) {
            attackProcess.kill('SIGKILL');
        }
        attackProcess = null;
        attackOutput = '';
        attackError = '';
        res.json({ message: 'Attack state reset' });
    } catch (error) {
        attackProcess = null;
        attackOutput = '';
        attackError = '';
        isStopping = false;
        res.json({ message: 'Attack state reset' });
    }
});

// Start recording route
router.post('/start-recording', (req, res) => {
    try {
        const { victim_phone_mac, victim_earbuds_mac } = req.body;
        const pythonFilesPath = path.join(__dirname, 'pythonfiles');
        
        // Ensure record_stealth has execute permissions
        fs.chmodSync(path.join(pythonFilesPath, 'record_stealth'), '755');
        
        const recordProcess = spawn('sudo', ['./record_stealth', victim_phone_mac, victim_earbuds_mac], {
            cwd: pythonFilesPath,
            detached: true,
            stdio: 'inherit'
        });

        const terminalId = Date.now().toString();
        recordingProcesses.set(terminalId, recordProcess);

        // Handle process exit
        recordProcess.on('exit', () => {
            recordingProcesses.delete(terminalId);
        });

        res.json({ 
            message: 'Recording started',
            terminalId: terminalId
        });
    } catch (error) {
        console.error('Error starting recording:', error);
        res.status(500).json({ error: 'Failed to start recording' });
    }
});

// Stop recording route
router.post('/stop-recording', (req, res) => {
    try {
        const { terminalId } = req.body;
        const recordProcess = recordingProcesses.get(terminalId);
        
        if (recordProcess) {
            recordProcess.kill('SIGINT');
            recordingProcesses.delete(terminalId);
            res.json({ message: 'Recording stopped' });
        } else {
            res.status(404).json({ error: 'Recording process not found' });
        }
    } catch (error) {
        console.error('Error stopping recording:', error);
        res.status(500).json({ error: 'Failed to stop recording' });
    }
});

// Open audio file in system
router.post('/open-audio', (req, res) => {
    const audioPath = path.join(__dirname, 'pythonfiles', 'captured_audio.wav');
    if (fs.existsSync(audioPath)) {
        const { exec } = require('child_process');
        
        try {
            // Just open the file's location in the file manager
            exec(`xdg-open "${path.dirname(audioPath)}"`, (error) => {
                if (error) {
                    console.error('Error opening folder:', error);
                    res.status(500).json({ error: 'Failed to open audio file location' });
                } else {
                    res.json({ message: 'Opened folder containing audio file' });
                }
            });
        } catch (error) {
            console.error('Error processing request:', error);
            res.status(500).json({ error: 'Failed to process request' });
        }
    } else {
        res.status(404).json({ error: 'Audio file not found' });
    }
});

module.exports = router;
