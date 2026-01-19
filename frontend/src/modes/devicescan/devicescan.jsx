import "./devicescan.css";
import { useState , useEffect} from "react";
import axios from "axios";
import Table from 'react-bootstrap/Table';
import { mergeDevices } from "./devicescanfunctions";

export default function Devicescan() {
    const [devicescan , setDevicescan] = useState();
    const [scanning, setScanning] = useState(false);
  
    useEffect(() => {
        if (scanning) {
            const intervalId = setInterval(() => {
                scanDevices();
            }, 2000); 
            
            return () => clearInterval(intervalId);
        }
        // eslint-disable-next-line 
    }, [scanning]);
    
    useEffect(() => {
        if(devicescan){
            saveDevices();
           }
           // eslint-disable-next-line
    }, [devicescan]);

    const scanDevices = async () =>{
        const res = await axios.get("http://localhost:4000/api/devicescan");
        const currentData = res.data.output[0];
        if(currentData && currentData.length > 0){
            const date = new Date();
            date.setMilliseconds(0);
            const time = date.getTime();
            const timestamp = time - 2000;
            const timestamp1 = JSON.stringify(timestamp)
            // eslint-disable-next-line
            const res1 = await axios.get("http://localhost:4000/api/devicescan/prev/" + `${timestamp1}`);        
            let prevData;
            if (res1 && res1.data && res1.data.length > 0 && res1.data[0].devices) {
                prevData = res1.data[0].devices;
                // eslint-disable-next-line
                await axios.delete("http://localhost:4000/api/devicescan/prev/" + `${timestamp1}`)
            } else {
                prevData = []; 
            }
        
            if(prevData && prevData.length > 0 ){
                const mergedevices = mergeDevices(prevData , currentData);
                setDevicescan(mergedevices)
            }
            else{
                setDevicescan(currentData)
            }
        } 
    
    }

    const saveDevices = async () =>{
        const time = new Date().setMilliseconds(0);
        const dataToSend = {
            timestamp: time, 
            devices: devicescan
        };
        
        await axios.post("http://localhost:4000/api/devicescan/", dataToSend);   
    }

     const toggleScanning = () => {
        setScanning(prevState => !prevState);
    };
     

    return ( 
    <div className="modes">
        <div className="devicescan_child">
            <h4>Devices scan</h4>
                <button onClick={toggleScanning}>
                        {scanning ? 'Stop Scanning' : 'Start Scanning'}
                    </button>
            <div className="deviceslist">
                <Table className="devicescan_table" >
                <thead>
                    <tr>
                    <th>Timestamp</th>   
                    <th>Device name</th>
                    <th>Address</th>
                    <th>RSSI</th>
                    <th>Estimated distance (m)</th>
                    </tr>
                </thead>
                    <tbody>
                        {Array.isArray(devicescan) && devicescan.length > 0 ? (
                            devicescan.map((d, index) => (
                            <tr key={index} className="eachdevice">
                                <td>{d.timestamp}</td>
                                <td>{d.devicename}</td>
                                <td>{d.address}</td>
                                <td>{d.rssi}</td>
                                <td>{d.distance}</td>
                            </tr>
                            ))
                        ) : (
                            <tr>
                            <td colSpan="6">No devices found</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </div>
    </div>
    )
}