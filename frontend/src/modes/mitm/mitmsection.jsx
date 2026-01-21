import { useNavigate } from 'react-router-dom';
import "./mitm.css";

export default function MitmSection() {
    const navigate = useNavigate();

    const handleLaunchAttack = () => {
        navigate('/mitm-attack');
    };

    return (
        <div className="modes">
                <h3>MITM/Reflection Attack</h3>
                <p className="mitm-description">
                    Launch a Man-in-the-Middle attack to intercept Bluetooth communications between devices.
                </p>
                <button 
                    onClick={handleLaunchAttack}
                >
                    Launch MITM Attack
                </button>
        </div>
    );
}
