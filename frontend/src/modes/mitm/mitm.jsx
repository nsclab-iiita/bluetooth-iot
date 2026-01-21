import "./mitm.css";
import React, { useState, useEffect, useRef } from 'react';
import axios from "axios";
import Heading from "../../components/heading/heading";
import Devicescan from "../devicescan/devicescan";

// Audio player icons (you can replace these with actual icon components if needed)
const PlayIcon = () => <span>▶️ Play Recording</span>;
const PauseIcon = () => <span>⏸️</span>;

export default function MitmAttack() {
    const [formData, setFormData] = useState({
        victim_earbuds_mac: "",
        victim_phone_mac: "",
        original_spoof_adapter_mac: "",
        connecting_adapter_mac: "",
        fake_earbuds_name: "",
        original_adapter_name: ""
    });
    const [isLoading, setIsLoading] = useState(false);
    const [output, setOutput] = useState("");
    const [isAttacking, setIsAttacking] = useState(false);
    const [outputLines, setOutputLines] = useState([]);
    // const [showRecord, setShowRecord] = useState(false);
    // const [isRecording, setIsRecording] = useState(false);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const terminalRef = useRef(null);
    const audioRef = useRef(null);
    // const recordingTerminalId = useRef(null);

    useEffect(() => {
        // Load current config on component mount
        loadConfig();
    }, []);

    useEffect(() => {
        // Auto-scroll to bottom when new output is added
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [outputLines]);

    useEffect(() => {
        let interval;
        if (isAttacking) {
            // Poll for attack status and output every 200ms for real-time updates
            interval = setInterval(async () => {
                try {
                    // Get output first for immediate display
                    const outputResponse = await axios.get("http://localhost:4000/api/mitm/output");
                    if (outputResponse.data.output) {
                        const lines = outputResponse.data.output.split('\n').filter(line => line.trim());
                        setOutputLines(lines);
                        
                        // // Check if attack completed successfully
                        // if (lines.some(line => line.includes('[+] All steps completed successfully!'))) {
                        //     setShowRecord(true);
                        // }
                    }
                    
                    // Then check status
                    const statusResponse = await axios.get("http://localhost:4000/api/mitm/status");
                    
                    // Only stop attacking if user explicitly stopped it or if it's been more than 3 seconds since attack ended
                    if (!statusResponse.data.isRunning) {
                        setTimeout(() => {
                            // Double check if still not running after delay
                            axios.get("http://localhost:4000/api/mitm/status").then(res => {
                                if (!res.data.isRunning) {
                                    setIsAttacking(false);
                                }
                            });
                        }, 3000);
                    }
                } catch (error) {
                    console.error("Error polling status:", error);
                }
            }, 200); // Poll every 200ms for near real-time updates
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isAttacking]);

    const loadConfig = async () => {
        try {
            const response = await axios.get("http://localhost:4000/api/mitm/config");
            if (response.data) {
                setFormData(response.data);
            }
        } catch (error) {
            console.error("Error loading config:", error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setOutput("");
        setOutputLines([]);
        setIsAttacking(true);

        try {
            // Update config file first
            await axios.post("http://localhost:4000/api/mitm/config", formData);
            
            // Start the MITM attack
            const response = await axios.post("http://localhost:4000/api/mitm/attack");
            
            if (response.data) {
                setOutput(response.data.output || response.data.message);
                
                // Start polling immediately for output (multiple immediate polls)
                for (let i = 0; i < 5; i++) {
                    setTimeout(async () => {
                        try {
                            const outputResponse = await axios.get("http://localhost:4000/api/mitm/output");
                            if (outputResponse.data.output) {
                                const lines = outputResponse.data.output.split('\n').filter(line => line.trim());
                                setOutputLines(lines);
                            }
                        } catch (error) {
                            console.error("Error getting immediate output:", error);
                        }
                    }, i * 100); // Poll at 0ms, 100ms, 200ms, 300ms, 400ms
                }
            }
        } catch (error) {
            setOutput(`Error: ${error.response?.data?.message || error.message}`);
            setIsAttacking(false);
        } finally {
            setIsLoading(false);
        }
    };

    // const startRecording = async () => {
    //     try {
    //         const response = await axios.post("http://localhost:4000/api/mitm/start-recording", {
    //             victim_phone_mac: formData.victim_phone_mac,
    //             victim_earbuds_mac: formData.victim_earbuds_mac
    //         });
    //         recordingTerminalId.current = response.data.terminalId;
    //         setIsRecording(true);
    //     } catch (error) {
    //         console.error("Error starting recording:", error);
    //     }
    // };

    // const stopRecording = async () => {
    //     if (recordingTerminalId.current) {
    //         try {
    //             await axios.post("http://localhost:4000/api/mitm/stop-recording", {
    //                 terminalId: recordingTerminalId.current
    //             });
    //             setIsRecording(false);
    //             recordingTerminalId.current = null;
    //         } catch (error) {
    //             console.error("Error stopping recording:", error);
    //         }
    //     }
    // };

    const toggleAudio = () => {
        if (audioRef.current) {
            if (audioPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setAudioPlaying(!audioPlaying);
        }
    };

    const stopAttack = async () => {
        try {
            await axios.post("http://localhost:4000/api/mitm/stop");
            setIsAttacking(false);
            
            // Update output to show stop message
            setTimeout(async () => {
                try {
                    const outputResponse = await axios.get("http://localhost:4000/api/mitm/output");
                    if (outputResponse.data.output) {
                        const lines = outputResponse.data.output.split('\n').filter(line => line.trim());
                        setOutputLines(lines);
                    }
                } catch (error) {
                    console.error("Error getting final output:", error);
                }
            }, 500);
        } catch (error) {
            console.error("Error stopping attack:", error);
            setIsAttacking(false);
        }
    };

    return (
        <div className="mitm-page">
            <Heading />
            <Devicescan/>
            <div className="modes">
                <div className="mitm_child">
                    <h4>MITM/Reflection Attack</h4>
                    
                    <form onSubmit={handleSubmit} className="mitm-form">
                                                <div className="form-group">
                            <label htmlFor="victim_earbuds_mac">Victim Earbuds MAC:</label>
                            <input
                                type="text"
                                id="victim_earbuds_mac"
                                name="victim_earbuds_mac"
                                value={formData.victim_earbuds_mac}
                                onChange={handleInputChange}
                                placeholder={formData.victim_earbuds_mac || "Enter victim earbuds MAC"}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="victim_phone_mac">Victim Phone MAC:</label>
                            <input
                                type="text"
                                id="victim_phone_mac"
                                name="victim_phone_mac"
                                value={formData.victim_phone_mac}
                                onChange={handleInputChange}
                                placeholder={formData.victim_phone_mac || "Enter victim phone MAC"}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="original_spoof_adapter_mac">Attacker's Original Spoof Adapter MAC:</label>
                            <input
                                type="text"
                                id="original_spoof_adapter_mac"
                                name="original_spoof_adapter_mac"
                                value={formData.original_spoof_adapter_mac}
                                onChange={handleInputChange}
                                placeholder={formData.original_spoof_adapter_mac || "Enter original adapter MAC"}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="connecting_adapter_mac">Attacker's Connecting Adapter MAC:</label>
                            <input
                                type="text"
                                id="connecting_adapter_mac"
                                name="connecting_adapter_mac"
                                value={formData.connecting_adapter_mac}
                                onChange={handleInputChange}
                                placeholder={formData.connecting_adapter_mac || "Enter connecting adapter MAC"}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="fake_earbuds_name">Victim's Earbuds Name:</label>
                            <input
                                type="text"
                                id="fake_earbuds_name"
                                name="fake_earbuds_name"
                                value={formData.fake_earbuds_name}
                                onChange={handleInputChange}
                                placeholder={formData.fake_earbuds_name || "Enter fake earbuds name"}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="original_adapter_name">Attacker's Original Adapter Name:</label>
                            <input
                                type="text"
                                id="original_adapter_name"
                                name="original_adapter_name"
                                value={formData.original_adapter_name}
                                onChange={handleInputChange}
                                placeholder={formData.original_adapter_name || "Enter original adapter name"}
                                required
                            />
                        </div>

                        <div className="button-group">
                            <button 
                                type="submit" 
                                disabled={isLoading || isAttacking}
                                className="submit-btn"
                            >
                                {isLoading ? "Starting Attack..." : "Start MITM Attack"}
                            </button>
                            
                            {isAttacking && (
                                <button 
                                    type="button" 
                                    onClick={stopAttack}
                                    className="stop-btn"
                                    title="Stop attack and perform cleanup (may take up to 30 seconds)"
                                >
                                    Stop Attack
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="output-section">
                        <h5>Terminal Output:</h5>
                        <div className="terminal-output" ref={terminalRef}>
                            {outputLines.length > 0 ? (
                                outputLines.map((line, index) => (
                                    <div key={index} className="output-line">{line}</div>
                                ))
                            ) : (
                                <div className="output-line">{output || "No output yet..."}</div>
                            )}
                        </div>

                        {/* {showRecord && (
                            <div className="recording-controls">
                                {!isRecording ? (
                                    <button
                                        onClick={startRecording}
                                        className="record-btn"
                                    >
                                        Start Recording
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopRecording}
                                        className="stop-record-btn"
                                    >
                                        Stop Recording
                                    </button>
                                )}
                            </div>
                        )} */}

                        <div className="audio-controls">
                            <button
                                onClick={async () => {
                                    try {
                                        await axios.post("http://localhost:4000/api/mitm/open-audio");
                                        // alert("Opening folder containing captured_audio.wav file. Please use your system's media player to play the file.");
                                    } catch (error) {
                                        console.error("Error opening audio file:", error);
                                        // alert("Error: Could not open the audio file location. Please check the folder: /home/iot-lab/Desktop/bluetoothgui/backend/routes/pythonfiles/");
                                    }
                                }}
                                className="audio-btn"
                                title="Open Folder Containing Audio File"
                            >
                                <PlayIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
