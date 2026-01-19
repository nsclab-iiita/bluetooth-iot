import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { updateForm, clearForm } from '../../redux/actions';
import { useState } from 'react';

export default function DataManagement() {
  const form = useSelector((state) => state.form);
  const dispatch = useDispatch();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.post('http://localhost:4000/api/devicesave', form);
      alert('Data saved successfully!');
    } catch (error) {
      console.error('Error saving data:', error.message);
      alert('Failed to save data.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    dispatch(clearForm()); // Clear the form data in Redux
  };

  return (
    <div className="modes">
      <button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
      
      <button onClick={handleClear} style={{ margin: "10px" }}>
        Clear
      </button>
    </div>
  );
}
