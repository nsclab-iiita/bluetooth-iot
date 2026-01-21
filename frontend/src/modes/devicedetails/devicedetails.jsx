import "./devicedetails.css";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import Table from "react-bootstrap/Table";
import { updateForm, clearForm } from "../../redux/actions";

export default function Devicedetails() {
  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();

  // Dropdown + input state
  const [selectedMac, setSelectedMac] = useState("");
  const [macList, setMacList] = useState([]);

  // ✅ CLEAR OLD DETAILS ON PAGE LOAD / RELOAD
  useEffect(() => {
    dispatch(clearForm());
  }, [dispatch]);

  // 🔴 OPTION 3: SCRAPE MAC ADDRESSES FROM EXISTING SCAN TABLE
  useEffect(() => {
    function extractMacsFromTable() {
      const table = document.querySelector(".devicescan_table");
      if (!table) return;

      const macs = Array.from(
        table.querySelectorAll("tbody tr td:nth-child(3)")
      )
        .map(td => td.innerText.trim())
        .filter(Boolean);

      setMacList([...new Set(macs)]);
    }

    extractMacsFromTable();

    const interval = setInterval(extractMacsFromTable, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    dispatch(clearForm()); // clear before new request


    const macAddress = selectedMac;
    if (!macAddress) {
      alert("Please select or enter a MAC address");
      return;
    }

    try {
      const connection = await axios.get(
        `http://localhost:4000/api/connectionstatus/${macAddress}`
      );

      if (!connection.data.connected) {
        alert(`Please connect ${macAddress} to this device`);
        return;
      }

      const res = await axios.get(
        `http://localhost:4000/api/devicedetails/${macAddress}`
      );

      const deviceDetails = res.data.output[0];

      dispatch(updateForm("BDAddress", macAddress));
      for (const key in deviceDetails) {
        dispatch(updateForm(`Devicedetails.${key}`, deviceDetails[key]));
      }

    } catch (error) {
      console.error("Error:", error.message);
    }
  };

  return (
    <div className="modes">
      <h4>Get Device Details</h4>

      <form onSubmit={handleSubmit}>
        <label>
          Select MAC:
          <select
            value={selectedMac}
            onChange={(e) => setSelectedMac(e.target.value)}
            style={{ marginLeft: "10px" }}
          >
            <option value="">-- Select --</option>
            {macList.map(mac => (

              <option key={mac} value={mac}>{mac}</option>
            ))}
          </select>
        </label>

        <br /><br />

        <label>
          MAC Address:
          <input
            type="text"
            name="macAddress"
            value={selectedMac}
            onChange={(e) => setSelectedMac(e.target.value)}
            style={{ marginLeft: "10px" }}
          />
        </label>

        <br /><br />

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
                  {form.Devicedetails.UUID?.map((item, i) => (
                    <p key={i} style={{ margin: "2px" }}>{item}</p>
                  ))}
                </td>
              </tr>

              <tr>
                <td>Protocols or profiles</td>
                <td>
                  {form.Devicedetails.Protocols?.map((item, i) => (
                    <p key={i} style={{ margin: "2px" }}>
                      {item.Profile} {item.Version}
                    </p>
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

