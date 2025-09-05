import { useEffect } from 'react';
import TaskCard from './TaskCard.jsx';
import { useReportes } from '../context/ReportesContext.jsx';

const TasksList = () => {
  const { tasks, fetchTasks } = useReportes();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="task-list flex flex-wrap justify-center" style={{ backgroundColor: '#061f57' }}>
      {(!tasks || tasks.length === 0) ? (
        <p></p>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      )}
    </div>
  );
};

export default TasksList;