import React from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import Devicescan from './modes/devicescan/devicescan';
import Heading from './components/heading/heading';
import 'bootstrap/dist/css/bootstrap.min.css';
import Devicedetails from './modes/devicedetails/devicedetails';
import Operatingsys from './modes/operatingsys/operatingsys';
import Encryptrion from './modes/encryption/encryption';
import Dos from './modes/dos/dos';
import Spoofing from './modes/macspoof/macspoof';
import Osversion from './modes/OSversion/osversion';
import DataManagement from './modes/devicesave/devicesave';
import Connect from './modes/connection/connection';
import Disconnect from './modes/disconnection/disconnection';
import Rtt from './modes/rtt/rtt';
import Disclaimer from './components/disclaimer/disclaimer';
import Bluejack from './modes/bluejack/bluejack';
import FirmwareDetection from './modes/firmware/firmware'
import BluetoothToggle from './components/bluetoothbooton/bluebotton.jsx';
import MitmSection from './modes/mitm/mitmsection';
import MitmAttack from './modes/mitm/mitm';

// Home page component with all sections
function HomePage() {
  return (
    <div className="App">
      <Disclaimer />
      <Heading/>
      <BluetoothToggle />
     <Devicescan/>
     <Connect/>
     <Disconnect/>
     <Devicedetails/>
     <Osversion/>
     <FirmwareDetection/>
     <Rtt/>
     <Encryptrion/>
     <Dos/>
     <Spoofing/>
     <Bluejack/>
     <MitmSection/>
     <DataManagement/>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/mitm-attack" element={<MitmAttack />} />
    </Routes>
  );
}

export default App;
