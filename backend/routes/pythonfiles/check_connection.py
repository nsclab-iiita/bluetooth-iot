import dbus
import sys

def get_device_by_address(address):
    bus = dbus.SystemBus()
    
    # Access the BlueZ service
    manager = dbus.Interface(bus.get_object("org.bluez", "/"),
                             "org.freedesktop.DBus.ObjectManager")

    # Get all managed objects
    objects = manager.GetManagedObjects()

    for path, ifaces in objects.items():
        if "org.bluez.Device1" in ifaces:
            device = ifaces["org.bluez.Device1"]
            if device.get("Address") == address:
                return {
                    "Name": device.get("Name", "Unknown"),
                    "Address": device.get("Address", "Unknown"),
                    "Connected": device.get("Connected", False),
                    "Path": path
                }

    return None

def main():
    if len(sys.argv) != 2:
        return 0

    address = sys.argv[1]
    device = get_device_by_address(address)

    if device:
        if device["Connected"]:
            print(1)
            return 1
        else:
            print(0)
            return 0
    else:
        print(0)
        return 0

if __name__ == "__main__":
    status = main()
    sys.exit(status)

