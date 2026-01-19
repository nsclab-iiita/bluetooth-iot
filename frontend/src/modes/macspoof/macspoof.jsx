import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { updateForm } from "../../redux/actions";


export default function Spoofing(){

  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();
    const spoofing = async (event) => {
        event.preventDefault();
        const macAddress = event.target.elements.macAddress.value;
        try {
          const res = await axios.get(`http://localhost:4000/api/spoofing/${macAddress}`);
          dispatch(updateForm('MACSpoofing', res.data.output));
         
        } catch (error) {
          console.error('Error:', error.message);
          
        }
      };
    
      return (
        <div className="modes">
          <h3>MAC spoofing</h3>
          <form onSubmit={spoofing}>
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

          {form.MACSpoofing ? (<p>
            {form.MACSpoofing}
          </p>) : (
            <p>Details not found yet</p>
          )}
          </div>
          
        </div>
      );
}