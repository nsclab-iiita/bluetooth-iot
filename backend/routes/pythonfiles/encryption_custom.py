# File: encryption_custom.py
# Filter to use in pcapng file - bthci_evt.code == 0x08

import os
import subprocess
import pyshark
import sys
import time

MAX_HCI_PKT_SIZE = 262144  # 256 KB safety limit
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def scan_and_capture_bluetooth_packets(output_file, duration=30):
    try:
        minibtmon_path = os.path.join(SCRIPT_DIR, "minibtmon")  # absolute path

        btmon_process = subprocess.Popen(
            ["sudo", minibtmon_path, "-w", output_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        print(f"Capturing Bluetooth packets for {duration} seconds...")
        time.sleep(duration)

        btmon_process.terminate()

        # print(f"Bluetooth packets captured and saved to captured_packets_custom.pcapng")
    except Exception as e:
        print(f"An error occurred while scanning and capturing Bluetooth packets: {e}")



def check_encryption(pcapng_file):
    encrypted_communication = False
    protocols_involved = set()

    try:
        cap = pyshark.FileCapture(pcapng_file, display_filter="bthci_evt")

        for packet in cap:
            try:
                # Defensive: skip oversized or malformed packets
                if hasattr(packet, "length"):
                    pkt_len = int(packet.length)
                    if pkt_len > MAX_HCI_PKT_SIZE:
                        # print(f"Skipping oversized packet #{packet.number} ({pkt_len} bytes)")
                        continue

                if hasattr(packet, "bthci_cmd") and packet.bthci_cmd.opcode == "0x01":
                    encrypted_communication = True
                    protocols_involved.add("bthci_cmd")
                    # print(f"Encryption-related HCI command (0x01) in packet #{packet.number}")

                if hasattr(packet, "bthci_evt") and packet.bthci_evt.code in ("0x33", "0x36"):
                    encrypted_communication = True
                    protocols_involved.add("bthci_evt")
                    # print(f"Encryption Change Event ({packet.bthci_evt.code}) in packet #{packet.number}")

                if hasattr(packet, "btl2cap") and (
                    packet.btl2cap.channel_id == "0x0001"
                    or packet.btl2cap.control != "0x00"
                ):
                    encrypted_communication = True
                    protocols_involved.add("btl2cap")
                    # print(f"L2CAP Signaling Channel in packet #{packet.number}")

            except Exception as inner_e:
                # Skip malformed packet, avoid killing the loop
                # print(f"Skipping malformed packet: {inner_e}")
                continue

    except Exception as e:
        print(f"An error occurred during analysis: {e}")
    finally:
        try:
            cap.close()
        except Exception:
            pass

    return encrypted_communication, protocols_involved


def main():
    if len(sys.argv) < 2:
        print("Usage: python script_name.py [MAC_ADDRESS]")
        sys.exit(1)
        
    # print("Process Running")

    mac_address = sys.argv[1]

    pcapng_file = os.path.join(SCRIPT_DIR, "captured_packets_custom.pcapng")

    # Always start with a clean file
    if os.path.exists(pcapng_file):
        os.remove(pcapng_file)

    scan_and_capture_bluetooth_packets(pcapng_file, duration=30)

    encrypted, protocols = check_encryption(pcapng_file)
    if encrypted:
        print("Bluetooth communication is encrypted.")
        print(f"Protocols responsible: {', '.join(protocols)}")
    else:
        print("Bluetooth communication is not encrypted.")


if __name__ == "__main__":
    main()

