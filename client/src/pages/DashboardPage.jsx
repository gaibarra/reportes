import { useEffect, useState, useContext } from 'react';
import api from '../api/axiosInstance';
import { getDashboardOverview, getTaskTimeline } from '../api/dashboard.api';
import Timeline from '../components/Timeline';
import { useReportes } from '../context/ReportesContext.jsx';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { AuthContext } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import InfoCard from '../components/InfoCard';

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const { fetchTasks, tasks } = useReportes();
  const { createEvento } = useReportes();
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [openNewEvent, setOpenNewEvent] = useState(false);
  const [newEventTask, setNewEventTask] = useState(null);
  const [newEventDesc, setNewEventDesc] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await getDashboardOverview();
        setOverview(res.data || res);
      } catch (err) {
        console.error('Error loading dashboard overview', err);
      }
    };

    fetchOverview();
  }, [tasks]);

  useEffect(() => {
    (async () => {
      try {
        await fetchTasks();
      } catch (err) {
        // ignore
      }
    })();
  }, [fetchTasks]);

  const handleCreateEvent = async () => {
    if (!newEventTask || !newEventDesc) return;
    try {
      // try to fetch the current user's Empleado record (endpoint returns empleado for current token)
      let empleadoId = null;
      try {
        const resp = await api.get('/api/v1/empleado-detail/');
        const empleadoData = resp.data;
        if (empleadoData && empleadoData.id) empleadoId = empleadoData.id;
      } catch (err) {
        console.debug('No empleado detail available for current user, sending null empleado', err);
      }
      await createEvento(newEventTask.id, { descripcion: newEventDesc, empleado: empleadoId });
      setOpenNewEvent(false);
      setNewEventDesc('');
      setNewEventTask(null);
      // refresh overview via tasks change (context will update)
      alert('Evento creado');
    } catch (err) {
      console.error('Error creando evento', err);
      alert('Error creando evento');
    }
  };

  useEffect(() => {
    const taskId = selectedTask ? selectedTask.id : null;
    if (!taskId) {
      setTimeline([]);
      return;
    }
    (async () => {
      try {
        const res = await getTaskTimeline(taskId);
        setTimeline(res.data.timeline || []);
      } catch (err) {
        console.error('Error loading timeline', err);
      }
    })();
  }, [selectedTask]);

  return (
    <div className="max-w-6xl mx-auto py-6">
      <h1 className="text-2xl font-semibold mb-4">Panel de Supervisión</h1>

      <div className="mb-6 flex items-center justify-between">
        <div className="hidden sm:flex gap-3">
          <Button variant="contained" color="primary" onClick={() => navigate('/tasks')}>Reportes existentes</Button>
          <Button variant="contained" color="success" onClick={() => navigate('/tasks-create')}>Nuevo Reporte</Button>
          <Button variant="contained" color="warning" onClick={() => setOpenNewEvent(true)}>Nuevo Evento</Button>
        </div>
        {/* compact mobile actions */}
        <div className="sm:hidden relative">
          <button onClick={() => setOpenNewEvent(true)} className="px-3 py-2 bg-green-500 text-white rounded mr-2">+</button>
          <select className="ml-2 p-2 border rounded" onChange={(e) => {
            const v = e.target.value;
            if (v === 'tasks') navigate('/tasks');
            if (v === 'create') navigate('/tasks-create');
            if (v === 'logout') { logout(); navigate('/login'); }
          }}>
            <option value="">Acciones</option>
            <option value="tasks">Reportes existentes</option>
            <option value="create">Nuevo Reporte</option>
            <option value="logout">Salir</option>
          </select>
        </div>
      </div>

      <Dialog open={openNewEvent} onClose={() => setOpenNewEvent(false)} fullWidth>
        <DialogTitle>Nuevo Evento</DialogTitle>
        <DialogContent>
          <div className="mb-3">
              {isMobile ? (
                <select
                  className="w-full p-2 border rounded"
                  value={newEventTask ? newEventTask.id : ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const t = (tasks || []).find(x => x.id === id) || null;
                    setNewEventTask(t);
                  }}
                >
                  <option value="">Selecciona un caso</option>
                  {(tasks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} — {t.title}
                    </option>
                  ))}
                </select>
              ) : (
                <Autocomplete
                  options={tasks || []}
                  getOptionLabel={(option) => `${option.id} — ${option.title}`}
                  value={newEventTask}
                  onChange={(_, newValue) => setNewEventTask(newValue)}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => <TextField {...params} label="Caso" variant="outlined" />}
                />
              )}
          </div>
          <div className="mb-3">
            <TextField fullWidth label="Descripción" multiline rows={3} value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewEvent(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateEvent}>Crear Evento</Button>
        </DialogActions>
      </Dialog>

      {/* Summary cards using InfoCard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <InfoCard title="Total de casos" value={overview ? overview.total_tasks : '...'} />
        <InfoCard title="Abiertos" value={overview ? overview.open_tasks : '...'} />
        <InfoCard title="Cerrados" value={overview ? overview.closed_tasks : '...'} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Próximos compromisos</h2>
          <div className="space-y-2">
            {overview && overview.upcoming_compromisos && overview.upcoming_compromisos.length ? (
              overview.upcoming_compromisos.map((c) => (
                <div key={c.id} className="p-3 border rounded">
                  <div className="text-sm text-gray-500">{new Date(c.fecha_compromiso).toLocaleString()}</div>
                  <div className="text-gray-900">{c.descripcion}</div>
                </div>
              ))
            ) : (
              <div className="text-gray-500">No hay compromisos próximos</div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Línea de tiempo por caso</h2>
          <div className="mb-3">
            {isMobile ? (
              <select
                className="w-full p-2 border rounded"
                value={selectedTask ? selectedTask.id : ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const t = (tasks || []).find(x => x.id === id) || null;
                  setSelectedTask(t);
                }}
              >
                <option value="">Selecciona un caso</option>
                {(tasks || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.title}
                  </option>
                ))}
              </select>
            ) : (
              <Autocomplete
                options={tasks || []}
                getOptionLabel={(option) => `${option.id} — ${option.title}`}
                value={selectedTask}
                onChange={(_, newValue) => setSelectedTask(newValue)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Selecciona un caso" variant="outlined" />}
              />
            )}
          </div>
          <Timeline items={timeline} />
        </div>
      </div>

      <div className="mt-6 bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Eventos recientes</h2>
        <div className="space-y-2">
          {overview && overview.recent_eventos && overview.recent_eventos.length ? (
            overview.recent_eventos.map((e) => (
              <div key={e.id} className="p-3 border rounded">
                <div className="text-sm text-gray-500">{new Date(e.fecha).toLocaleString()}</div>
                <div className="text-gray-900">{e.descripcion}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No hay eventos recientes</div>
          )}
        </div>
      </div>
    </div>
  );
}
