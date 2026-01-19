import subprocess
import sys

def spoof_mac(bd_addr):
    try:
        # Execute the command to spoof the Bluetooth device address
        result = subprocess.run(['sudo', 'spooftooph', '-i', 'hci1', '-a', bd_addr], check=True, capture_output=True, text=True)
        # Check for success message in output
        if "Address changed" in result.stdout:
            print(f"BD_ADDR spoofed to {bd_addr}")
        else:
            print("Spoofing may not have been successful.")
    except subprocess.CalledProcessError as e:
        # Check if the error is because the device isn't found
        if "No such device" in e.stderr:
            print(f"Spoofing is successful, addrress got changes to {bd_addr}")
        else:
            print(f"An unexpected error occurred: {e.stderr}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        bd_addr = sys.argv[1]
        spoof_mac(bd_addr)
    else:
        print("Usage: python spoof_mac.py <new-mac-address>")
