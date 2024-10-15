import { useState, useEffect } from 'react';
import TaskCard from './TaskCard.jsx';
import { getAllTasks } from '../api/tasks.api';

const TasksList = () => {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const { data } = await getAllTasks();
      // Convertir las fechas a objetos Date
      const tasksWithDate = data.map(task => ({
        ...task,
        fecha_creacion: new Date(task.fecha_creacion),
        fecha_resolucion: task.fecha_resolucion ? new Date(task.fecha_resolucion) : null
      }));
      // Ordenar las tareas por fecha de creación en orden descendente
      tasksWithDate.sort((a, b) => b.fecha_creacion - a.fecha_creacion);
      setTasks(tasksWithDate);
    } catch (error) {
      console.error('Error al cargar las tareas:', error);
    }
  };

  return (
    <div className="task-list flex flex-wrap justify-center" style={{ backgroundColor: '#061f57' }}>
      {tasks.length === 0 ? (
        <p></p>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      )}
    </div>
  );
};

export default TasksList;