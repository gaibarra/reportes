import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getEventos, createEvento, getAllEmpleados, getTask } from "../api/tasks.api";

export function EventosFormPage() {
  const params = useParams();
  const [events, setEvents] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [newEvent, setNewEvent] = useState({
    descripcion: "",
    reporte: params.id,
    empleado: null,
  });
  const [isEventRegistered, setIsEventRegistered] = useState(false);
  const [task, setTask] = useState(null);

  const cargarTarea = useCallback(async () => {
    try {
      const { data } = await getTask(params.id);
      setTask(data);
    } catch (error) {
      console.error("Error cargando la tarea:", error);
    }
  }, [params.id]);

  const cargarEventos = useCallback(async () => {
    try {
      const data = await getEventos(params.id);
      if (data) {
        setEvents(Array.isArray(data) ? data : []);
      } else {
        console.error("No se recibieron datos de eventos");
        setEvents([]);
      }
    } catch (error) {
      console.error("Error cargando los eventos:", error);
      setEvents([]);
    }
  }, [params.id]);

  const cargarEmpleados = useCallback(async () => {
    try {
      const { data } = await getAllEmpleados();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando los empleados:", error);
      setEmpleados([]);
    }
  }, []);

  useEffect(() => {
    cargarEventos();
    cargarEmpleados();
    cargarTarea();
  }, [cargarEventos, cargarEmpleados, cargarTarea]);

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

      if (response.status === 201) {
        setIsEventRegistered(true);
      }

      setNewEvent({
        descripcion: "",
        reporte: params.id,
        empleado: null,
      });
      cargarEventos();
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
        <div className="mt-4"> {/* Added margin-top for spacing */}
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
          {empleados.map((empleado) => (
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
        {events
          .filter((event) => Number(event.reporte) === Number(params.id))
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          .map((event, index) => {
            const empleado = empleados.find((empleado) => String(empleado.id) === String(event.empleado));
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
