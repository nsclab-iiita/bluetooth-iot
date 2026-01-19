from datetime import datetime
from pathlib import Path
import pydbus
from gi.repository import GLib
import math
import json
import random

discovery_time = 2
discovered_devices = []

# Reference signal strength at 1 meter, path-loss exponent, and standard deviation for shadow fading
reference_rssi_at_1m = -50
path_loss_exponent = 2.0

def calculate_distance(rssi):
    """Calculate distance based on RSSI using the Friis transmission equation"""
    return 10**((reference_rssi_at_1m - rssi) / (10 * path_loss_exponent))

def write_to_log(address, name, rssi, distance):
    """Write device name, address, rssi, and distance values to a log file"""
    now = datetime.now()
    current_time = now.strftime('%H:%M:%S')
    rounded_distance = round(distance, 2) 
    if not name:
        name = "Not available"
    discovered_devices.append({
        'timestamp' : current_time,
        'devicename': name,
        'address': address,
        'rssi': rssi,
        'distance': rounded_distance
    })

bus = pydbus.SystemBus()
mainloop = GLib.MainLoop()

class DeviceMonitor:
    """Class to represent remote Bluetooth devices discovered"""
    def __init__(self, path_obj):
        self.device = bus.get('org.bluez', path_obj)
        device_props = self.device.GetAll('org.bluez.Device1')
        rssi = device_props.get('RSSI')
        address = device_props.get('Address')
        name = device_props.get('Name')
        if rssi:
            distance = calculate_distance(rssi)
            write_to_log(address, name, rssi, distance)

def end_discovery():
    """Method called at the end of the discovery scan"""
    mainloop.quit()
    adapter.StopDiscovery()

def new_iface(path, iface_props):
    """If a new DBus interface is a device, add it to be monitored"""
    device_addr = iface_props.get('org.bluez.Device1', {}).get('Address')
    if device_addr:
        print(device_addr)
        DeviceMonitor(path)

def save_to_json(devices):
    json_data = json.dumps(devices, indent=4)
    print(json_data)

# BlueZ object manager
mngr = bus.get('org.bluez', '/')
mngr.onInterfacesAdded = new_iface

# Connect to the DBus API for the Bluetooth adapter
adapter = bus.get('org.bluez', '/org/bluez/hci0')
adapter.DuplicateData = False

# Iterate around already known devices and add to monitor
mng_objs = mngr.GetManagedObjects()
for path in mng_objs:
    device = mng_objs[path].get('org.bluez.Device1', {}).get('Address', [])
    if device:
        DeviceMonitor(path)

save_to_json(discovered_devices)
GLib.timeout_add_seconds(discovery_time, end_discovery)
mainloop.run()
