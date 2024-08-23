import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import TaskFormPage from './pages/TaskFormPage';
import TasksPage from './pages/TasksPage';
import { Toaster } from 'react-hot-toast';
import EmpleadoPage from './pages/EmpleadoPage';
import EventosFormPage from './pages/EventosFormPage';
import PrivateRoute from './components/PrivateRoute';
import LoginComponent from './components/LoginComponent';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <div id="root">
      <AuthProvider>
        <BrowserRouter>
          <div className="container mx-auto">
            <Navigation />
            <Routes>
              <Route path="/" element={<Navigate to="/tasks" />} />
              <Route path="/login" element={<LoginComponent />} />
              
              {/* Rutas protegidas */}
              <Route element={<PrivateRoute />}>
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/tasks/:id" element={<TaskFormPage />} />
                <Route path="/tasks-create" element={<TaskFormPage />} />
                <Route path="/empleados" element={<EmpleadoPage />} />
                <Route path="/empleados/:id" element={<EmpleadoPage />} />
                <Route path="/eventos/:id" element={<EventosFormPage />} />
                <Route path="/*" element={<Navigate to="/tasks" />} />
              </Route>
            </Routes>
            <Toaster />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
