import dbus
import time
import subprocess
import sys
import json
import re


def connect_to_bluetooth_device(device_mac):
    bus = dbus.SystemBus()
    manager_obj = bus.get_object('org.bluez', '/')
    manager_iface = dbus.Interface(manager_obj, 'org.freedesktop.DBus.ObjectManager')
    adapter_iface = None
    objects = manager_iface.GetManagedObjects()
    for obj_path, interfaces in objects.items():
        if 'org.bluez.Adapter1' in interfaces.keys():
            adapter_iface = dbus.Interface(bus.get_object('org.bluez', obj_path), 'org.bluez.Adapter1')
            break
    adapter_props_iface = dbus.Interface(bus.get_object('org.bluez', obj_path), 'org.freedesktop.DBus.Properties')
    adapter_props = adapter_props_iface.GetAll('org.bluez.Adapter1')
    if not adapter_props['Powered']:
        adapter_props_iface.Set('org.bluez.Adapter1', 'Powered', dbus.Boolean(True))
    device_path = None
    for obj_path, interfaces in objects.items():
        if 'org.bluez.Device1' in interfaces.keys():
            device_props_iface = dbus.Interface(bus.get_object('org.bluez', obj_path), 'org.freedesktop.DBus.Properties')
            device_props = device_props_iface.GetAll('org.bluez.Device1')
            if device_props['Address'] == device_mac:
                device_path = obj_path
                break
    if device_path:
        device_iface = dbus.Interface(bus.get_object('org.bluez', device_path), 'org.bluez.Device1')
        device_props_iface = dbus.Interface(bus.get_object('org.bluez', device_path), 'org.freedesktop.DBus.Properties')
        device_props = device_props_iface.GetAll('org.bluez.Device1')
        if not device_props['Connected']:
            try:
                device_iface.Connect()
            except dbus.exceptions.DBusException as e:
                print("Failed to connect to the Bluetooth device:", str(e))   


def disconnect_bluetooth_device():
    bus = dbus.SystemBus()
    manager = dbus.Interface(bus.get_object("org.bluez", "/"), "org.freedesktop.DBus.ObjectManager")
    objects = manager.GetManagedObjects()
    device_path = None
    for path, interfaces in objects.items():
        if "org.bluez.Device1" in interfaces.keys():
            properties = dbus.Interface(bus.get_object("org.bluez", path), "org.freedesktop.DBus.Properties")
            if properties.Get("org.bluez.Device1", "Connected"):
                device_path = path
                break

    if device_path:
        device_iface = dbus.Interface(bus.get_object('org.bluez', device_path), 'org.bluez.Device1')
        device_iface.Disconnect()

def get_service_uuids(device_mac):
    output = subprocess.check_output(['sdptool', 'browse', device_mac]).decode('utf-8')
    return output

def find_os(service_details):
    words = service_details.split()
    if "Android" in words:
        return "Android"
    elif "MAS-iOS" in words:
        return "iOS"
    elif "BlueZ" in words:
        return "Linux"
    elif "COM5" in words:
        return "MacOS"
    elif "Hoc" in words:
        return "Windows"
    else:
        return "None"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <device_address>")
        sys.exit(1)
    
    device_address = sys.argv[1] 
    
    connect_to_bluetooth_device(device_address) 
    service_details = get_service_uuids(device_address)
    operating_system = find_os(service_details)
    print(operating_system)
    #disconnect_bluetooth_device()
