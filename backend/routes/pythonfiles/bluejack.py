import bluetooth
from PyOBEX.client import Client
from PyOBEX.responses import *
import sys
import os
import argparse
import subprocess
import time
import random
import string
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Operation timed out")

# -----------------------------------------------------------------------------
# Helper Function: Generate Random Name
# -----------------------------------------------------------------------------
def generate_random_name(length=8):
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for i in range(length))

# -----------------------------------------------------------------------------
# Helper Function: Set Local Bluetooth Name
# -----------------------------------------------------------------------------
def set_local_bluetooth_name(name, adapter_interface="hci0"):
    print(f"\nAttempting to set local Bluetooth adapter name to: '{name}'")
    if subprocess.call(['which', 'bluetoothctl'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
        print("Error: 'bluetoothctl' command not found. Cannot set adapter name.")
        return False
    commands_str = f"""system-alias {name}
exit
"""
    success = False
    try:
        process = subprocess.Popen(['bluetoothctl'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(input=commands_str, timeout=10)
        if "alias changed" in stdout.lower() or "alias setting succeeded" in stdout.lower(): # Adjusted success check
            print(f"Successfully set Bluetooth name to '{name}'.")
            success = True
        elif "Failed to set alias" in stdout or "Failed to set alias" in stderr:
            print(f"Failed to set Bluetooth name. STDOUT:{stdout}STDERR:{stderr}")
        else:
            print(f"Bluetoothctl output for name change inconclusive. Assuming potential success/failure. STDOUT:{stdout}STDERR:{stderr}")
            success = True # Proceed cautiously
    except subprocess.TimeoutExpired:
        print("Timed out waiting for bluetoothctl to set the name.")
    except Exception as e:
        print(f"An error occurred while trying to set Bluetooth name: {e}")
    if success: time.sleep(0.5)
    return success

# -----------------------------------------------------------------------------
# execute_bluetoothctl_commands function (remains the same as your last version)
# -----------------------------------------------------------------------------
def execute_bluetoothctl_commands(device_address):
    print(f"Attempting to prepare, pair, and trust device: {device_address} using bluetoothctl.")
    print("IMPORTANT: Please make the target device discoverable and ready to pair.")
    print("You will need to confirm any pairing prompts on the target device within ~60-90 seconds after this script proceeds.")

    commands_str = f"""power on
agent on
default-agent
remove {device_address}
scan on
pair {device_address}
trust {device_address}
scan off
exit
"""
    print("\n[bluetoothctl] Will attempt the following command sequence:")
    print("----------------------------------------------------")
    print(commands_str.strip())
    print("----------------------------------------------------")
    print("[bluetoothctl] Initiating interaction... Please monitor your target device for pairing prompts.")

    try:
        process = subprocess.Popen(['bluetoothctl'],
                                   stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE,
                                   text=True,
                                   bufsize=1)
        stdout, stderr = process.communicate(input=commands_str, timeout=90)
        full_output = "STDOUT:\n" + stdout + "\nSTDERR:\n" + stderr
        print("\n[bluetoothctl] Interaction log:")
        print("----------------------------------------------------")
        print(full_output.strip())
        print("----------------------------------------------------")

        if "Pairing successful" in stdout:
            print("[bluetoothctl] Pairing reported as successful.")
            if "trust succeeded" in stdout.lower() or f"Trusted: yes" in stdout:
                 print("[bluetoothctl] Trust reported as successful.")
            return True
        elif "Device already paired" in stdout or "already connected" in stdout:
            print("[bluetoothctl] Device reported as already paired or connected.")
            return True
        elif "Failed to pair" in stdout or "Failed to pair" in stderr:
            print("[bluetoothctl] Pairing failed according to bluetoothctl output.")
            return False
        elif "Device not available" in stderr or "org.bluez.Error.DoesNotExist" in stderr:
            print("[bluetoothctl] Error: Device not available or does not exist. Ensure it's discoverable and in range.")
            return False
        else:
            print("[bluetoothctl] Pairing status uncertain from output. Will proceed with OBEX attempt.")
            return True # Or False if you want to be stricter
    except subprocess.TimeoutExpired:
        print("[bluetoothctl] Timed out waiting for bluetoothctl commands to complete.")
        return False
    except Exception as e:
        print(f"[bluetoothctl] An error occurred during bluetoothctl interaction: {e}")
        return False

# -----------------------------------------------------------------------------
# find_opp_service_channel function (remains the same)
# -----------------------------------------------------------------------------
def find_opp_service_channel(device_address):
    print(f"\nSearching for OBEX Object Push service on {device_address}...")
    uuid = "00001105-0000-1000-8000-00805f9b34fb"
    try:
        services = bluetooth.find_service(address=device_address, uuid=uuid)
    except bluetooth.btcommon.BluetoothError as e:
        print(f"Bluetooth error while searching for services: {e}")
        return None
    if not services:
        print(f"OBEX Object Push service NOT found on {device_address}.")
        return None
    for service in services:
        if service["protocol"] == "RFCOMM":
            print(f"Found OPP service on channel {service['port']}")
            return service["port"]
    print(f"OBEX Object Push service found, but no RFCOMM channel specified.")
    return None

# -----------------------------------------------------------------------------
# send_file_via_obex function (with integrated random name setting)
# -----------------------------------------------------------------------------
def send_file_via_obex(device_address, file_path):
    if not os.path.exists(file_path):
        print(f"Error: File not found at '{file_path}'")
        return False

    file_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)

    print(f"Reading file: '{file_name}' ({file_size} bytes)...")
    with open(file_path, 'rb') as f:
        file_content = f.read()

    max_retries = 3
    retry_delay = 2
    session_attempt_count = 0

    while session_attempt_count < max_retries:
        session_attempt_count += 1
        obex_client = None
        current_adapter_name = "N/A"
        print(f"\n--- OBEX Session Attempt #{session_attempt_count} for {device_address} ---")

        random_name_str = "DEV_" + generate_random_name(6)
        if set_local_bluetooth_name(random_name_str):
            current_adapter_name = random_name_str
        else:
            print("Warning: Failed to set random Bluetooth name. Proceeding with current name.")
        
        channel = find_opp_service_channel(device_address)
        if channel is None:
            print(f"Retrying service discovery in {retry_delay} seconds...")
            time.sleep(retry_delay)
            continue

        print(f"Targeting {device_address} on RFCOMM channel {channel} for file transfer...")
        try:
            print(f"Initializing OBEX Client for address {device_address}, port {channel}...")
            obex_client = Client(device_address, channel)

            # Set timeout for operations
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(30)  # 30 second timeout

            print("Attempting OBEX connection (Client will connect underlying socket)...")
            connect_response_object = obex_client.connect()
            print(f"OBEX connect() returned: {type(connect_response_object)} - {connect_response_object}")
            print("OBEX connection to transport layer seems successful.")

            print("Connected successfully, sending file...")
            put_response = obex_client.put(file_name, file_content)
            
            # Clear timeout
            signal.alarm(0)

            if isinstance(put_response, Success):
                print(f"File '{file_name}' sent successfully!")
                return True
            else:
                print(f"Failed to send file. Response: {put_response}")
                if session_attempt_count < max_retries:
                    print(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
                return False

        except TimeoutError:
            print("Operation timed out")
            signal.alarm(0)  # Clear the timeout
            if session_attempt_count < max_retries:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                continue
            return False

        except OSError as e:
            print(f"Connection error: {e}")
            if session_attempt_count < max_retries:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                continue
            return False
            
        except Exception as e:
            print(f"Unexpected error: {type(e).__name__}: {e}")
            if session_attempt_count < max_retries:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                continue
            return False
            
        finally:
            signal.alarm(0)  # Make sure to clear any pending timeout
            if obex_client:
                try:
                    obex_client.disconnect()
                except:
                    pass

    print("\nFailed to send file after maximum retries")
    return False

# -----------------------------------------------------------------------------
# __main__
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send a file to a Bluetooth device via OBEX Object Push, attempting to pair/trust first and retrying on decline with random sender name.")
    parser.add_argument("mac_address", help="MAC address of the target Bluetooth device (e.g., AA:BB:CC:11:22:33).")
    parser.add_argument("file_path", help="Path to the file to send.")
    parser.add_argument("-d", "--discover", action="store_true", help="Discover nearby Bluetooth devices (run before pairing attempt).")

    args = parser.parse_args()

    if args.discover:
        print("Discovering nearby devices (run this once to find MAC address if needed)...")
        # ... (discovery logic as before) ...
        try:
            nearby_devices = bluetooth.discover_devices(duration=8, lookup_names=True, flush_cache=True, lookup_class=False)
            if not nearby_devices: print("No devices found.")
            else:
                print("Found devices:")
                for addr, name_dev in nearby_devices: print(f"  {addr} - {name_dev}") # Renamed 'name' to 'name_dev'
        except bluetooth.btcommon.BluetoothError as e:
            print(f"Error during discovery: {e}. Try running with sudo or check Bluetooth service.")
        print("-" * 30)


    pairing_successful = execute_bluetoothctl_commands(args.mac_address)
    if not pairing_successful:
        print("\nPairing/trusting process with bluetoothctl indicated failure or timed out.")
        print("Proceeding to OBEX attempt, but it is likely to fail if not properly paired/trusted.")
    else:
        print("\nBluetoothctl pairing/trusting process seems to have completed. Proceeding with file send.")

    print("Waiting 2 seconds before starting OBEX operations...")
    time.sleep(2)

    print(f"\nAttempting to send '{args.file_path}' to {args.mac_address} via OBEX (will retry on decline)...")
    if not send_file_via_obex(args.mac_address, args.file_path):
        print("\nFile sending definitively failed after attempts or due to unrecoverable error.")
        sys.exit(1)
    else:
        print("\nFile sending operation reported as successful.")
        sys.exit(0)