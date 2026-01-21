const fs = require('fs');
const router = require("express").Router();
const { spawn } = require('child_process');
const path = require('path');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;
    const pythonFilesDir = __dirname + '/pythonfiles';
    const cFilePath = path.join(pythonFilesDir, 'ble_firmware_detection.c');
    const executablePath = path.join(pythonFilesDir, 'ble_firmware_detection');

    console.log(`[*] Starting BLE firmware detection for MAC: ${macAddress}`);

    // Step 1: Compile the C code
    console.log('[*] Compiling BLE firmware detection C code...');
    const compileProcess = spawn('gcc', [
      cFilePath, 
      '-o', executablePath, 
      '-lbluetooth'
    ], { cwd: pythonFilesDir });

    let compileError = '';
    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    compileProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('BLE firmware detection compilation failed:', compileError);
        return res.status(500).json({ error: 'Compilation failed: ' + compileError });
      }

      console.log('[*] Compilation successful, executing BLE firmware detection...');

      // Step 2: Execute the compiled program
      const execProcess = spawn(executablePath, [macAddress], { cwd: pythonFilesDir });
      let output = '';
      let errorOutput = '';

      execProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      execProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      execProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error('BLE firmware detection process failed:', errorOutput);
          return res.status(500).json({ error: 'BLE firmware detection failed: ' + errorOutput });
        }

        console.log('[*] BLE firmware detection completed');
        console.log('Output:', output);

        try {
          // Parse the output to extract firmware version
          const lines = output.trim().split('\n');
          let firmwareVersion = 'Unknown';
          let connectionStatus = 'Failed';
          let deviceInfoService = 'Not Found';

          // Extract information from output
          for (const line of lines) {
            if (line.includes('Firmware Version:')) {
              firmwareVersion = line.split('Firmware Version:')[1].trim();
            }
            if (line.includes('Connected.')) {
              connectionStatus = 'Connected';
            }
            if (line.includes('Found Device Information Service')) {
              deviceInfoService = 'Found';
            }
          }

          console.log(`[*] Detected Firmware Version: ${firmwareVersion}`);

          // Create response function to avoid code duplication
          const sendResponse = (cveList = []) => {
            const response = {
              firmware_version: firmwareVersion,
              connection_status: connectionStatus,
              device_info_service: deviceInfoService,
              cve_list: cveList,
              raw_output: output
            };

            console.log('[*] Sending firmware detection response to frontend');
            return res.json(response);
          };

          // Step 3: Get CVEs using the detected firmware version (if found)
          if (firmwareVersion !== 'Unknown' && firmwareVersion.trim() !== '') {
            console.log('[*] Searching for CVEs related to firmware...');
            
            // Use cv_scanner.py for CVE results
            const cveScriptPath = path.join(pythonFilesDir, 'cv_scanner.py');
            const cveProcess = spawn('python3', [cveScriptPath, firmwareVersion], { cwd: pythonFilesDir });
            
            let cveOutput = '';
            let cveError = '';
            let responsesSent = false;

            // Set timeout for CVE scanning (10 seconds)
            const cveTimeout = setTimeout(() => {
              if (responsesSent) return;
              responsesSent = true;
              console.log('[*] CVE scanning timed out, sending response without CVEs');
              sendResponse([]);
            }, 10000);

            cveProcess.stdout.on('data', (data) => {
              cveOutput += data.toString();
            });

            cveProcess.stderr.on('data', (data) => {
              cveError += data.toString();
            });

            cveProcess.on('close', (cveCode) => {
              if (responsesSent) return;
              responsesSent = true;
              clearTimeout(cveTimeout);
              
              console.log(`[*] CVE process completed with code: ${cveCode}`);
              
              let cveList = [];
              if (cveCode === 0 && cveOutput.trim()) {
                // Parse CVE output from cv_scanner.py (similar to osversion.js)
                const cveLines = cveOutput.trim().split('\n').slice(0, 5);
                cveList = cveLines.map(line => {
                  const cveId = line.replace(/\.json$/, '').replace(/\s+/g, ' ').trim();
                  return cveId;
                });
              }

              console.log(`[*] Found ${cveList.length} CVEs for firmware:`, cveList);
              sendResponse(cveList);
            });

            cveProcess.on('error', (error) => {
              if (responsesSent) return;
              responsesSent = true;
              clearTimeout(cveTimeout);
              
              console.error('[*] CVE process error:', error);
              console.log('[*] Sending response without CVEs due to error');
              sendResponse([]);
            });

          } else {
            // No firmware version detected, send response without CVEs
            console.log('[*] No firmware version detected, sending response without CVEs');
            sendResponse([]);
          }

        } catch (parseError) {
          console.error('Error parsing firmware detection output:', parseError);
          return res.status(500).json({ error: 'Failed to parse firmware detection results' });
        }
      });
    });

  } catch (error) {
    console.error("Caught exception in firmware detection:", error);
    res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
});

module.exports = router;