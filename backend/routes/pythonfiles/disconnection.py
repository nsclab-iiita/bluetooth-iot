import dbus
import sys

def disconnect_bluetooth_device(mac_address):
    bus = dbus.SystemBus()
    manager = dbus.Interface(bus.get_object("org.bluez", "/"), "org.freedesktop.DBus.ObjectManager")
    objects = manager.GetManagedObjects()

    device_path = None

    # Find the device with the specified MAC address
    for path, interfaces in objects.items():
        if "org.bluez.Device1" in interfaces.keys():
            properties = dbus.Interface(bus.get_object("org.bluez", path), "org.freedesktop.DBus.Properties")
            address = properties.Get("org.bluez.Device1", "Address")
            if address == mac_address:
                device_path = path
                break

    # Handle device connection state
    if device_path:
        device_iface = dbus.Interface(bus.get_object('org.bluez', device_path), 'org.bluez.Device1')
        try:
            device_iface.Disconnect()
            return True  # Successfully disconnected
        except dbus.exceptions.DBusException as e:
            print(f"Failed to disconnect: {e}")
            return False  # Failed to disconnect
    else:
        return False  # No device with the specified MAC address found

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 disconnection.py <MAC_ADDRESS>")
        sys.exit(1)

    mac_address = sys.argv[1]
    success = disconnect_bluetooth_device(mac_address)
    if success:
        print("Disconnection successful.")
    else:
        print("No connected device found with the specified MAC address or failed to disconnect.")

