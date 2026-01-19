import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { updateForm } from "../../redux/actions";


export default function Operatingsys(){

  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();
  
    const fetchOS = async (event) => {
        event.preventDefault();
        const macAddress = event.target.elements.macAddress.value;
        try {
          const res = await axios.get(`http://localhost:4000/api/operatingsys/${macAddress}`);
          dispatch(updateForm('OperatingSys', res.data.output));
       
        } catch (error) {
          console.error('Error:', error.message);
          
        }
      };
    
      return (
        <div className="modes">
          <h3>Operating system</h3>
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

          {form.OperatingSys ? (<p>
            {form.OperatingSys}
          </p>) : (
            <p>Details not found yet</p>
          )}
          </div>
          
        </div>
      );
}