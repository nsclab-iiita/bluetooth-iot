export function mergeDevices(oldDevices, newDevices) {
    
    oldDevices = Array.isArray(oldDevices) ? oldDevices : [oldDevices];
    newDevices = Array.isArray(newDevices) ? newDevices : [newDevices];

    const mergedDevices = [];
    const oldDeviceMap = new Map(oldDevices.map(device => [device.address, device]));

    newDevices.forEach(newDevice => {
        const matchedOldDevice = oldDeviceMap.get(newDevice.address);
        
        if (matchedOldDevice) {
            mergedDevices.push({
                timestamp: matchedOldDevice.timestamp,
                devicename: matchedOldDevice.devicename,
                address: matchedOldDevice.address,
                rssi: newDevice.rssi,
                distance: newDevice.distance
            });
        } else {
            mergedDevices.push({
                timestamp: newDevice.timestamp,
                devicename: newDevice.devicename,
                address: newDevice.address,
                rssi: newDevice.rssi,
                distance: newDevice.distance
            });
        }
    });

    return mergedDevices;
}
