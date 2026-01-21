const fs = require('fs');
const router = require("express").Router();
const { spawn } = require('child_process');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    // Path to the consolidated Python script
    const pythonScriptPath = __dirname + '/pythonfiles/bluetooth_cve_scanner.py';

    // Check if the script file exists to prevent errors
    if (!fs.existsSync(pythonScriptPath)) {
      console.error('Error: Python script not found at', pythonScriptPath);
      return res.status(500).json({ error: 'Server configuration error: script not found.' });
    }

    // Spawn the Python process
    const pythonProcess = spawn('python3', [pythonScriptPath, macAddress]);

    let scriptOutput = '';
    let scriptError = '';

    // Capture stdout from the script
    pythonProcess.stdout.on('data', (data) => {
      scriptOutput += data.toString();
    });

    // Capture stderr for debugging
    pythonProcess.stderr.on('data', (data) => {
      scriptError += data.toString();
    });

    // Handle script completion
    pythonProcess.on('close', (code) => {
      console.log('--- Raw Python Script Output ---');
      console.log(scriptOutput);
      console.log('--------------------------------');

      if (code !== 0) {
        console.error(`Python script exited with code: ${code}`);
        console.error('stderr:', scriptError);
        return res.status(500).json({ error: 'Error executing scanner script.', details: scriptError });
      }

      try {
        // --- Parse Android Version ---
        const osVersionMatch = scriptOutput.match(/Estimated Android Version: (.*?)\n/);
        const os_version = osVersionMatch ? osVersionMatch[1].trim() : 'Unknown';
        console.log("OS Version:", os_version);
        
        // --- Parse other bluetooth parameters ---
        const meanDifferenceMatch = scriptOutput.match(/Mean_difference:\s*([0-9.]+)/);
        const mean_difference = meanDifferenceMatch ? meanDifferenceMatch[1] : 'Unknown';

        const responsePercMatch = scriptOutput.match(/response_perc:\s*([0-9.]+)/);
        const response_perc = responsePercMatch ? responsePercMatch[1] : 'Unknown';

        const maxResponseMatch = scriptOutput.match(/Max_response:\s*([0-9.]+)/);
        const max_response = maxResponseMatch ? maxResponseMatch[1] : 'Unknown';

        console.log("Mean_difference:", mean_difference);
        console.log("Response_percentage:", response_perc);
        console.log("Max_response:", max_response);

        // --- Parse Top 3 CVEs ---
        let cveList = [];
        const cveSection = scriptOutput.split('--- CVE Scan Results ---')[1];
        
        if (cveSection && !cveSection.includes("No relevant CVE entries found")) {
            const cveLines = cveSection.trim().split('\n');
            cveList = cveLines
              .map(line => line.split(' ')[0]) // Get the first part, e.g., 'CVE-2023-12345'
              .filter(cve => cve.startsWith('CVE-')); // Ensure it's a valid CVE ID format
        }
        
        console.log("CVE List:", cveList);

        // Return the final JSON response to the frontend
        return res.json({
          os_version,
          cve_list: cveList,
          mean_difference,
          response_perc,
          max_response
        });

      } catch (err) {
        console.error('Error parsing script output:', err);
        return res.status(500).json({ error: 'Internal server error while parsing script output.' });
      }
    });

  } catch (error) {
    console.error("Caught exception in endpoint handler:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;