import axios from "axios";
import { useState } from "react";

export default function Osversion() {
  // All scan results are now in local state
  const [osVersion, setOsVersion] = useState("");
  const [cve, setCve] = useState([]);
  
  // State for loading and error UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOSversion = async (event) => {
    event.preventDefault();
    const macAddress = event.target.elements.macAddress.value;

    // Reset state before new request
    setIsLoading(true);
    setError(null);
    setOsVersion(""); // Reset local state for OS version
    setCve([]);
    
    try {
      const res = await axios.get(`http://localhost:4000/api/osversion/${macAddress}`);
      
      // Update local state with data from the API
      setOsVersion(res.data.os_version);
      setCve(res.data.cve_list);

    } catch (err) {
      console.error('Error fetching OS version:', err);
      setError('Failed to retrieve data. Please check the MAC address and ensure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modes">
      <h3>Operating System & Vulnerability Scan</h3>
      <form onSubmit={fetchOSversion}>
        <label>
          Bluetooth MAC Address:
          <input
            type="text"
            name="macAddress"
            placeholder="e.g., 00:11:22:33:FF:EE"
            required
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Scanning...' : 'Start Scan'}
        </button>
      </form>

      <div id="datadiv">
        {isLoading && <p>Scanning... This may take up to a minute.</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {/* This now checks the local osVersion state */}
        {osVersion && !isLoading && (
          <>
            <h4>Scan Results:</h4>
            {/* This now displays the local osVersion state */}
            <p><strong>Estimated OS Version:</strong> {osVersion}</p>
            
            <div>
              <h5>Top 3 Recent CVEs:</h5>
              {cve.length > 0 ? (
                <ul>
                  {cve.map((cveId, index) => (
                    <li key={index}>
                      <a href={`https://www.cve.org/CVERecord?id=${cveId}`} target="_blank" rel="noopener noreferrer">
                        {cveId}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No relevant CVEs found for this version.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}