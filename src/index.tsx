import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import reportWebVitals from './reportWebVitals';

//componentes
import App from './App';
import InicioEntrevista from './visual-marcussRH/entrevista-usuario/InicioEntrevista';
import InicioAnalisis from './visual-marcussRH/analisis-marcuss/InicioAnalisis';
import CierreEntrevista from './visual-marcussRH/entrevista-usuario/CierreEntrevista';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  
  <Router>
    <Routes>
      {/* Ruta para entrevista */}
      <Route path="/:id" element={<InicioEntrevista />} />
      <Route path="/entrevista/:id" element={<App />} />
      <Route path="/entrevista/fin/:id" element={<CierreEntrevista />} />

      {/* Ruta para análisis */}
      <Route path="/analisis" element={<InicioAnalisis />} />
    </Routes>
  </Router>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
