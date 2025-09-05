import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useReportes } from "../context/ReportesContext.jsx";

export function EventosFormPage({ onSaved } = {}) {
  const params = useParams();
  const { fetchEventos, fetchEmpleados, fetchTask, createEvento, eventos, empleados } = useReportes();
  const [eventsLocal, setEventsLocal] = useState([]);
  const [newEvent, setNewEvent] = useState({
    descripcion: "",
    reporte: params.id,
    empleado: null,
  });
  const [isEventRegistered, setIsEventRegistered] = useState(false);
  const [task, setTask] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const ev = await fetchEventos(params.id);
        setEventsLocal(Array.isArray(ev) ? ev : []);
      } catch (error) {
        setEventsLocal([]);
      }
    })();
  }, [fetchEventos, params.id]);

  useEffect(() => {
    fetchEmpleados();
    (async () => {
      try {
        const t = await fetchTask(params.id);
        setTask(t || null);
      } catch (error) {
        setTask(null);
      }
    })();
  }, [fetchEmpleados, fetchTask, params.id]);

  // keep local events in sync if context eventos updates
  useEffect(() => {
    if (eventos && eventos[params.id]) {
      setEventsLocal(eventos[params.id]);
    }
  }, [eventos, params.id]);

  const manejarEnvioEvento = async (e) => {
    e.preventDefault();

    if (!newEvent.descripcion || !newEvent.empleado) {
      alert("Por favor, rellena todos los campos del formulario.");
      return;
    }

    const eventoConEmpleado = {
      descripcion: newEvent.descripcion,
      reporte: params.id,
      empleado: newEvent.empleado,
    };

    try {
      const response = await createEvento(params.id, eventoConEmpleado);

      // createEvento in context returns created objeto; tasks.api.createEvento returned data
      if (response && response.id) {
        setIsEventRegistered(true);
  if (typeof onSaved === 'function') onSaved(response);
      }

      setNewEvent({ descripcion: "", reporte: params.id, empleado: null });
      // refresh events
      const ev = await fetchEventos(params.id);
      setEventsLocal(Array.isArray(ev) ? ev : []);
    } catch (error) {
      console.error("Error creando el evento:", error);
      alert("Error al registrar el evento. Por favor, intenta nuevamente.");
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      {isEventRegistered && <p className="text-green-500">Avance registrado</p>}
      <form onSubmit={manejarEnvioEvento} className="bg-blue-200 p-10 rounded-lg shadow-md mt-2">
        <h1 className="text-2xl font-semibold mb-3 text-gray-800">{task ? task.title : 'Cargando...'}</h1>
        <div>
          <span style={{ color: 'blue', marginRight: '1rem' }}>Registrar avance de:</span>
          <span style={{ color: 'green' }}>{task ? task.description : 'Cargando...'}</span>
        </div>
        <div className="mt-4">
          <textarea
            value={newEvent.descripcion}
            onChange={(e) => setNewEvent({ ...newEvent, descripcion: e.target.value })}
            placeholder="Descripción del avance o Comentario"
            className="bg-gray-100 p-3 rounded-lg block w-full mb-3 border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <select
          value={newEvent.empleado || ""}
          onChange={(e) => setNewEvent({ ...newEvent, empleado: e.target.value ? Number(e.target.value) : null })}
          className="bg-gray-100 p-3 rounded-lg block w-full mb-3 border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Persona que reporta</option>
          {(empleados || []).map((empleado) => (
            <option key={empleado.id} value={empleado.id}>
              {empleado.nombre_empleado}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-blue-500 p-3 rounded-lg block w-full text-white font-bold hover:bg-blue-600">
          Guardar
        </button>
      </form>
      <div className="mt-10 grid grid-cols-1 gap-4">
        {eventsLocal
          .filter((event) => Number(event.reporte) === Number(params.id))
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          .map((event, index) => {
            const empleado = (empleados || []).find((empleado) => String(empleado.id) === String(event.empleado));
            const fecha = new Date(event.fecha).toLocaleString("es-ES", {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            const nombreEmpleado = empleado ? empleado.nombre_empleado : "Empleado no encontrado";
            const datos = [nombreEmpleado, fecha, event.descripcion].join(" - ");

            return (
              <div key={index} className="bg-gray-800 text-white p-4 rounded-lg shadow-md mb-3">
                {datos}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default EventosFormPage;
