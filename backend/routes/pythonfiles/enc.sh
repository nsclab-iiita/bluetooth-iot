#!/bin/bash

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Please run this script as root or using sudo."
    exit 1
fi

# Run Wireshark with sudo (requires password entry)
sudo wireshark &

# Sleep for a moment to allow Wireshark to start
sleep 2

# Capture Bluetooth traffic using tshark (CLI version of Wireshark)
sudo tshark -i bluetooth0 -c 100 -w capture.pcap

# Check if encryption evidence was found in the captured packets
if sudo tshark -r capture.pcap -Y "bthci_cmd.opcode == 0x040b" | grep -q "Link Key Request Reply"; then
    echo "Bluetooth communication is encrypted."
else
    echo "Bluetooth communication is not encrypted."
fi

# Cleanup: Remove the temporary capture file
rm -f /tmp/capture.pcap

