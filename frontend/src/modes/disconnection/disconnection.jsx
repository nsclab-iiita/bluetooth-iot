import axios from "axios";
import { useState } from "react";


export default function Disconnect(){

  const [disconnection , setDisconnection] = useState("");
  
    const fetchOS = async (event) => {
        event.preventDefault();
        const macAddress = event.target.elements.macAddress.value;
        try {
            setDisconnection("trying to disonnect")
          const res = await axios.get(`http://localhost:4000/api/disconnect/${macAddress}`);
          setDisconnection(res.data.output);
        } catch (error) {
          console.error('Error:', error.message);
        }
      };
    
      return (
        <div className="modes">
          <h3>Disconnect a device</h3>
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

          {disconnection? (<p>
            {disconnection}
          </p>) : (
            <p></p>
          )}
          </div>
          
        </div>
      );
}