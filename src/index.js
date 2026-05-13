/**
 * src/index.js — React Application Entry Point
 * @project MediFlow Hospital Management System
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';   /* Tailwind directives + CSS theme variables */
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
