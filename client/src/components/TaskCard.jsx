import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

const TaskCard = ({ task }) => {
  const navigate = useNavigate();

  return (
    <div
      className="task-card flex flex-col items-center justify-center bg-blue-200 p-4 m-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
      style={{ width: '450px' }}
      onClick={() => {
        navigate(`/tasks/${task.id}`);
      }}
    >
      <div className="flex justify-center items-center">
        <h1 className="text-gray-800 font-bold uppercase text-2xl mb-0 text-center">
          {task.title}
        </h1>
      </div>
      <h3 className="text-gray-800 font-bold uppercase text-2xl mt-0 mb-2 text-center">
        <span className="text-lg">STATUS:</span>
        {task.done ? (
          <span className="text-green-500 text-lg ml-1">Finalizado</span>
        ) : (
          <span className="text-red-500 text-lg ml-1">Pendiente</span>
        )}
      </h3>

      <p className="text-gray-600 text-lg text-center">
        {new Intl.DateTimeFormat('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).format(task.fecha_creacion)}
      </p>
      <p className="text-gray-600 text-lg text-center mb-4">{task.description}</p>
      {task.foto_inicial && (
        <img
          src={task.foto_inicial}
          alt="Foto inicial"
          className="mb-4 rounded-lg shadow-md"
          style={{
            width: '350px',
            height: '250px',
            objectFit: 'cover',
          }}
        />
      )}
      <label className="text-gray-700 text-lg text-center">Fecha solicitada:</label>
      <p className="text-gray-600 text-lg text-center mb-4">
        {new Intl.DateTimeFormat('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour12: false,
        }).format(task.fecha_resolucion)}
      </p>
      {task.foto_final && (
        <img
          src={task.foto_final}
          alt="Foto final"
          className="rounded-lg shadow-md"
          style={{ width: '350px', height: '250px', objectFit: 'cover' }}
        />
      )}
    </div>
  );
};

TaskCard.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    done: PropTypes.bool,
    description: PropTypes.string.isRequired,
    foto_inicial: PropTypes.string,
    foto_final: PropTypes.string,
    fecha_resolucion: PropTypes.instanceOf(Date),
    fecha_creacion: PropTypes.instanceOf(Date),
  }).isRequired,
};

export default TaskCard;
