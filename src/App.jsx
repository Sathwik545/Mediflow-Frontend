/**
 * App.jsx — Root application with React Router v6 + ThemeProvider
 *
 * Route structure:
 *   /login         → LoginPage   (unauthenticated)
 *   /              → Layout shell (persistent sidebar + navbar)
 *     /dashboard   → Dashboard
 *     /patients    → Patients
 *     /doctors     → Doctors
 *     /appointments→ Appointments
 *     /billing     → Billing
 *     *            → redirect to /dashboard
 *
 * TODO: wrap <Route path="/" element={<Layout />}> with an
 *       <AuthGuard /> component once login API is live.
 *
 * @project MediFlow Hospital Management System
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { isAuthenticated } from './utils/apiService';

import Layout                  from './components/layout/Layout';
import LoginPage               from './pages/Login/LoginPage';
import Dashboard               from './pages/Dashboard';
import Patients                from './pages/Patients';
import Doctors                 from './pages/Doctors';
import Appointments            from './pages/Appointments';
import Billing                 from './pages/Billing';
import HospitalSettings        from './pages/Settings/HospitalSettings';
import Invoices                from './pages/Invoices';
import ConsultationList        from './pages/Consultations/ConsultationList';
import ConsultationWorkspace   from './pages/Consultations/ConsultationWorkspace';
import LabReports              from './pages/Reports/LabReports';
import LabReportDetail         from './pages/Reports/LabReportDetail';

/** Redirects unauthenticated users to /login; renders child routes otherwise. */
const ProtectedRoute = () =>
  isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />;

const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* All dashboard routes require a valid token */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="patients"      element={<Patients />} />
            <Route path="doctors"       element={<Doctors />} />
            <Route path="appointments"  element={<Appointments />} />
            <Route path="billing"       element={<Billing />} />
            <Route path="invoices"                         element={<Invoices />} />
            <Route path="settings"                         element={<HospitalSettings />} />
            <Route path="consultations"                    element={<ConsultationList />} />
            <Route path="consultations/:consultationCode"  element={<ConsultationWorkspace />} />
            <Route path="reports"                          element={<LabReports />} />
            <Route path="reports/:labOrderCode"            element={<LabReportDetail />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
