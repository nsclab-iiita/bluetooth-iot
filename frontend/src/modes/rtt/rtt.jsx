import axios from "axios";
import { useState } from "react";


export default function Rtt(){

  const [rtt , setRtt] = useState("");
  
    const fetchOS = async (event) => {
        event.preventDefault();
        const macAddress = event.target.elements.macAddress.value;
        try {
            setRtt("fetching")
          const res = await axios.get(`http://localhost:4000/api/rtt/${macAddress}`);
          console.log(res)
          setRtt(res.data);
        } catch (error) {
          console.error('Error:', error.message);
        }
      };
    
      return (
        <div className="modes">
          <h3>RTT of a device</h3>
          <form onSubmit={fetchOS}>
            <label>
              MAC Address:
              <input
                type="text"
                name="macAddress"
              />
            </label>
            <button type="submit">Submit</button>
          </form>
          <div>

          {rtt? (<p>
            {rtt}
          </p>) : (
            <p></p>
          )}
          </div>
          
        </div>
      );
}