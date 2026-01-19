# connect_bluetooth_device.py

import dbus
import sys

def connect_to_bluetooth_device(device_mac):
    bus = dbus.SystemBus()
    manager_obj = bus.get_object('org.bluez', '/')
    manager_iface = dbus.Interface(manager_obj, 'org.freedesktop.DBus.ObjectManager')
    adapter_iface = None
    objects = manager_iface.GetManagedObjects()

    # Find the first adapter
    for obj_path, interfaces in objects.items():
        if 'org.bluez.Adapter1' in interfaces.keys():
            adapter_iface = dbus.Interface(bus.get_object('org.bluez', obj_path), 'org.bluez.Adapter1')
            break

    # Ensure the adapter is powered on
    adapter_props_iface = dbus.Interface(bus.get_object('org.bluez', obj_path), 'org.freedesktop.DBus.Properties')
    adapter_props = adapter_props_iface.GetAll('org.bluez.Adapter1')
    if not adapter_props['Powered']:
        adapter_props_iface.Set('org.bluez.Adapter1', 'Powered', dbus.Boolean(True))

    # Find the device
    device_path = None
    for obj_path, interfaces in objects.items():
        if 'org.bluez.Device1' in interfaces.keys():
            device_props_iface = dbus.Interface(bus.get_object('org.bluez', obj_path), 'org.freedesktop.DBus.Properties')
            device_props = device_props_iface.GetAll('org.bluez.Device1')
            if device_props['Address'] == device_mac:
                device_path = obj_path
                break

    # Connect to the device
    if device_path:
        device_iface = dbus.Interface(bus.get_object('org.bluez', device_path), 'org.bluez.Device1')
        device_props_iface = dbus.Interface(bus.get_object('org.bluez', device_path), 'org.freedesktop.DBus.Properties')
        device_props = device_props_iface.GetAll('org.bluez.Device1')
        if not device_props['Connected']:
            try:
                device_iface.Connect()
                return True  # Successfully connecting
            except dbus.exceptions.DBusException:
                return False  # Failed to connect
        else:
            return True  # Already connected
    else:
        return False  # Device not found

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python connect_bluetooth_device.py <device_mac>")

    device_mac = sys.argv[1]
    success = connect_to_bluetooth_device(device_mac)
    if success:
        print("Connection successful.")
    else:
        print("Failed to connect.")
