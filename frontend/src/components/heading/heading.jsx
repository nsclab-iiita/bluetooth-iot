import "./heading.css"
import iiita from "./iiita.png"
import c3i from "./c3i.jpeg"
export default function Heading(){
    return (
        <>
        <div className="heading">
        <img src= {iiita} alt="" className="iiitalogo"/>
        <div className="headtext">
            <p className="head1">Internet Of Things Security (IOTS) research lab</p>
            <p className="head2">Indian Institute of Information Technology, Allahabad</p>
            <p className="head3">In collabration with C3i hub IIT Kanpur</p>
        </div>
        <img src= {c3i} alt ="" className="iiitalogo" />
        </div>
        <p className="head4">Bluetooth IOT Security Audit Interface</p>
        </>

    )
}