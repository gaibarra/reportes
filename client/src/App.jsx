import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import { Toaster } from 'react-hot-toast';
import PrivateRoute from './components/PrivateRoute';
import LoginComponent from './components/LoginComponent';
import { Suspense, lazy } from 'react';

// lazy-loaded pages
const TaskFormPage = lazy(() => import('./pages/TaskFormPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const EmpleadoPage = lazy(() => import('./pages/EmpleadoPage'));
const EventosFormPage = lazy(() => import('./pages/EventosFormPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

function App() {
  return (
    <div id="root">
      <BrowserRouter>
        <div className="container mx-auto">
          <Navigation />
          <Suspense fallback={<div className="spinner">Cargando...</div>}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/login" element={<LoginComponent />} />

              {/* Rutas protegidas */}
              <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/tasks/:id" element={<TaskFormPage />} />
                <Route path="/tasks-create" element={<TaskFormPage />} />
                <Route path="/empleados" element={<EmpleadoPage />} />
                <Route path="/empleados/:id" element={<EmpleadoPage />} />
                <Route path="/eventos/:id" element={<EventosFormPage />} />
                <Route path="/*" element={<Navigate to="/tasks" />} />
              </Route>
            </Routes>
          </Suspense>
          <Toaster />
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
