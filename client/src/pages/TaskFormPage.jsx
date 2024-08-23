import { useEffect, useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import { AuthContext } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { getTask, createTask, updateTask, deleteTask, deleteTaskImage } from '../api/tasks.api';
import api from '../api/axiosInstance';

const webhookUrl = 'https://hook.us1.make.com/9jeoqi1fdxlaiegq5ak3rnuon1o8wpsw';

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
      id: user.id,
      username: user.username,
      email: user.email
    },
    empleado
  };

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
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
  const fechaResolucion = watch("fechaResolucion", "");

  const onSubmit = async (data) => {
    setLoading(true);
    const formData = new FormData();
    data.done = data.done === "true";
    formData.append("title", data.title);
    formData.append("description", data.description);
    formData.append("done", data.done.toString());
    formData.append("fecha_resolucion", moment(data.fechaResolucion).format("YYYY-MM-DDTHH:mm:ss"));

    if (data.foto_inicial && data.foto_inicial[0] instanceof File) {
      formData.append("foto_inicial", data.foto_inicial[0]);
    }

    if (data.foto_final && data.foto_final[0] instanceof File) {
      formData.append("foto_final", data.foto_final[0]);
    }

    try {
      let response;
      let isNewReport = false;

      if (params.id) {
        response = await updateTask(params.id, formData);
        Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Reporte actualizado' });
      } else {
        response = await createTask(formData);
        Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Reporte creado' });
        isNewReport = true;
      }

      const initialImageUrl = response.data.foto_inicial;
      setInitialImageUrl(initialImageUrl);

      const gptRequestData = {
        task: response.data.id,
        title: data.title,
        description: data.description,
        fecha_resolucion: moment(data.fechaResolucion).format("YYYY-MM-DDTHH:mm:ss"),
        foto_inicial_url: response.data.foto_inicial,
      };

      const gptResponse = await api.post('/api/v1/gpt-report/', gptRequestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Token ${localStorage.getItem('token')}`,
        },
      });

      console.log('GPT Response:', gptResponse.data);
      setGptReport(gptResponse.data.response);

      if (isNewReport) {
        const empleadoDetails = await getEmpleadoDetails();
        enviarDatosAGptRequest(gptRequestData, user, empleadoDetails);
      }

      navigate("/tasks");

    } catch (error) {
      console.error('Error response:', error.response ? error.response.data : error.message);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al guardar el reporte' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTask = async () => {
      if (params.id) {
        const { data } = await getTask(params.id);
        setValue("title", data.title);
        setValue("description", data.description);
        setValue("done", data.done.toString());
        setValue("fechaResolucion", moment(data.fecha_resolucion).format("YYYY-MM-DD"));
        setInitialImageUrl(data.foto_inicial);
        setFinalImageUrl(data.foto_final);
      }
    };

    loadTask();
  }, [params.id, setValue]);

  const handleDeleteImage = async () => {
    try {
      await deleteTaskImage(params.id, 'foto_final');
      setFinalImageUrl(null);
      Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Imagen eliminada' });
    } catch (error) {
      console.error('Error al eliminar la imagen:', error.response ? error.response.data : error.message);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al eliminar la imagen' });
    }
  };

  if (!user) {
    return <div>Loading...</div>;
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
          {params.id && (
            <div className="flex justify-center items-center mt-4">
              <button type="button" onClick={() => navigate(`/eventos/${params.id}`)} className="w-full py-2 px-3 uppercase rounded bg-green-500 text-white hover:bg-green-600">
                Registrar Avance o comentar
              </button>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-gray-700 mb-2 font-bold">Descripción detallada del problema a resolver</label>
          <textarea id="description" {...register("description", { required: true })} className="w-full px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={params.id && initialImageUrl !== null} />
        </div>

        <div className="mb-4 flex justify-between items-center">
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
            className="bg-gray-100 p-3 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            disabled={params.id && initialImageUrl !== null}
          />
        </div>

        <label htmlFor="fotoInicial" className="block text-gray-700 mb-2 font-bold">Imagen Inicial</label>
        {initialImageUrl && <img src={initialImageUrl} alt="Imagen inicial" className="mb-3 rounded-lg shadow-md" />}
        <div className="mb-4">
          <input id="fotoInicial" type="file" accept="image/*" capture="camera" {...register("foto_inicial")} className="w-full px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={params.id && initialImageUrl !== null} />
        </div>

        {finalImageUrl && (
          <div className="mb-4">
            <label htmlFor="fotoFinal" className="block text-gray-700 mb-2 font-bold">Imagen Actual</label>
            <div className="flex items-center">
              <img src={finalImageUrl} alt="Imagen final" className="mb-3 rounded-lg shadow-md" />
              <button type="button" onClick={handleDeleteImage} className="ml-2 px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600">
                Del
              </button>
            </div>
          </div>
        )}

        {params.id && (
          <div className="mb-4">
            <label htmlFor="fotoFinal" className="block text-gray-700 mb-2 font-bold">Imagen actual</label>
            <input id="fotoFinal" type="file" accept="image/*" {...register("foto_final")} className="w-full px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
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
          {loading ? <span className='animate-pulse'>Loading...</span> : 'Guardar Reporte'}
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
