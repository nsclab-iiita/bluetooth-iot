import pyshark

def capture_bluetooth_traffic(interface='bluetooth0'):
    try:
        # Set up a live capture on the specified Bluetooth interface
        cap = pyshark.LiveCapture(interface=interface, bpf_filter='bluetooth')

        print(f"Capturing Bluetooth traffic on interface '{interface}'. Press Ctrl+C to stop...")

        # Capture packets indefinitely
        for packet in cap.sniff_continuously():
            print(packet)  # Print packet details
            # You can process packets or perform actions based on your requirements here

    except KeyboardInterrupt:
        print("Capture stopped by user.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if 'cap' in locals():
            cap.close()  # Close the capture when done

# Run the capture function
capture_bluetooth_traffic()

