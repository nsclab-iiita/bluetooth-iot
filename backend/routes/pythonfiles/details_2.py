# Modified details.py with custom low level C code to display the details of the connected bluetooth device
# sdptool still used for extracting protocols
import subprocess
import sys
import json
import re
import os

def extract_protocols(sdptool_output):
    version_re = re.compile(r'Profile Descriptor List:\s*"([^"]+)"\s*\((.*?)\)\s*Version:\s*0x([0-9a-fA-F]+)')
    protocols = []

    for match in version_re.finditer(sdptool_output):
        profile_name = match.group(1)
        profile_id = match.group(2)
        version_hex = match.group(3)
        protocols.append({'Profile': profile_name, 'Version': f"0x{version_hex}"})

    return protocols

def get_device_info(device_address):
    script_dir = os.path.dirname(os.path.realpath(__file__))
    btinfo_path = os.path.join(script_dir, "btinfo2")
    result_c = subprocess.run([btinfo_path, device_address], capture_output=True, text=True)
    result_sdptool = subprocess.run(["sdptool", "browse", device_address], capture_output=True, text=True)

    device_details = {}
    uuids = []

    for line in result_c.stdout.strip().splitlines():
        if '=' not in line:
            continue
        key, value = line.strip().split('=', 1)
        if key == "UUID":
            uuids.append(value)
        else:
            device_details[key] = value

    if uuids:
        device_details["UUID"] = uuids

    # Inject extracted protocols
    protocols = extract_protocols(result_sdptool.stdout)
    device_details["Protocols"] = protocols

    return device_details

def format_to_json(device_details):
    attributes = [
        "BDAddress", "OUIcompany", "Devicename", "LMPversion", "Manufacturer",
        "Class", "Icon", "Modalias", "RSSI", "BatteryPercentage", "Paired",
        "Trusted", "Blocked", "Connected", "LegacyPairing", "UUID", "Protocols"
    ]

    output = {}
    for attr in attributes:
        output[attr] = device_details.get(attr, "Not available")

    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python details_2.py <device_address>")
        sys.exit(1)

    device_address = sys.argv[1]
    device_details = get_device_info(device_address)
    format_to_json(device_details)

