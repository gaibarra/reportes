import { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navigation = () => {
  const { isAuthenticated, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

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

  if (location.pathname === '/login' || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col items-center py-3 shadow-md w-full" style={{ backgroundColor: '#061f57' }}>
      <div className="flex justify-center items-center w-full p-4">
        <div className="flex-grow flex justify-center items-center">
          <div>
            <Link
              to="/tasks"
              className="font-bold text-3xl text-white hover:text-gray-600"
            >
            <span className="text-x2 font-bold text-white">Reportes Modelo</span>
            </Link>
            {user && (
              <div className="ml-4 text-white text-center">
                Usuario: {user.username || 'Usuario autenticado'}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center w-full mt-4">
        <button
          onClick={handleNewTaskClick}
          className={`bg-green-500 text-white p-3 rounded-lg mr-2 hover:bg-green-600 ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isEditing}
        >
          Nuevo Reporte
        </button>
        <button onClick={handleLogout} className="bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default Navigation;
