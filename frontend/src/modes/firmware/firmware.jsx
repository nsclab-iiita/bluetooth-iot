import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { updateForm } from "../../redux/actions";
import { useState, useEffect } from "react";

export default function FirmwareDetection() {
  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();
  const [cve, setCve] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [deviceInfoService, setDeviceInfoService] = useState("");
  const [rawOutput, setRawOutput] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset all data when component mounts (on page refresh)
  useEffect(() => {
    dispatch(updateForm('FirmwareVersion', ''));
    setCve([]);
    setConnectionStatus('');
    setDeviceInfoService('');
    setRawOutput('');
    setLoading(false);
  }, [dispatch]);

  const fetchFirmwareVersion = async (event) => {
    event.preventDefault();
    const macAddress = event.target.elements.macAddress.value;
    
    if (!macAddress.trim()) {
      alert('Please enter a valid BLE MAC address');
      return;
    }

    setLoading(true);
    try {
      console.log(`Starting BLE firmware detection for MAC: ${macAddress}`);
      const res = await axios.get(`http://localhost:4000/api/firmware/${macAddress}`);
      console.log('Firmware detection response received:', res.data);

      // Update form state
      dispatch(updateForm('FirmwareVersion', res.data.firmware_version));
      
      // Set BLE connection and service detection data
      setConnectionStatus(res.data.connection_status || 'Unknown');
      setDeviceInfoService(res.data.device_info_service || 'Unknown');
      setRawOutput(res.data.raw_output || '');

      // Set CVE list
      setCve(res.data.cve_list || []);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error detecting firmware version: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modes">
      <h3>Firmware Version Detection in BLE Devices</h3>
      <form onSubmit={fetchFirmwareVersion}>
        <label>
          BLE MAC Address:
          <input
            type="text"
            name="macAddress"
            placeholder="XX:XX:XX:XX:XX:XX"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Detecting...' : 'Submit'}
        </button>
      </form>
      
      {loading && (
        <div className="text-center mt-3">
          <div className="spinner-border" role="status">
            {/* <span className="sr-only">Loading...</span> */}
          </div>
          <p>Compiling and running BLE firmware detection...</p>
        </div>
      )}

      <div id="datadiv">
        {form.FirmwareVersion ? (
          <>
            <div className="card mt-3">
              <div className="card-header">
                <h5>BLE Firmware Detection Results</h5>
              </div>
              <div className="card-body">
                <h6><strong>Detected Firmware Version:</strong> {form.FirmwareVersion}</h6>
{/*                 
                {connectionStatus !== 'Unknown' && (
                  <p><strong>BLE Connection Status:</strong> 
                    <span className={`ms-2 badge ${connectionStatus === 'Connected' ? 'bg-success' : 'bg-danger'}`}>
                      {connectionStatus}
                    </span>
                  </p>
                )}
                
                {deviceInfoService !== 'Unknown' && (
                  <p><strong>Device Information Service:</strong> 
                    <span className={`ms-2 badge ${deviceInfoService === 'Found' ? 'bg-success' : 'bg-warning'}`}>
                      {deviceInfoService}
                    </span>
                  </p>
                )} */}
              </div>
            </div>

            <div className="card mt-3">
              <div className="card-header">
                <h6>Security Vulnerabilities (CVEs)</h6>
              </div>
              <div className="card-body">
                {cve.length > 0 ? (
                  <div>
                    <p><strong>Top {cve.length} CVEs found for this firmware version:</strong></p>
                    <ul>
                      {cve.map((cveId, index) => (
                        <li key={index} className="mb-2">
                          <a 
                            href={`https://www.cve.org/CVERecord?id=${cveId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                          >
                            <strong>{cveId}</strong>
                          </a>
                          {' | '}
                          <a 
                            href={`https://nvd.nist.gov/vuln/detail/${cveId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                          >
                            NVD Details
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted">No CVEs found for this firmware version</p>
                )}
              </div>
            </div>

            {rawOutput && (
              <div className="card mt-3">
                <div className="card-header">
                  <h6>Detection Process Output</h6>
                </div>
                <div className="card-body">
                  <pre className="bg-light p-3 small" style={{maxHeight: '300px', overflow: 'auto'}}>
                    {rawOutput}
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          !loading && <p>Enter a BLE MAC address and click Submit to start firmware version detection</p>
        )}
      </div>
    </div>
  );
}
