import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { updateForm } from "../../redux/actions";
import { useState } from "react";

export default function Osversion() {
  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();
  const [cve, setCve] = useState([]);
  const [maxresp , setMaxresp] = useState("");
  const[respperc , setRespperc] = useState("");
  const [meandiff , setMeandiff] = useState("");

  const fetchOSversion = async (event) => {
    event.preventDefault();
    const macAddress = event.target.elements.macAddress.value;
    try {
      
      const res = await axios.get(`http://localhost:4000/api/osversion/${macAddress}`);
      console.log(res);

      dispatch(updateForm('OsVersion', res.data.os_version));
      setMaxresp(res.data.max_response);
      setRespperc(res.data.response_perc);
      setMeandiff(res.data.mean_difference);

      setCve(res.data.cve_list);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="modes">
      <h3>Operating System Version</h3>
      <form onSubmit={fetchOSversion}>
        <label>
          MAC Address:
          <input
            type="text"
            name="macAddress"
          />
        </label>
        <button type="submit">Submit</button>
      </form>
      <div id="datadiv">
        {form.OsVersion ? (
          <>
            <p>{form.OsVersion}</p>
            <div>
              <h6>CVEs:</h6>
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
                <p>CVEs not retrieved yet</p>
              )}
            </div>
            <div>Maximum response time (in ms) :{maxresp}</div>
            <div>Response Persentage :{respperc}</div>
            <div>Mean RSSI difference :{meandiff}</div>
          </>
        ) : (
          <p>Details not found yet</p>
        )}
      </div>
    </div>
  );
}
