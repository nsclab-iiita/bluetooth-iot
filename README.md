# Bluetooth Security Audit Framework  

This project is a collaborative effort between the **IoT Security Research Lab, IIIT Allahabad**, and **C3i Hub, IIT Kanpur**. The framework is designed to identify and mitigate security vulnerabilities in Bluetooth-enabled devices, offering a comprehensive suite of tools for auditing and enhancing Bluetooth security.  

---

## Features  

### Bluetooth Device Scanner  
- Scans the surrounding environment for active Bluetooth devices.  
- Provides a list of discovered devices, including:  
  - Device names  
  - MAC addresses  
  - Signal strength (RSSI)  
  - Estimated distance  

### Bluetooth Device Details Scan  
- Fetches detailed information about a target Bluetooth device.  
- Captures attributes such as Manufacturer details, Bluetooth version etc. 

### Operating System Identification  
- Analyzes the target device to infer the operating system (OS) it is running.  
- Supports identification of commonly used Bluetooth-enabled OS platforms.  

### Operating System Version Prediction  
- Predicts the specific version of the operating system based on observed device behaviors and characteristics.  
- Helps in identifying outdated or vulnerable OS versions for targeted security assessments.  

### Denial of Service (DoS) Attack Simulation  
- Simulates Bluetooth-based DoS attacks to evaluate device robustness.  
- Tests the device’s capacity to handle traffic flooding  
- Provides insights into potential points of failure during an attack.  

### MAC Address Spoofing  
- Simulates MAC address spoofing to test device authentication mechanisms.  
- Assesses device vulnerabilities to unauthorized connections or impersonation attacks.  

### Encrypted Communication Verification  
- Verifies whether the communication between devices is encrypted.  
- Identifies devices that transmit sensitive data in plaintext or use weak encryption schemes  

---

## Installation

### 1. Clone the Repository

\`\`\`bash

git clone https://github.com/JahnaviGadde/bluetoothgui.git

cd bluetoothgui

### 2. Setup Local MongoDB

Download and install MongoDB from the official MongoDB website.

Start the MongoDB server:

mongod

Create a database and collection required for the project if not created during runtime.

### Backend

- Navigate to the backend directory:

  - cd backend

- Install dependencies:

  - npm install

- Start the backend server with elevated permissions:

  - sudo npm start

### Frontend

- Navigate to the frontend directory:

  - cd frontend

- Install dependencies:

  - npm install

- Start the frontend server:

  - npm start

### Python Libraries to be installed:

- Pyshark

- Dbus

- Bluetooth

Ensure MongoDB is running locally before starting the backend.

Use sudo for backend commands as it may require elevated permissions.

Open the frontend in your browser at http://localhost:3000 after running npm start.


# Manual Steps for Running the Bluetooth GUI Project

## Setup
1. Clone the repository and navigate to the `bluetoothgui` directory.
2. Navigate to the backend Python scripts directory:
   ```bash
   cd backend/routes/pythonfiles
   ```
   
   All Python script files used for this project are available in this directory.

## Note
- Replace `XX:XX:XX:XX` with the Bluetooth device MAC address in the commands below.

---

## Commands

### 1. **Bluetooth Device Scanner**
   ```bash
   python devicescan.py
   ```

### 2. **Bluetooth Device Details Scan**
   ```bash
   python details.py XX:XX:XX:XX
   ```

### 3. **Operating System Identification**
   ```bash
   python operatingsys.py XX:XX:XX:XX
   ```

### 4. **OS Version Prediction**
   ```bash
   bash final.sh XX:XX:XX:XX
   ```

### 5. **DOS Attack**
   ```bash
   python dos.py XX:XX:XX:XX
   ```

### 6. **MAC Spoofing**

   1. Ensure the correct Bluetooth interface of the connected Bluetooth dongle is specified in line 7 of `spoof_mac.py`:
      ```python
      result = subprocess.run(['sudo', 'spooftooph', '-i', 'hci1', '-a', bd_addr], check=True, capture_output=True, text=True)
      ```

   2. Execute the script:
      ```bash
      python spoof_mac.py XX:XX:XX:XX
      ```

---

## Encrypted Communication Verification

1. Remove/forget the device you want to verify from your Linux computer.
2. Run the command:
   ```bash
   python encryption.py XX:XX:XX:XX
   ```
3. While the `encryption.py` script is running, connect the device to your Linux computer.

