const fs = require('fs');
const router = require("express").Router();
const { spawn } = require('child_process');

router.get('/:macAddress', async (req, res) => {
  try {
    const macAddress = req.params.macAddress;

    // Path to the bash script
    const bashScriptPath = __dirname + '/pythonfiles/final.sh';
    const bashProcess = spawn('bash', [bashScriptPath, macAddress]);
    const outStream = fs.createWriteStream('version.txt');
    bashProcess.stdout.pipe(outStream);

    bashProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('Getting details process exited with code:', code);
        return res.status(500).json({ error: 'Internal server error' });
      }

      try {
        // Read the content of os.txt and version.txt asynchronously
        const osContent = await fs.promises.readFile('os.txt', 'utf8');
        console.log("os.txt content:", osContent);

        // Read version.txt
        const versionContent = await fs.promises.readFile('version.txt', 'utf8');
        const lines = versionContent.trim().split('\n');

        // Initialize variables for the parameters
        let mean_difference = 'Unknown';
        let response_perc = 'Unknown';
        let max_response = 'Unknown';

        // Loop through lines in reverse to find the last occurrence of each parameter
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];

          if (mean_difference === 'Unknown') {
            const meanDifferenceMatch = line.match(/Mean_difference:\s*([0-9.]+)/);
            if (meanDifferenceMatch) {
              mean_difference = meanDifferenceMatch[1];
            }
          }

          if (response_perc === 'Unknown') {
            const responsePercMatch = line.match(/response_perc:\s*([0-9.]+)/);
            if (responsePercMatch) {
              response_perc = responsePercMatch[1];
            }
          }

          if (max_response === 'Unknown') {
            const maxResponseMatch = line.match(/Max_response:\s*([0-9.]+)/);
            if (maxResponseMatch) {
              max_response = maxResponseMatch[1];
            }
          }

          // Break the loop if all parameters have been found
          if (mean_difference !== 'Unknown' && response_perc !== 'Unknown' && max_response !== 'Unknown') {
            break;
          }
        }

        console.log("Mean_difference:", mean_difference);
        console.log("Response_percentage:", response_perc);
        console.log("Max_response:", max_response);

        // Extract the last number from the last line of version.txt for OS version
        const numberMatch = lines[lines.length - 1].match(/\d+$/);
        const lastNumber = numberMatch ? numberMatch[0] : 'Unknown';
        let os_version = `${osContent.trim()} ${lastNumber}`.replace(/\s+/g, ' ').trim();
        console.log("OS Version:", os_version);

        // Path to the Python script for CVE scanning
        const cveScriptPath = __dirname + '/pythonfiles/cv_scanner.py';
        
        // Spawn the Python process for CVE scanning with the OS version as an argument
        const cveProcess = spawn('python3', [cveScriptPath, os_version]);
        let cveOutput = '';

        cveProcess.stdout.on('data', (data) => {
          console.log("CVE script output data received");
          cveOutput += data.toString();
        });

        cveProcess.on('close', (code) => {
          console.log("CVE process closed with code:", code);
          
          if (code !== 0) {
            console.error('CVE scanner process exited with code:', code);
            return res.status(500).json({ error: 'Internal server error' });
          }

          // Parse the output from the CVE scanner
          console.log("Parsing CVE output");
          const cveLines = cveOutput.trim().split('\n').slice(0, 5);
          const cveList = cveLines.map(line => {
            const cveId = line.replace(/\.json$/, '').replace(/\s+/g, ' ').trim();
            return cveId;
          });

          console.log("CVE List:", cveList);

          // Return the OS version, CVE list, and extracted parameters as a JSON response
          console.log("Returning response");
          return res.json({ 
            os_version, 
            cve_list: cveList,
            mean_difference,
            response_perc,
            max_response 
          });
        });

      } catch (err) {
        console.error('Error reading files:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
  } catch (error) {
    console.error("Caught exception:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
