import React from 'react';

const BluetoothToggle = () => {
  const toggleBluetooth = async (state) => {
    try {
      const response = await fetch(`http://localhost:4000/api/bluetooth/${state}`, {
        method: 'POST',
      });
      const data = await response.json();
      alert(data.message);
    } catch (err) {
      console.error("Bluetooth toggle error:", err);
      alert("Failed to toggle Bluetooth.");
    }
  };

  return (
    <div style={{ marginTop: '20px', marginLeft: '175px'}}>
      <button onClick={() => toggleBluetooth('on')} style={styles.buttonOn}>Turn Bluetooth ON</button>
      <button onClick={() => toggleBluetooth('off')} style={styles.buttonOff}>Turn Bluetooth OFF</button>
    </div>
  );
};

const styles = {
  buttonOn: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    marginRight: '1px',
    cursor: 'pointer',
  },
  buttonOff: {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  }
};

export default BluetoothToggle;
