import pyshark

def check_encryption(mac_address):
    encrypted_communication = False
    interface = 'bluetooth0'  # Adjust this as per your system's Bluetooth interface

    try:
        # Set up a live capture filtering Bluetooth traffic related to the given MAC address
        capture_filter = f'bluetooth.addr == {mac_address}'
        cap = pyshark.LiveCapture(interface=interface, bpf_filter=capture_filter, display_filter='bthci_cmd')

        print("Start pairing your device now...")

        for packet in cap.sniff_continuously(packet_count=100):  # Adjust packet_count as needed
            # Check the HCI command name or opcode for Link Key Request Reply
            print(packet);
            if hasattr(packet, 'bthci_cmd') and packet.bthci_cmd.opcode == '0x040b':
                encrypted_communication = True
                print("Link Key Request Reply found in packet number:", packet.number)
                break  # Stop after finding encryption evidence

    except Exception as e:
        print(f"An error occurred: {e}")
        cap.close()
        return encrypted_communication

    cap.close()
    return encrypted_communication

# Prompt user for the MAC address of the device
mac_address = input("Enter the MAC address of the Bluetooth device: ")

if check_encryption(mac_address):
    print("Bluetooth communication is encrypted.")
else:
    print("Bluetooth communication is not encrypted.")

