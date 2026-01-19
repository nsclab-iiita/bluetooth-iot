import axios from "axios";
import { useState } from "react";


export default function Connect(){

  const [connection , setConnection] = useState("");
  
    const fetchOS = async (event) => {
        event.preventDefault();
        const macAddress = event.target.elements.macAddress.value;
        try {
            setConnection("trying to connect")
          const res = await axios.get(`http://localhost:4000/api/connect/${macAddress}`);
          setConnection(res.data.output);
        } catch (error) {
          console.error('Error:', error.message);
        }
      };
    
      return (
        <div className="modes">
          <h3>Connect a device</h3>
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

          {connection? (<p>
            {connection}
          </p>) : (
            <p></p>
          )}
          </div>
          
        </div>
      );
}