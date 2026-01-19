import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import { updateForm } from "../../redux/actions";

export default function Dos() {
  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();
  const [respperc , setRespperc] = useState("");

  const fetchDOS = async (event) => {
    event.preventDefault();
    const macAddress = event.target.elements.macAddress.value;
    try {
      const res = await axios.get(`http://localhost:4000/api/dos/${macAddress}`);
      dispatch(updateForm('DosAttack', res.data.output)); 
      const res1 = await axios.get(`http://localhost:4000/api/responsepercentage/${macAddress}`)
      setRespperc(res1.data.output);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="modes">
      <h3>DoS Attack</h3>
      <form onSubmit={fetchDOS}>
        <label>
          MAC Address:
          <input type="text" name="macAddress" />
        </label>
        <button type="submit">Submit</button>
      </form>
      <div>
        { form.DosAttack? (
          <p>{form.DosAttack}</p>
        ) : (
          <p>Details not found yet</p>
        )}
      </div>
      <div><p>{respperc}</p></div>
    </div>
  );
}
