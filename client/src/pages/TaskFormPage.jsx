import { useReportes } from '../context/ReportesContext.jsx';
import api from '../api/axiosInstance';
import MapPreview from '../components/MapPreview';

import { useEffect, useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import { AuthContext } from '../context/AuthContext';
import Swal from 'sweetalert2';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import EventosFormPage from './EventosFormPage';

const webhookUrl = 'https://hook.us1.make.com/dq3lhb0n8ek7108xo39ox4cbayytiwxb';

async function getEmpleadoDetails() {
  try {
    const response = await api.get('/api/v1/empleado-detail/');
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
      id: user.pk,
      username: user.username,
      email: user.email,
    },
    empleado,
    reportado_por: {
      id: user.pk,
      username: user.username,
      email: user.email,
    },
    resuelto_por: data.done === true ? {
      id: user.pk,
      username: user.username,
      email: user.email,
    } : null,
  };

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  })
    .then(response => response.text())
    .then(data => console.log('Respuesta del webhook:', data))
    .catch(error => console.error('Error al enviar datos:', error));
}

export function TaskFormPage() {
  const [initialImageUrl, setInitialImageUrl] = useState(null);
  const [finalImageUrl, setFinalImageUrl] = useState(null);
  const [selectedUbicacionId, setSelectedUbicacionId] = useState(null); // Keep minimal UX
  const [ubicacionDetail, setUbicacionDetail] = useState(null);
  // suggestedLocation not used in redesigned flow
  // geoPermission tracking removed (not used) - kept detection flow via showDetectButton
  const [showDetectButton, setShowDetectButton] = useState(false);
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [coordLat, setCoordLat] = useState(null);
  const [coordLon, setCoordLon] = useState(null);
  const [coordNameInput, setCoordNameInput] = useState('');
  const [openEventosModal, setOpenEventosModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: location, 2: details, 3: media
  const [showMapModal, setShowMapModal] = useState(false);

  // Small helper presentational component for step labels
  // eslint-disable-next-line react/prop-types
  const StepLabel = ({ active, onClick, icon, label }) => (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 ${active ? 'text-blue-600' : 'text-gray-500'} focus:outline-none`} aria-current={active ? 'step' : false}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center ${active ? 'bg-blue-100' : 'bg-gray-100'}`}>{icon}</span>
      <span className="hidden sm:inline-block">{label}</span>
    </button>
  );
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const params = useParams();
  const { register, handleSubmit, setValue, watch } = useForm();
  
  const { fetchTask, createTask: createTaskContext, updateTask: updateTaskContext, deleteTaskImage: deleteTaskImageContext, removeTask: removeTaskContext } = useReportes();
  const isSuperUser = user?.is_superuser;
  const fechaResolucion = watch("fechaResolucion", "");

  useEffect(() => {
    if (!user) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Usuario no autenticado. Por favor inicia sesión.',
      });
      navigate('/login');
      return;
    }

    if (!isSuperUser) {
      setValue("prioridad", "Media");
    }

    const loadTask = async () => {
      if (!params.id) return;
      try {
        const data = await fetchTask(params.id);
        // Defensive: handle missing fields and unexpected shapes
        console.debug('Loaded task for edit:', data);
        setValue("title", data?.title ?? data?.ubicacion ?? '');
        setValue("description", data?.description ?? data?.descripcion ?? '');
        setValue("prioridad", data?.prioridad ?? 'Media');
        // Guard boolean safely
        setValue("done", (data?.done != null) ? String(data.done) : 'false');
        // fecha_resolucion may be null/undefined
        setValue("fechaResolucion", data?.fecha_resolucion ? moment(data.fecha_resolucion).format("YYYY-MM-DD") : '');
        setInitialImageUrl(data?.foto_inicial || null);
        setFinalImageUrl(data?.foto_final || null);
        if (data?.ubicacion) setSelectedUbicacionId(data.ubicacion);
      } catch (err) {
        console.error('Error loading task:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar el reporte',
          text: 'No se pudo obtener el reporte desde el servidor. Verifica que el backend esté en ejecución y la variable de entorno VITE_BACKEND_URL apunte a la URL correcta.',
        });
        navigate('/tasks');
      }
    };

    loadTask();
  }, [params.id, setValue, navigate, user, isSuperUser, fetchTask]);

  // When a ubicacion id is selected, fetch its details for display in the form
  useEffect(() => {
    let mounted = true;
    const id = selectedUbicacionId;
    if (!id) {
      setUbicacionDetail(null);
      return;
    }
    (async () => {
      try {
        const resp = await api.get(`/api/v1/ubicaciones/${id}/`);
        if (mounted) setUbicacionDetail(resp.data);
      } catch (err) {
        console.error('Error fetching ubicacion detail', err);
        if (mounted) setUbicacionDetail(null);
      }
    })();
    return () => { mounted = false; };
  }, [selectedUbicacionId]);

  // encapsulate actual geolocation trigger (called when safe or user requests)
  const triggerGeolocation = async () => {
    if (!('geolocation' in navigator)) {
      console.debug('Geolocation API not available');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setCoordLat(lat);
      setCoordLon(lon);
      // Prefill nombre for the ubicacion to be saved: "Ubicación de <usuario>"
      // This intentionally replaces the previous reverse-geocode suggestion per UX requirement.
      try {
        const defaultName = user && user.username ? `Ubicación de ${user.username}` : '';
        setCoordNameInput(defaultName);
      } catch (err) {
        console.debug('Error prefilling ubicacion nombre', err);
        setCoordNameInput('');
      }

      // open modal for user confirmation/editing
      setShowCoordModal(true);
    }, (err) => {
      console.debug('geolocation error', err);
      if (err && err.code === 1) {
        // permission denied
        setShowDetectButton(true);
        Swal.fire({ icon: 'warning', title: 'Permiso denegado', text: 'La detección de ubicación fue denegada. Puedes habilitarla en la configuración del navegador o usar el botón "Detectar ubicación" para reintentar.' });
      }
    }, { timeout: 5000, maximumAge: 10000 });
  };

  // When the Ubicación input receives focus, check permissions and decide action
  const handleUbicacionFocus = async (e) => {
    try {
      const current = e.target.value;
      if (current && current.trim().length > 0) return; // already filled

      if (!('geolocation' in navigator)) return;

      // Prefer Permissions API when available
      if (navigator.permissions && navigator.permissions.query) {
          try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (status.state === 'granted') {
            // safe to auto-detect
            setShowDetectButton(false);
            await triggerGeolocation();
          } else {
            // prompt or denied -> show explicit detect button
            setShowDetectButton(true);
          }
        } catch (err) {
          // permissions API failed, fall back to showing a detect button
          setShowDetectButton(true);
        }
      } else {
        // No Permissions API: show explicit button to avoid surprising permission prompt
        setShowDetectButton(true);
      }
    } catch (err) {
      console.error('Error checking geolocation permission', err);
      setShowDetectButton(true);
    }
  };

  // suggestedLocation helpers intentionally removed; suggestions flow not used in redesigned form

  // Resize/compress image files on the client to speed up mobile uploads.
  // Returns a Promise<File> when an image was processed, or the original File if no processing applied.
  const resizeImageFile = (file, maxWidth = 1280, quality = 0.7) => {
    return new Promise((resolve) => {
      if (!file || !(file instanceof File) || !file.type.startsWith('image/')) return resolve(file);

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const ratio = img.width / img.height || 1;
          const targetWidth = Math.min(maxWidth, img.width);
          const targetHeight = Math.round(targetWidth / ratio);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          // draw the image into canvas
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // convert to blob (jpeg) with specified quality
          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            // preserve original filename but change extension to .jpg
            const newName = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
            const newFile = new File([blob], newName, { type: 'image/jpeg' });
            URL.revokeObjectURL(url);
            resolve(newFile);
          }, 'image/jpeg', quality);
        } catch (err) {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  // Append a FileList (from react-hook-form) to FormData after optional resizing.
  const appendFileToFormData = async (formData, fieldName, fileList) => {
    if (!fileList || !(fileList[0] instanceof File)) return;
    const originalFile = fileList[0];
    // If already small or not an image, keep as-is. Otherwise resize to reduce upload time.
    const maxSizeForSkip = 300 * 1024; // 300KB skip resizing
    if (!originalFile.type.startsWith('image/') || originalFile.size <= maxSizeForSkip) {
      formData.append(fieldName, originalFile);
      return;
    }

    try {
      // perform resize/compression
      const compressed = await resizeImageFile(originalFile, 1280, 0.7);
      formData.append(fieldName, compressed);
    } catch (err) {
      // fallback to original file
      formData.append(fieldName, originalFile);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    if (!selectedUbicacionId) {
      Swal.fire({ icon: 'warning', title: 'Ubicación requerida', text: 'Por favor detecta o selecciona una ubicación antes de guardar el reporte.' });
      setLoading(false);
      return;
    }
    const formData = new FormData();

    if (!user) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Usuario no autenticado. Por favor inicia sesión.' });
      setLoading(false);
      return;
    }

    try {
      data.done = data.done === "true" || data.done === true;
      formData.append("title", data.title);
      formData.append("description", data.description);
      formData.append("done", data.done.toString());
      formData.append("prioridad", data.prioridad);
      formData.append("fecha_resolucion", moment(data.fechaResolucion).format("YYYY-MM-DDTHH:mm:ss"));

  await appendFileToFormData(formData, "foto_inicial", data.foto_inicial);
  await appendFileToFormData(formData, "foto_final", data.foto_final);

      if (selectedUbicacionId) {
        formData.append('ubicacion', selectedUbicacionId);
      }

      formData.append("refresh", "some_valid_value");

      console.log('Request payload for createTask:');
      for (const [k, v] of formData.entries()) {
        if (v instanceof File) console.log(k, v.name, v.type, v.size);
        else console.log(k, v);
      }

      let created;
      let isNewReport = false;

      if (!params.id) {
        const reportadoPorId = Number(user.pk);
        if (isNaN(reportadoPorId)) throw new Error(`Invalid user ID: ${user.pk}`);
        formData.append("reportado_por", reportadoPorId);
        created = await createTaskContext(formData);
        isNewReport = true;
      } else {
        if (data.done === true) {
          const resueltoPorId = Number(user.pk);
          if (isNaN(resueltoPorId)) throw new Error(`Invalid user ID: ${user.pk}`);
          formData.append("resuelto_por", resueltoPorId);
        }
        created = await updateTaskContext(params.id, formData);
      }

      if (!created) throw new Error('No response from server when saving the report');

      Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Reporte guardado' });

      const gptRequestData = {
        task: created.id,
        title: data.title,
        description: data.description,
        fecha_resolucion: moment(data.fechaResolucion).format("YYYY-MM-DDTHH:mm:ss"),
        prioridad: data.prioridad,
        foto_inicial_url: created.foto_inicial,
        foto_final_url: created.foto_final,
        reportado_por: { id: Number(user.pk), username: user.username, email: user.email },
        resuelto_por: data.done === true ? { id: Number(user.pk), username: user.username, email: user.email } : null,
      };

      if (isNewReport) {
        const empleadoDetails = await getEmpleadoDetails();
        enviarDatosAGptRequest(gptRequestData, user, empleadoDetails);
      }

      setFinalImageUrl(created.foto_final);
      navigate("/tasks");

    } catch (error) {
      console.error('Error in onSubmit:', error);
      const serverMessage = error?.response?.data ? JSON.stringify(error.response.data) : error.message;
      Swal.fire({ icon: 'error', title: 'Error', text: `Error al guardar el reporte: ${serverMessage}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async () => {
    try {
      await deleteTaskImageContext(params.id, 'foto_final');
      setFinalImageUrl(null);
      Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Imagen eliminada' });
    } catch (error) {
      console.error('Error al eliminar la imagen:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al eliminar la imagen' });
    }
  };

  if (!user) return <div>Cargando...</div>;

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-0">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-4 sm:p-8 rounded-lg shadow-md mt-4" encType="multipart/form-data">
        <h2 className="text-2xl mb-3 font-extrabold text-gray-800 flex items-center gap-3">{params.id ? `Editar reporte ${params.id}` : "Nuevo reporte"}
          <span className="text-sm font-medium text-gray-500">— rápido y móvil</span>
        </h2>

        {/* Stepper */}
        <style>{`
          .step-panel { transition: max-height 320ms ease, opacity 220ms ease; overflow: hidden; }
          .step-open { max-height: 2000px; opacity: 1; }
          .step-closed { max-height: 0; opacity: 0; }
          .primary-cta { background: linear-gradient(90deg,#059669,#10b981); }
          .secondary-cta { background: #f3f4f6; color: #111827; }
        `}</style>
        <div className="mb-4 flex gap-2 items-center text-sm">
          <StepLabel step={1} active={step===1} onClick={() => setStep(1)} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v10" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/></svg>} label="Ubicación" />
          <div className="flex-1 h-px bg-gray-200" />
          <StepLabel step={2} active={step===2} onClick={() => setStep(2)} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h18" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/></svg>} label="Detalles" />
          <div className="flex-1 h-px bg-gray-200" />
          <StepLabel step={3} active={step===3} onClick={() => setStep(3)} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 22V12" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/></svg>} label="Imágenes" />
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className={`space-y-3 step-panel ${step===1 ? 'step-open' : 'step-closed'}`}>
            <div>
              <label htmlFor="title" className="block text-gray-700 mb-1 font-semibold">Ubicación</label>
              <div className="flex gap-2">
                <input id="title" type="text" placeholder="Lugar del reporte" {...register("title", { required: true })} onFocus={handleUbicacionFocus} className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                <div className="flex flex-col">
                  <button type="button" onClick={() => { setShowDetectButton(false); triggerGeolocation(); }} className="px-4 py-3 rounded-lg shadow-sm primary-cta text-white font-semibold">Detectar</button>
                  {showDetectButton && <div className="text-xs text-gray-500 mt-1">Usar detección automática</div>}
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">Puedes editar el nombre antes de guardar la ubicación. Se crea un registro nuevo siempre.</div>
            </div>

            {/* preview */}
            <div>
              {selectedUbicacionId && !ubicacionDetail ? (
                <div className="p-2 bg-white rounded-lg border border-gray-200 text-sm text-gray-600">Cargando ubicación seleccionada…</div>
              ) : ubicacionDetail ? (
                // Solo lectura: mostrar nombre y coordenadas, compacto y responsivo para móvil
                <div className="p-2 sm:p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="w-full sm:w-28 flex-shrink-0" onClick={() => setShowMapModal(true)}>
                      <MapPreview lat={Number(ubicacionDetail.lat)} lon={Number(ubicacionDetail.lon)} label={ubicacionDetail.nombre} height={120} hideToggle />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-base sm:text-lg text-gray-800 truncate">{ubicacionDetail.nombre}</div>
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">Lat: {ubicacionDetail.lat} · Lon: {ubicacionDetail.lon}</div>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => { setSelectedUbicacionId(null); setUbicacionDetail(null); setValue('title', ''); }} className="px-2 py-1 text-xs bg-red-500 text-white rounded">Quitar</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-3 border border-dashed border-gray-200 rounded text-center text-sm text-gray-500">No hay ubicación seleccionada. Usa <strong>Detectar</strong> para capturar coordenadas o guarda una ubicación existente.</div>
              )}
            </div>

            {/* Solo mostrar botones de guardar y modal si no hay ubicación seleccionada */}
            {!ubicacionDetail && (
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setStep(2)} disabled={!selectedUbicacionId && !watch('title')} className="px-5 py-3 rounded-lg secondary-cta text-sm">Siguiente</button>
                <button type="button" onClick={() => { setShowCoordModal(true); }} className="px-5 py-3 rounded-lg primary-cta text-white font-semibold">Guardar ubicación</button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className={`space-y-4 step-panel ${step===2 ? 'step-open' : 'step-closed'}`}>
            <div>
              <label htmlFor="description" className="block text-gray-700 mb-1 font-semibold">Descripción</label>
              <textarea id="description" {...register("description", { required: true })} className="w-full min-h-[120px] p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-900" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">Prioridad</label>
                <select id="prioridad" {...register("prioridad")} defaultValue="Media" className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50" disabled={!isSuperUser}>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">Fecha solicitada</label>
                <input id="fechaResolucion" type="date" value={fechaResolucion} onChange={(e) => {
                  const today = new Date().toISOString().split('T')[0];
                  if (e.target.value < today) Swal.fire({ icon: 'error', title: 'Oops...', text: 'La fecha no puede ser anterior al día de hoy.' });
                  else setValue("fechaResolucion", e.target.value);
                }} className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50" />
              </div>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-3 rounded-lg secondary-cta">Atrás</button>
              <button type="button" onClick={() => setStep(3)} className="px-4 py-3 rounded-lg primary-cta text-white font-semibold">Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 3: Media & Submit */}
        {step === 3 && (
          <div className={`space-y-4 step-panel ${step===3 ? 'step-open' : 'step-closed'}`}>
            <div>
              <label className="block text-gray-700 mb-1 font-semibold">Imagen inicial</label>
                {initialImageUrl ? (
                <div className="flex items-center gap-3">
                  <img src={initialImageUrl} alt="Imagen inicial" className="w-32 h-20 object-cover rounded" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-700">Imagen ya subida</div>
                  </div>
                </div>
              ) : (
                <input type="file" id="fotoInicial" accept="image/*" capture="environment" {...register("foto_inicial")} className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50" />
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-1 font-semibold">Imagen final (opcional)</label>
              {finalImageUrl ? (
                <div className="flex items-center gap-3">
                  <img src={finalImageUrl} alt="Imagen final" className="w-32 h-20 object-cover rounded" />
                  <button type="button" onClick={handleDeleteImage} className="px-3 py-2 bg-red-500 text-white rounded">Eliminar</button>
                </div>
              ) : (
                <input type="file" id="fotoFinal" accept="image/*" capture="environment" {...register("foto_final")} className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-gray-700 font-semibold">Estado</label>
                <select id="done" {...register("done")} className="bg-gray-50 p-2 rounded border border-gray-200">
                  <option value="false">Pendiente</option>
                  <option value="true">Hecho</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="px-4 py-3 rounded-lg secondary-cta">Atrás</button>
                <button type="submit" className="px-6 py-3 rounded-lg primary-cta text-white font-semibold">{loading ? 'Guardando...' : 'Guardar Reporte'}</button>
              </div>
            </div>
          </div>
        )}
      </form>

      {params.id && (
        <div className="flex justify-center mt-3">
          <Button variant="outlined" color="secondary" onClick={() => setOpenEventosModal(true)}>
            Registrar Avance (Eventos)
          </Button>
        </div>
      )}

      <Dialog fullWidth maxWidth="md" open={openEventosModal} onClose={() => setOpenEventosModal(false)}>
        <DialogTitle>
          Registrar Avance
          <IconButton
            aria-label="close"
            onClick={() => setOpenEventosModal(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {/* Render the EventosFormPage inside the modal. It uses useParams(), so ensure params.id is available via route. */}
          <EventosFormPage onSaved={(resp) => {
            // Keep the modal open so the user can verify the new event appears in the list.
            // Show a brief success message.
            Swal.fire({
              icon: 'success',
              title: 'Avance registrado',
              text: resp && resp.descripcion ? resp.descripcion : '',
              timer: 1200,
              showConfirmButton: false,
            });
          }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEventosModal(false)} color="primary">Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Expanded full map modal for preview */}
      <Dialog fullWidth maxWidth="lg" open={showMapModal} onClose={() => setShowMapModal(false)}>
        <DialogTitle>Mapa ampliado</DialogTitle>
        <DialogContent>
          <div style={{ height: '60vh', width: '100%' }}>
            {ubicacionDetail ? (
              <MapPreview lat={Number(ubicacionDetail.lat)} lon={Number(ubicacionDetail.lon)} label={ubicacionDetail.nombre} height={Math.round(window.innerHeight * 0.6)} hideToggle />
            ) : (
              <div className="text-sm text-gray-500">No hay ubicación seleccionada</div>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMapModal(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Coordinate confirmation modal: edit nombre and save Ubicacion */}
      <Dialog open={showCoordModal} onClose={() => setShowCoordModal(false)} fullWidth>
        <DialogTitle>Confirmar ubicación detectada</DialogTitle>
        <DialogContent>
          <div className="mb-2 text-sm text-gray-600">Coordenadas detectadas:</div>
          <div className="mb-2 font-mono text-sm">Lat: {coordLat}</div>
          <div className="mb-4 font-mono text-sm">Lon: {coordLon}</div>
          <div className="mb-2">
            <label className="block text-sm font-semibold mb-1">Nombre para esta ubicación</label>
            <input type="text" value={coordNameInput} onChange={(e) => setCoordNameInput(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="mt-3">
            <MapPreview lat={Number(coordLat)} lon={Number(coordLon)} label={coordNameInput} />
          </div>
        </DialogContent>
          <DialogActions>
          <Button onClick={() => setShowCoordModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!coordNameInput || coordNameInput.trim().length === 0) {
                Swal.fire({ icon: 'warning', title: 'Nombre requerido', text: 'Por favor ingresa un nombre para la ubicación antes de guardar.' });
                return;
              }

              const payload = { lat: coordLat, lon: coordLon, nombre: coordNameInput.trim() };
              const resp = await api.post('/api/v1/ubicaciones/lookup/', payload);

              // Build a local preview object so the form shows coordinates immediately
              const localPreview = {
                id: resp?.data?.id || (resp?.headers && resp.headers.location && resp.headers.location.split('/').filter(Boolean).pop()) || null,
                nombre: coordNameInput.trim(),
                lat: coordLat,
                lon: coordLon,
                status: (resp && (resp.status === 201 || resp.status === 200)) ? 'ready' : 'pending',
              };

              // Immediately show the coordinates and name in the form
              setUbicacionDetail(localPreview);
              if (localPreview.id) setSelectedUbicacionId(localPreview.id);
              setValue('title', localPreview.nombre || '');

              if (resp.status === 201 || resp.status === 200) {
                Swal.fire({ icon: 'success', title: 'Ubicación guardada', timer: 900, showConfirmButton: false });
              } else if (resp.status === 202) {
                Swal.fire({ title: 'Ubicación en cola', text: 'Guardada. Mostrando coordenadas mientras procesamos el nombre refinado.', timer: 1400, showConfirmButton: false });

                // If server returned an id, poll for status updates and replace the name when ready
                const returnedId = localPreview.id;
                if (returnedId) {
                  const poll = async (id, attempts = 0) => {
                    try {
                      const r = await api.get(`/api/v1/ubicaciones/${id}/`);
                      if (r && r.data && r.data.status === 'ready') {
                        const loc2 = r.data;
                        // update both preview and form title with the refined name
                        setUbicacionDetail(prev => ({ ...(prev || {}), nombre: loc2.nombre, lat: loc2.lat, lon: loc2.lon, status: 'ready' }));
                        setValue('title', loc2.nombre || coordNameInput || '');
                        Swal.fire({ icon: 'success', title: 'Ubicación lista', timer: 900, showConfirmButton: false });
                        return;
                      }
                    } catch (e) { console.debug('poll error', e); }
                    if (attempts < 15) setTimeout(() => poll(id, attempts + 1), 2000);
                    else console.debug('Ubicación: polling timed out for id', id);
                  };
                  poll(returnedId);
                }
              }
            } catch (err) {
              console.error('Error saving ubicacion', err);
              Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la ubicación. Revisa la consola.' });
            } finally {
              // close modal but keep the preview visible in the form
              setShowCoordModal(false);
            }
          }}>Guardar ubicación</Button>
        </DialogActions>
      </Dialog>

      <div className="flex justify-center mt-3">
        <Button variant="contained" color="primary" onClick={() => Swal.fire({ icon: 'info', title: 'MUI', text: 'MUI Button works' })}>
          Probar UI (MUI)
        </Button>
      </div>

      {params.id && user.is_superuser && (
        <div className="flex justify-center items-center mt-4">
          <button type="button" onClick={async () => {
            const result = await Swal.fire({ title: '¿Estás seguro de que quieres eliminar este Reporte?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' });
            if (result.isConfirmed) {
              await removeTaskContext(params.id);
              Swal.fire('Eliminado', 'Reporte eliminado', 'success');
              navigate('/tasks');
            }
          }} className="w-1/2 py-2 px-3 uppercase rounded bg-red-500 text-white hover:bg-red-600">Eliminar Reporte</button>
        </div>
      )}
    </div>
  );
}

export default TaskFormPage;