import "./devicedetails.css";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import Table from "react-bootstrap/Table";
import { updateForm, clearForm } from "../../redux/actions";

export default function Devicedetails() {
  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const macAddress = event.target.elements.macAddress.value;
    try {
      const connection = await axios.get(`http://localhost:4000/api/connectionstatus/${macAddress}`);
      if (connection.data.connected) {
        const res = await axios.get(`http://localhost:4000/api/devicedetails/${macAddress}`);
        const deviceDetails = res.data.output[0];
        dispatch(updateForm('BDAddress', macAddress));
        for (const key in deviceDetails) {
          if (deviceDetails.hasOwnProperty(key)) {
            dispatch(updateForm(`Devicedetails.${key}`, deviceDetails[key]));
          }
        }
      } else {
        alert(`Please connect ${macAddress} to this device`);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  };
 
  return (
    <div className="modes">
      <h4>Get Device Details</h4>
      <form onSubmit={handleSubmit}>
        <label>
          MAC Address:
          <input type="text" name="macAddress" />
        </label>
        <button type="submit">Submit</button>
      </form>
      <div>
        {form.Devicedetails ? (
          <Table>
            <tbody>
              <tr>
                <td>Bluetooth device address</td>
                <td>{form.BDAddress}</td>
              </tr>
              <tr>
                <td>Device name</td>
                <td>{form.Devicedetails.Devicename}</td>
              </tr>
              <tr>
                <td>LMP Version</td>
                <td>{form.Devicedetails.LMPversion}</td>
              </tr>
              <tr>
                <td>OUI Company</td>
                <td>{form.Devicedetails.OUIcompany}</td>
              </tr>
              <tr>
                <td>Manufacturer</td>
                <td>{form.Devicedetails.Manufacturer}</td>
              </tr>
              <tr>
                <td>Modalias</td>
                <td>{form.Devicedetails.Modalias}</td>
              </tr>
              <tr>
                <td>Class</td>
                <td>{form.Devicedetails.Class}</td>
              </tr>
              <tr>
                <td>Icon</td>
                <td>{form.Devicedetails.Icon}</td>
              </tr>
              <tr>
                <td>RSSI</td>
                <td>{form.Devicedetails.RSSI}</td>
              </tr>
              <tr>
                <td>Battery percentage</td>
                <td>{form.Devicedetails.BatteryPercentage}</td>
              </tr>
              <tr>
                <td>UUID</td>
                <td>
                  {form.Devicedetails.UUID?.map((item, index) => (
                    <p style={{ margin: "2px" }} key={index}>{item}</p>
                  ))}
                </td>
              </tr>
              <tr>
                <td>Protocols or profiles</td>
                <td>
                  {form.Devicedetails.Protocols?.map((item, index) => (
                    <p style={{ margin: "2px" }} key={index}>{item.Profile} {item.Version}</p>
          
                  ))}
                </td>
              </tr>
            </tbody>
          </Table>
        ) : (
          <p>Details not found yet</p>
        )}
      </div>
    </div>
  );
}
