import json
import asyncio
import bluetooth
from bleak import BleakScanner

async def scan_ble_devices():
    devices = await BleakScanner.discover()
    ble_devices = [{"devicename": device.name, "address": str(device.address)} for device in devices]
    return ble_devices

if __name__ == "__main__":
   
    ble_devices = asyncio.run(scan_ble_devices())
    
    # Combine Bluetooth and BLE devices into the same list
    all_devices = ble_devices
    
    # Convert the list to JSON format
    json_data = json.dumps(all_devices, indent=4)
    
    # Output the JSON data
    print(json_data)
