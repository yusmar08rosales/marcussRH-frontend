import React from "react";
import { useLocation, useParams } from "react-router-dom";

const CierreEntrevista = () => {
    const { id } = useParams();
    const localitation = useLocation();
    const { fullTranscription, generatedReport } = location.state || {}; // Obtener los datos

    return (
        <div className="entrevista-container">
            <div className="logo">
                <img src="SEO-Logo-3.webp" alt="Logo SEO Contenidos" />
            </div>
            <h1>
                ¡<span className="bienvenido">Gracias</span>{ } por participar en nuestra entrevista!
            </h1>
            <p className="mensaje">
                Nos pondremos en contacto con usted pronto.
            </p>
        </div>
    )
}
export default CierreEntrevista