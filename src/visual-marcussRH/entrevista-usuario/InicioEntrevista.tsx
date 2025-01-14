import React, { useEffect, useState } from "react"; // Asegúrate de incluir useEffect y useState
import { useNavigate, useParams } from "react-router-dom";
import KeyboardVoiceIcon from "@mui/icons-material/KeyboardVoice";
import "../index.css";

interface EntrevistaData {
    nombre: string;
    apellido: string;
    cargo_al_que_se_postula: string;
}

const InicioEntrevista = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // Capturar el ID dinámico desde la URL
    const [data, setData] = useState<EntrevistaData | null>(null);

    useEffect(() => {
        // Llamar al backend para obtener los datos del ID
        const fetchData = async () => {
            try {
                const response = await fetch(`http://localhost:5000/data?id=${id}`); // Pasar el id como query parameter
                const result = await response.json();
                console.log(result);
                setData(result[0]); // Suponiendo que solo necesitas el primer informe
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [id]);

    if (!data) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', zIndex: 1000 }}>
                <div className="spinner"></div>
                <p style={{ color: 'white', fontSize: '1.5rem', marginTop: '10px' }}>Cargando Entrevista...</p>
            </div>
        );
    }

    const handleEntrevista = () => {
        navigate(`/entrevista/${id}` , { state: { data } });
        console.log("siguiente", data);
    };

    return (
        <>
            <div className="entrevista-container">
                <div className="logo">
                    <img src="SEO-Logo-3.webp" alt="Logo SEO Contenidos" />
                </div>
                <h1>¡Hola, {data.nombre} {data.apellido}!</h1>
                <h2>
                    <span className="bienvenido">Bienvenido</span> a su Entrevista
                </h2>
                <p className="mensaje">
                    Gracias por aplicar al puesto de <span className="puesto">{data.cargo_al_que_se_postula}</span>.
                </p>
                <p className="small-text">Cuando esté listo, haga clic en el micrófono para iniciar su entrevista.</p>
                <div className="mic-button-container">
                    <button id="start-interview" onClick={handleEntrevista}>
                        <KeyboardVoiceIcon className="icono" />
                    </button>
                </div>
            </div>
        </>
    )
}
export default InicioEntrevista