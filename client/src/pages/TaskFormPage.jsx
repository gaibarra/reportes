import { useEffect, useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import { AuthContext } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { getTask, createTask, updateTask, deleteTask, deleteTaskImage } from '../api/tasks.api';
import api from '../api/axiosInstance';

const webhookUrl = 'https://hook.us1.make.com/dq3lhb0n8ek7108xo39ox4cbayytiwxb';

async function getEmpleadoDetails() {
  try {
    const response = await api.get('/api/v1/empleado-detail/', {
      headers: {
        'Authorization': `Token ${localStorage.getItem('token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener los detalles del empleado:', error);
    throw error;
  }
}

function enviarDatosAGptRequest(data, user, empleado) {
  const requestData = {
    ...data,
    user: {
      id: user.pk, // Changed from user.id to user.pk
      username: user.username,
      email: user.email,
    },
    empleado,
    reportado_por: {
      id: user.pk, // Changed from user.id to user.pk
      username: user.username,
      email: user.email,
    },
    resuelto_por: data.done === "true" ? {
      id: user.pk, // Changed from user.id to user.pk
      username: user.username,
      email: user.email,
    } : null, // Solo si la tarea está marcada como 'Hecho'
  };

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  };

  fetch(webhookUrl, requestOptions)
    .then(response => response.text())
    .then(data => console.log('Respuesta del webhook:', data))
    .catch(error => console.error('Error al enviar datos:', error));
}

export function TaskFormPage() {
  const [initialImageUrl, setInitialImageUrl] = useState(null);
  const [finalImageUrl, setFinalImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gptReport, setGptReport] = useState(null);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const params = useParams();
  const { register, handleSubmit, setValue, watch } = useForm();
  const isSuperUser = user?.is_superuser;
  const fechaResolucion = watch("fechaResolucion", "");

  useEffect(() => {
    if (!user) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Usuario no autenticado. Por favor inicia sesión.',
      });
      navigate('/login');  // Redirigir al login si el usuario no está autenticado
      return;
    }

    if (!isSuperUser) {
      setValue("prioridad", "Media"); // Set default value to "Media" for non-superusers
    }

    const loadTask = async () => {
      if (params.id) {
        const { data } = await getTask(params.id);
        setValue("title", data.title);
        setValue("description", data.description);
        setValue("prioridad", data.prioridad);
        setValue("done", data.done.toString());
        setValue("fechaResolucion", moment(data.fecha_resolucion).format("YYYY-MM-DD"));
        setInitialImageUrl(data.foto_inicial);
        setFinalImageUrl(data.foto_final);
      }
    };

    loadTask();
  }, [params.id, setValue, navigate, user, isSuperUser]);

  const appendFileToFormData = (formData, fieldName, file) => {
    if (file && file[0] instanceof File) {
      formData.append(fieldName, file[0]);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    const formData = new FormData();
  
    // Verificar si el usuario está disponible antes de continuar
    if (!user) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Usuario no autenticado. Por favor inicia sesión.',
      });
      setLoading(false);
      return;
    }
  
    // Log the user object for debugging
    console.log('User object:', user);
  
    try {
      data.done = data.done === "true";
      formData.append("title", data.title);
      formData.append("description", data.description);
      formData.append("done", data.done.toString());
      formData.append("prioridad", data.prioridad);
      formData.append("fecha_resolucion", moment(data.fechaResolucion).format("YYYY-MM-DDTHH:mm:ss"));
  
      appendFileToFormData(formData, "foto_inicial", data.foto_inicial);
      appendFileToFormData(formData, "foto_final", data.foto_final);
  
      formData.append("refresh", "some_valid_value"); // Reemplazar con un valor válido
  
      let response;
      let isNewReport = false;
  
      if (!params.id) {
        const reportadoPorId = Number(user.pk); // Changed from user.id to user.pk
        if (isNaN(reportadoPorId)) {
          throw new Error(`Invalid user ID: ${user.pk}`); // Changed from user.id to user.pk
        }
        formData.append("reportado_por", reportadoPorId);
        console.log('Request payload for createTask:', formData); // Log the payload
        response = await createTask(formData);
        isNewReport = true;
      } else {
        if (data.done === "true") {
          const resueltoPorId = Number(user.pk); // Changed from user.id to user.pk
          if (isNaN(resueltoPorId)) {
            throw new Error(`Invalid user ID: ${user.pk}`); // Changed from user.id to user.pk
          }
          formData.append("resuelto_por", resueltoPorId);
        }
        response = await updateTask(params.id, formData);
      }
  
      Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Reporte guardado' });
  
      const gptRequestData = {
        task: response.data.id,
        title: data.title,
        description: data.description,
        fecha_resolucion: moment(data.fechaResolucion).format("YYYY-MM-DDTHH:mm:ss"),
        prioridad: data.prioridad,
        foto_inicial_url: response.data.foto_inicial,
        foto_final_url: response.data.foto_final, // Asegúrate de que el backend devuelva esta URL
        reportado_por: {
          id: Number(user.pk), // Changed from user.id to user.pk
          username: user.username,
          email: user.email,
        },
        resuelto_por: data.done === "true" ? {
          id: Number(user.pk), // Changed from user.id to user.pk
          username: user.username,
          email: user.email,
        } : null,
      };
  
      if (isNewReport) {
        const empleadoDetails = await getEmpleadoDetails();
        enviarDatosAGptRequest(gptRequestData, user, empleadoDetails);
      }
  
      // Actualiza el estado con la URL de la imagen final
      setFinalImageUrl(response.data.foto_final);
  
      navigate("/tasks");
  
    } catch (error) {
      console.error('Error in onSubmit:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error al guardar el reporte: ${error.message || JSON.stringify(error.response?.data || error)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async () => {
    try {
      await deleteTaskImage(params.id, 'foto_final');
      setFinalImageUrl(null);
      Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Imagen eliminada' });
    } catch (error) {
      console.error('Error al eliminar la imagen:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al eliminar la imagen' });
    }
  };

  if (!user) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="max-w-xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-blue-200 p-10 rounded-lg shadow-md mt-2" encType="multipart/form-data">
        <h2 className="text-2xl mb-5 font-bold text-gray-800">{params.id ? `Reporte ${params.id}` : "Nuevo reporte"}</h2>

        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 mb-2 font-bold">Ubicación</label>
          <input
            type="text"
            placeholder="Lugar del reporte"
            {...register("title", { required: true })}
            className="bg-gray-100 p-3 rounded-lg block w-full border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={params.id && initialImageUrl !== null}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-gray-700 mb-2 font-bold">Descripción detallada del problema a resolver</label>
          <textarea id="description" {...register("description", { required: true })} className="w-full px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={params.id && initialImageUrl !== null} />
        </div>

        <div className="mb-4 flex justify-between items-center">
          <div className="w-1/2 pr-2">
            <label htmlFor="prioridad" className="block text-gray-700 mb-2 font-bold">Prioridad</label>
            <select
              id="prioridad"
              {...register("prioridad")}
              defaultValue="Media" // Set default value to "Media"
              className="bg-gray-100 p-3 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
              disabled={!isSuperUser} // Disable if not a superuser
            >
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>

          <div className="w-1/2 pl-2">
            <label htmlFor="fechaResolucion" className="block text-gray-700 font-bold">Fecha solicitada de solución</label>
            <input
              id="fechaResolucion"
              type="date"
              value={fechaResolucion}
              onChange={(e) => {
                const today = new Date().toISOString().split('T')[0];
                if (e.target.value < today) {
                  Swal.fire({ icon: 'error', title: 'Oops...', text: 'La fecha no puede ser anterior al día de hoy.' });
                } else {
                  setValue("fechaResolucion", e.target.value);
                }
              }}
              className="bg-gray-100 p-3 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
              required
              disabled={params.id && initialImageUrl !== null}
            />
          </div>
        </div>

        {/* Gestión de imágenes */}
        <div className="mb-4">
          <label htmlFor="fotoInicial" className="block text-gray-700 mb-2 font-bold">Imagen Inicial</label>
          {initialImageUrl && <img src={initialImageUrl} alt="Imagen inicial" className="mb-3 rounded-lg shadow-md" />}
          <input
            type="file"
            id="fotoInicial"
            {...register("foto_inicial")}
            className="w-full px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={!!initialImageUrl} // Disable the input if initialImageUrl is present
          />
        </div>

        {finalImageUrl && (
          <div className="mb-4">
            <label htmlFor="fotoFinal" className="block text-gray-700 mb-2 font-bold">Imagen Final</label>
            <div className="flex items-center">
              <img src={finalImageUrl} alt="Imagen final" className="mb-3 rounded-lg shadow-md" />
              <button
                type="button"
                onClick={handleDeleteImage}
                className="ml-2 px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600">
                Eliminar
              </button>
            </div>
          </div>
        )}

        {params.id && (
          <div className="mb-4">
            <label htmlFor="fotoFinal" className="block text-gray-700 mb-2 font-bold">Subir Imagen Final</label>
            <input
              type="file"
              id="fotoFinal"
              {...register("foto_final")}
              className="w-full px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        <div className="mb-4 flex justify-between items-center">
          <label htmlFor="done" className="block text-gray-700 font-semibold">Estado de la solución del reporte</label>
          <select id="done" {...register("done")} className="bg-gray-100 p-3 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="false">Pendiente</option>
            <option value="true">Hecho</option>
          </select>
        </div>

        <button type="submit" className="w-full py-2 px-3 uppercase rounded bg-blue-500 text-white hover:bg-blue-600" disabled={loading}>
          {loading ? <span className='animate-pulse'>Cargando...</span> : 'Guardar Reporte'}
        </button>
      </form>

      {params.id && user.is_superuser && (
        <div className="flex justify-center items-center mt-4">
          <button type="button" onClick={async () => {
            const result = await Swal.fire({
              title: '¿Estás seguro de que quieres eliminar este Reporte?',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#3085d6',
              cancelButtonColor: '#d33',
              confirmButtonText: 'Sí, eliminar',
              cancelButtonText: 'Cancelar'
            });
            if (result.isConfirmed) {
              await deleteTask(params.id);
              Swal.fire('Eliminado', 'Reporte eliminado', 'success');
              navigate("/tasks");
            }
          }} className="w-1/2 py-2 px-3 uppercase rounded bg-red-500 text-white hover:bg-red-600">
            Eliminar Reporte
          </button>
        </div>
      )}
    </div>
  );
}

export default TaskFormPage;