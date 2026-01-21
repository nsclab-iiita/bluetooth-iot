import React, { useState } from 'react';

const Bluejack = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleStop = async () => {
        try {
            const response = await fetch('http://localhost:4000/api/sendfile/stop', {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                setMessage('Process stopped successfully');
                setIsLoading(false);
            } else {
                setMessage('Failed to stop process: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error stopping process:', error);
            setMessage('Error stopping process: ' + (error.message || 'Unknown error'));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const macAddress = event.target.elements.macAddress.value;
        
        if (!macAddress.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
            setMessage('Please enter a valid MAC address (format: XX:XX:XX:XX:XX:XX)');
            return;
        }

        if (!selectedFile) {
            setMessage('Please select a file');
            return;
        }

        // Check if file is a .txt file
        const fileExt = selectedFile.name.toLowerCase().split('.').pop();
        if (!['txt'].includes(fileExt)) {
            setMessage('Error: Only .txt file are supported');
            return;
        }

        setIsLoading(true);
        setMessage('');
        setProgress('');

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch(`http://localhost:4000/api/sendfile/${macAddress}`, {
                method: 'POST',
                body: formData
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const events = text.split('\n\n');

                for (const event of events) {
                    if (event.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(event.slice(6));
                            switch (data.type) {
                                case 'progress':
                                case 'error':
                                    setProgress(prev => prev + data.data);
                                    break;
                                case 'complete':
                                    if (data.success) {
                                        setMessage('Success: File sent successfully');
                                    } else {
                                        setMessage('Error: Failed to send file');
                                    }
                                    setIsLoading(false);
                                    break;
                                default:
                                    continue;
                            }
                        } catch (e) {
                            console.error('Error parsing event:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error sending file:', error);
            setMessage('Error sending file: ' + (error.message || 'Unknown error'));
            setIsLoading(false);
        } finally {
            setSelectedFile(null);
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    };

    return (
        <div className="modes">
            <h3>Bluejacking Attack</h3>
            <form onSubmit={handleSubmit}>
                <label style={{marginBottom:"6px"}}>
                    MAC Address:
                    <input
                        type="text"
                        name="macAddress"
                        disabled={isLoading}
                    />
                </label>
                <br />
                <label>
                    File:
                    <input
                        type="file"
                        accept=".txt"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        disabled={isLoading}
                    />
                </label>
                <button type="submit" disabled={isLoading} style={{marginRight: "10px"}}>
                    {isLoading ? 'Sending...' : 'Submit'}
                </button>
                {isLoading && (
                    <button type="button" onClick={handleStop} style={{backgroundColor: "#dc3545", color: "white"}}>
                        Stop
                    </button>
                )}
            </form>
            
            {message && <p className={message.includes('Success') ? 'success-message' : 'error-message'}>
                {message}
            </p>}

            {/* {progress && <pre>{progress}</pre>} */}
        </div>
    );
};

export default Bluejack;