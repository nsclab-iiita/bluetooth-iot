import './App.css';
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

function App() {
  return (
    <div className="App">
      <Heading/>
     <Devicescan/>
     <Connect/>
     <Disconnect/>
     <Devicedetails/>
     <Dos/>
     <Spoofing/>
     <Operatingsys/>
     <Osversion/>
     <Rtt/>
     <Encryptrion/>
     <DataManagement/>
    </div>
  );
}

export default App;
