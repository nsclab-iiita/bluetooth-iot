const router = require("express").Router();
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require('fs');

// Store active process
let activeProcess = null;

// Configure multer for file upload with file type validation
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "pythonfiles/uploads/");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.txt', '.vcf'].includes(ext)) {
            cb(new Error('Only .txt and .vcf files are allowed'), null);
            return;
        }
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.txt', '.vcf'].includes(ext)) {
        cb(new Error('Only .txt and .vcf files are allowed'), false);
        return;
    }
    cb(null, true);
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter
});

// Add stop endpoint
router.post("/stop", (req, res) => {
    if (activeProcess) {
        try {
            // Kill process group to ensure child processes are also terminated
            process.kill(-activeProcess.pid);
            activeProcess = null;
            res.json({ success: true, message: "Process stopped successfully" });
        } catch (err) {
            console.error("Error stopping process:", err);
            res.status(500).json({ 
                success: false, 
                message: "Failed to stop process",
                error: err.message 
            });
        }
    } else {
        res.json({ success: true, message: "No active process to stop" });
    }
});

router.post("/:macAddress", upload.single("file"), (req, res) => {
    try {
        // Kill any existing process before starting new one
        if (activeProcess) {
            try {
                process.kill(-activeProcess.pid);
            } catch (e) {
                console.error("Error killing existing process:", e);
            }
            activeProcess = null;
        }

        const macAddress = req.params.macAddress;
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded or invalid file type" });
        }

        const filePath = req.file.path;
        const pythonScript = path.join(__dirname, "pythonfiles/bluejack.py");

        // Set response headers for streaming
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        console.log('File received:', {
            originalName: req.file.originalname,
            savedAs: req.file.filename,
            size: req.file.size,
            path: filePath
        });

        // Create process with its own process group
        activeProcess = spawn('python3', [pythonScript, macAddress, filePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: true
        });

        activeProcess.stdout.on("data", (data) => {
            const output = data.toString();
            console.log("Python stdout:", output);
            res.write(`data: ${JSON.stringify({ type: 'progress', data: output })}\n\n`);
        });

        activeProcess.stderr.on("data", (data) => {
            const error = data.toString();
            console.error("Python stderr:", error);
            res.write(`data: ${JSON.stringify({ type: 'error', data: error })}\n\n`);
        });

        activeProcess.on("error", (err) => {
            console.error("Failed to start Python process:", err);
            res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                data: 'Failed to start Python process: ' + err.message 
            })}\n\n`);
            cleanupFile(filePath);
            activeProcess = null;
        });

        activeProcess.on("close", (code) => {
            console.log("Python process exited with code:", code);
            res.write(`data: ${JSON.stringify({
                type: 'complete',
                success: code === 0,
                message: code === 0 ? "File sent successfully" : "Failed to send file"
            })}\n\n`);
            res.end();
            cleanupFile(filePath);
            activeProcess = null;
        });

    } catch (err) {
        console.error("Error in send_file route:", err);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Internal server error",
                error: err.message
            });
        }
        if (req.file) {
            cleanupFile(req.file.path);
        }
        activeProcess = null;
    }
});

function cleanupFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
            else console.log('Successfully cleaned up file:', filePath);
        });
    }
}

module.exports = router;