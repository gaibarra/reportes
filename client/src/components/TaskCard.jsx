import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import LazyImage from './LazyImage';

const TaskCard = ({ task }) => {
  const navigate = useNavigate();

  const formatDate = (value, options) => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('es-ES', options).format(d);
  };

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
        {formatDate(task.fecha_creacion, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        })}
      </p>
      <p className="text-gray-600 text-lg text-center mb-4">{task.description}</p>
      {task.foto_inicial && (
        <LazyImage
          src={task.foto_inicial}
          alt="Foto inicial"
          className="mb-4 rounded-lg shadow-md"
          width="350px"
          height="250px"
          placeholder="/placeholder-blur.png"
        />
      )}
      <label className="text-gray-700 text-lg text-center">Fecha solicitada:</label>
      <p className="text-gray-600 text-lg text-center mb-4">
        {formatDate(task.fecha_resolucion, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour12: false,
        })}
      </p>
      {task.foto_final && (
        <LazyImage
          src={task.foto_final}
          alt="Foto final"
          className="rounded-lg shadow-md"
          width="350px"
          height="250px"
          placeholder="/placeholder-blur.png"
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
  fecha_resolucion: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  fecha_creacion: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  }).isRequired,
};

export default TaskCard;