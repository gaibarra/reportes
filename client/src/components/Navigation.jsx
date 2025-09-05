import { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navigation = () => {
  const { isAuthenticated, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Verificar si la ruta actual es para editar una tarea
  const isEditing = location.pathname.includes("/tasks/") && location.pathname.split("/tasks/")[1];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión', error);
    }
  };

  const handleNewTaskClick = () => {
    if (!isEditing) {
      navigate("/tasks-create");
    }
  };

  // Ensure hooks are called in same order on every render — do not early-return before hooks
  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  if (location.pathname === '/login' || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col items-center py-3 shadow-md w-full" style={{ backgroundColor: '#061f57' }}>
      <div className="flex justify-between items-center w-full p-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to="/tasks" className="font-bold text-2xl text-white">Reportes Modelo</Link>
          {user && <div className="hidden sm:block text-white text-sm">Usuario: {user.username || 'Usuario'}</div>}
        </div>

        {/* Desktop actions (hidden on small screens) */}
        <div className="hidden sm:flex items-center">
          <Link to="/dashboard" className="bg-blue-500 text-white p-2 rounded-lg mr-2 hover:bg-blue-600">Dashboard</Link>
          <button onClick={handleNewTaskClick} className={`bg-green-500 text-white p-2 rounded-lg mr-2 hover:bg-green-600 ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isEditing}>Nuevo Reporte</button>
          <button onClick={handleLogout} className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-600">Cerrar sesión</button>
        </div>

        {/* Mobile compact menu */}
        <div className="flex sm:hidden items-center" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} className="p-2 rounded bg-white/10 text-white">
            {menuOpen ? '✕' : '☰'}
          </button>
          {menuOpen && (
            <div className="absolute right-3 top-16 bg-white rounded shadow p-2 w-48 z-50">
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block px-2 py-2 text-sm hover:bg-gray-100">Dashboard</Link>
              <button onClick={() => { setMenuOpen(false); handleNewTaskClick(); }} className="block w-full text-left px-2 py-2 text-sm hover:bg-gray-100">Nuevo Reporte</button>
              <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="block w-full text-left px-2 py-2 text-sm hover:bg-gray-100">Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navigation;
