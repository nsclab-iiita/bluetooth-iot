import React from 'react';
import './disclaimer.css';

const Disclaimer = () => {
  return (
    <div className="disclaimer-box">
      <h5>Disclaimer: Bluetooth Tool</h5>
      <ul>
        <li><strong>Range:</strong> Bluetooth range may vary based on device and environment.</li>
        <li><strong>Proximity:</strong> Estimated proximity is based on RSSI and is not always precise.</li>
        <li><strong>RTT:</strong> RTT values may fluctuate due to network or hardware latency.</li>
      </ul>
    </div>
  );
};

export default Disclaimer;
