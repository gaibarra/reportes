import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext.jsx';
import { ReportesProvider } from './context/ReportesContext.jsx';
import Swal from 'sweetalert2';
import ThemeWrapper from './components/mui/ThemeWrapper';

import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

// Listen for logout events from authService and notify the user
window.addEventListener('auth:logout', () => {
  try {
    Swal.fire({
      icon: 'info',
      title: 'Sesión expirada',
      text: 'Su sesión ha expirado. Puede volver a iniciar sesión o permanecer en la página para copiar su trabajo.',
      showCancelButton: true,
      confirmButtonText: 'Ir al login',
      cancelButtonText: 'Permanecer'
    }).then((result) => {
      if (result.isConfirmed) window.location.href = '/login';
      // if canceled, do nothing — user can copy data or attempt manual re-login
    });
  } catch (e) {
    // Fallback: redirect directly
    window.location.href = '/login';
  }
});

root.render(
  <AuthProvider>
    <ReportesProvider>
      <ThemeWrapper>
        <App />
      </ThemeWrapper>
    </ReportesProvider>
  </AuthProvider>
);

