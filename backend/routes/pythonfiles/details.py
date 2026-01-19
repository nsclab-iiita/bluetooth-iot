import subprocess
import sys
import json
import re

def extract_protocols(sdptool_output):
    # Regular expressions to match protocols and versions
    protocol_re = re.compile(r'Protocol Descriptor List:\s*(.*)')
    version_re = re.compile(r'Profile Descriptor List:\s*"([^"]+)"\s*\((.*?)\)\s*Version:\s*0x([0-9a-fA-F]+)')

    protocols = []

    # Find all protocol descriptor sections
    protocol_matches = protocol_re.search(sdptool_output)
    if protocol_matches:
        proto_list = protocol_matches.group(1)
        protocol_entries = re.findall(r'"([^"]+)"\s*\((.*?)\)', proto_list)
        for proto_name, proto_id in protocol_entries:
            protocols.append({'Profile': proto_name, 'Version': proto_id})

    # Find all profile descriptor sections for versions
    for match in version_re.finditer(sdptool_output):
        profile_name = match.group(1)
        profile_id = match.group(2)
        version_hex = match.group(3)
        version_dec = int(version_hex, 16)
        protocols.append({'Profile': profile_name, 'Version': profile_id})

    return protocols

def get_device_info(device_address):
    result_hcitool = subprocess.run(["hcitool", "info", device_address], capture_output=True, text=True)
    result_bluetoothctl = subprocess.run(["bluetoothctl", "info", device_address], capture_output=True, text=True)
    result_sdptool = subprocess.run(["sdptool", "browse", device_address], capture_output=True, text=True)

    protocols = extract_protocols(result_sdptool.stdout)
    

    output = [result_hcitool.stdout.strip(), result_bluetoothctl.stdout.strip()]

    parsed_info = {}
    uuids = []

    for out in output:
        lines = out.split("\n")
        for line in lines:
            if line.strip() != "":
                parts = line.split(":", 1)
                key = parts[0].strip().replace(" ", "_")
                value = parts[1].strip() if len(parts) > 1 else ""
                if key == "UUID":
                    uuids.append(value)
                else:
                    parsed_info[key] = value

    parsed_info["UUID"] = uuids
    parsed_info["Protocols"] = protocols
    return parsed_info

def format_to_json(device_details):
    attributes = ["BDAddress", "OUIcompany", "Devicename", "LMPversion", "Manufacturer", "Class", "Icon", "Modalias",
                  "RSSI", "BatteryPercentage", "Paired", "Trusted", "Blocked", "Connected", "LegacyPairing", "UUID" , "Protocols"]

    attribute_values = {}

    for attribute in attributes:
        if attribute in device_details:
            attribute_values[attribute] = device_details[attribute]
        elif attribute == "BDAddress":
            attribute_values[attribute] = device_details.get("BD_Address", "Not available")
        elif attribute == "Devicename":
            attribute_values[attribute] = device_details.get("Name", "Device Name")
        elif attribute == "LMPversion":
            attribute_values[attribute] = device_details.get("LMP_Version", "Not available")
        elif attribute == "BatteryPercentage":
            attribute_values[attribute] = device_details.get("Battery_Percentage", "Not available")
        elif attribute == "OUIcompany":
            attribute_values[attribute] = device_details.get("OUI_Company", "Not available")
        else:
            attribute_values[attribute] = "Not available"

    attribute_values_json = json.dumps(attribute_values, indent=2)
    print(attribute_values_json)

# Example usage
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <device_address>")
        sys.exit(1)

    device_address = sys.argv[1]

    device_details = get_device_info(device_address)
    format_to_json(device_details)
