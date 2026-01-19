import os
import subprocess
import pyshark
import sys
import time

def scan_and_capture_bluetooth_packets(output_file, duration=150):
    try:
        # Start btmon process with sudo to capture packets
        btmon_process = subprocess.Popen(
            ["sudo", "btmon", "-w", output_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        print(f"Capturing Bluetooth packets for {duration} seconds...")
        time.sleep(duration)

        # Terminate btmon process after timeout
        btmon_process.terminate()

        print(f"Bluetooth packets captured and saved to {output_file}")
    except Exception as e:
        print(f"An error occurred while scanning and capturing Bluetooth packets: {e}")

def check_encryption(pcapng_file):
    encrypted_communication = False
    protocols_involved = set()

    try:
        cap = pyshark.FileCapture(pcapng_file, display_filter='bthci_evt')

        for packet in cap:
            if hasattr(packet, 'bthci_cmd') and packet.bthci_cmd.opcode == '0x01':
                encrypted_communication = True
                protocols_involved.add('bthci_cmd')
                print(f"Encryption-related HCI command (0x01) found in packet number: {packet.number}")
            if hasattr(packet, 'bthci_evt') and packet.bthci_evt.code == '0x08':
                encrypted_communication = True
                protocols_involved.add('bthci_evt')
                print(f"Encryption Change Event (0x08) found in packet number: {packet.number}")
            if hasattr(packet, 'btl2cap') and (packet.btl2cap.channel_id == '0x0001' or packet.btl2cap.control != '0x00'):
                encrypted_communication = True
                protocols_involved.add('btl2cap')
                print(f"L2CAP Signaling Channel found in packet number: {packet.number}")

    except Exception as e:
        print(f"An error occurred: {e}")

    cap.close()
    return encrypted_communication, protocols_involved

def main():
    if len(sys.argv) < 2:
        print("Usage: python script_name.py [MAC_ADDRESS]")
        sys.exit(1)

    mac_address = sys.argv[1]  # Get the MAC address from command-line arguments

    pcapng_file = 'captured_packets.pcapng'  # File to save the captured packets

    # Step 1: Scan and capture Bluetooth packets for 1 minute (60 seconds)
    scan_and_capture_bluetooth_packets(pcapng_file, duration=150)

    # Step 2: Check if the captured packets indicate encrypted communication
    encrypted, protocols = check_encryption(pcapng_file)
    if encrypted:
        print("Bluetooth communication is encrypted.")
        print(f"Protocols responsible for encryption: {', '.join(protocols)}")
    else:
        print("Bluetooth communication is not encrypted.")

if __name__ == "__main__":
    main()
