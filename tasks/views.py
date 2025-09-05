from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from django.db import transaction
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.conf import settings
from rest_framework.generics import RetrieveAPIView
import logging
import openai
import json

from .models import Task, Empleado, Evento, Report, Compromiso, Participante
from .serializer import (
    TaskSerializer,
    EmpleadoSerializer,
    EventoSerializer,
    CustomUserDetailsSerializer,
    ReportSerializer,
)
from .notifications import send_notifications_for_event
from .tasks import send_event_notifications
from .serializer import ParticipanteSerializer
from .serializer import UbicacionSerializer
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai.api_key = settings.OPENAI_API_KEY

class ReportCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        logger.info("Datos de la solicitud recibidos: %s", request.data)

        serializer = ReportSerializer(data=request.data)
        if serializer.is_valid():
            report = serializer.save()
            logger.info(f"Informe guardado con ID: {report.id}")
            # Start seguimiento: create an Evento on the related Task if possible
            try:
                # Determine the related task: Report.model has a FK to Task as 'task'
                related_task = getattr(report, 'task', None)
                if related_task:
                    # Try to find an Empleado for the current user
                    empleado = None
                    try:
                        empleado = Empleado.objects.get(user=request.user)
                    except Empleado.DoesNotExist:
                        # Auto-create a minimal Empleado record for this user
                        try:
                            nombre = (request.user.get_full_name() or request.user.username) if hasattr(request.user, 'get_full_name') else request.user.username
                        except Exception:
                            nombre = getattr(request.user, 'username', 'unknown')
                        empleado = Empleado.objects.create(
                            user=request.user,
                            nombre_empleado=nombre,
                            ubicacion='',
                            campus='',
                            puesto='',
                            email=getattr(request.user, 'email', '') or '',
                            celular=''
                        )
                        logger.info(f'Empleado auto-creado id={empleado.id} para user {request.user.username}')

                    evento_descr = f"Seguimiento iniciado desde informe {report.id}"
                    evento = Evento.objects.create(descripcion=evento_descr, reporte=related_task, empleado=empleado)
                    logger.info(f"Evento de seguimiento creado (id={evento.id}) para tarea {related_task.id}")

                    # If the request included participantes, create or link them and attach to the evento
                    try:
                        participantes_data = request.data.get('participantes')
                        participantes_instances = []
                        if participantes_data:
                            # participantes_data may be a JSON string or a list
                            if isinstance(participantes_data, str):
                                try:
                                    participantes_data = json.loads(participantes_data)
                                except Exception:
                                    participantes_data = None

                            if isinstance(participantes_data, list):
                                from .models import Participante
                                for p in participantes_data:
                                    if isinstance(p, dict):
                                        pid = p.get('id')
                                        if pid:
                                            try:
                                                part = Participante.objects.get(pk=pid)
                                            except Participante.DoesNotExist:
                                                part = None
                                        else:
                                            # create a new participante record
                                            part = Participante.objects.create(
                                                nombre=p.get('nombre', 'Sin nombre'),
                                                rol=p.get('rol', 'Otro'),
                                                organizacion=p.get('organizacion', ''),
                                                email=p.get('email', ''),
                                                celular=p.get('celular', ''),
                                            )
                                        if part:
                                            participantes_instances.append(part)
                                    else:
                                        # assume it's an id
                                        try:
                                            part = Participante.objects.get(pk=int(p))
                                            participantes_instances.append(part)
                                        except Exception:
                                            continue

                        if participantes_instances:
                            evento.participantes.set(participantes_instances)
                    except Exception:
                        logger.exception('Error procesando participantes inline para el evento')

                    # Create a default compromiso 7 days in the future
                    try:
                        from datetime import timedelta, datetime
                        fecha_compromiso = datetime.now() + timedelta(days=7)
                        compromiso = Compromiso.objects.create(
                            tarea=related_task,
                            evento=evento,
                            descripcion=f"Compromiso generado automáticamente tras registro de informe {report.id}",
                            fecha_compromiso=fecha_compromiso,
                            creado_por=empleado,
                        )
                        # attach same participantes to compromiso
                        try:
                            if participantes_instances:
                                compromiso.participantes.set(participantes_instances)
                        except Exception:
                            logger.exception('No se pudo asignar participantes al compromiso')
                        logger.info(f"Compromiso creado id={compromiso.id} para tarea {related_task.id}")
                    except Exception as e:
                        logger.exception(f"No se pudo crear compromiso automático: {e}")

                    # Enqueue notifications (email/WhatsApp) for the created evento
                    try:
                        send_event_notifications.delay(evento.id, report.id)
                    except Exception:
                        logger.exception('Error encolando notificaciones tras crear evento desde informe')
                else:
                    logger.debug('Report has no related task; skipping seguimiento event creation')
            except Exception as e:
                logger.error(f"No se pudo crear evento de seguimiento tras guardar report {report.id}: {e}")
        
            # Construct the initial message for the GPT model
            prompt = (
                f"Generate a report with the following details:\n"
                f"Title: {report.title}\n"
                f"Description: {report.description}\n"
                f"Fecha de Resolución: {report.fecha_resolucion.isoformat() if report.fecha_resolucion else 'No especificada'}\n"
                f"URL de la Imagen Inicial: {report.foto_inicial_url if report.foto_inicial_url else 'No se proporcionó imagen'}\n"
            )

            try:
                # Retrieve the pre-defined assistant
                assistant_id = "asst_dcExn8qhMa97OCBxqOOHxI4m"

                # If we created an evento/compromiso above, include them in the response
                try:
                    from .serializer import EventoSerializer, CompromisoSerializer
                    evento_ser = EventoSerializer(evento)
                    compromiso_ser = CompromisoSerializer(compromiso)
                    return Response(
                        {
                            "report": ReportSerializer(report).data,
                            "evento": evento_ser.data,
                            "compromiso": compromiso_ser.data,
                        },
                        status=status.HTTP_201_CREATED,
                    )
                except Exception:
                    return Response(
                        {"report": ReportSerializer(report).data},
                        status=status.HTTP_201_CREATED,
                    )

            except Exception as e:
                logger.error(f"Error en la solicitud al asistente: {e}")
                return Response(
                    {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        else:
            logger.error(f"Errores del serializador: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CustomUserDetailsSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = CustomUserDetailsSerializer(request.user, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        serializer = CustomUserDetailsSerializer(
            request.user, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)
        if user:
            token, created = Token.objects.get_or_create(user=user)
            user_data = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_superuser": user.is_superuser,
            }
            return Response(
                {"key": token.key, "user": user_data}, status=status.HTTP_200_OK
            )
        return Response(
            {"error": "Credenciales inválidas"}, status=status.HTTP_400_BAD_REQUEST
        )

class TaskView(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    queryset = Task.objects.all()
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.done and not instance.resuelto_por:
            instance.resuelto_por = self.request.user
            instance.save()

class EmpleadoView(viewsets.ModelViewSet):
    queryset = Empleado.objects.all()
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]


class ParticipanteView(viewsets.ModelViewSet):
    queryset = Participante.objects.all()
    serializer_class = ParticipanteSerializer
    permission_classes = [IsAuthenticated]

class EventoView(viewsets.ModelViewSet):
    queryset = Evento.objects.all()
    serializer_class = EventoSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        instance = serializer.save()
        # attach participantes if provided
        try:
            participantes_data = self.request.data.get('participantes')
            participantes_instances = []
            if participantes_data:
                if isinstance(participantes_data, str):
                    try:
                        participantes_data = json.loads(participantes_data)
                    except Exception:
                        participantes_data = None

                if isinstance(participantes_data, list):
                    from .models import Participante
                    for p in participantes_data:
                        if isinstance(p, dict):
                            pid = p.get('id')
                            if pid:
                                try:
                                    part = Participante.objects.get(pk=pid)
                                except Participante.DoesNotExist:
                                    part = None
                            else:
                                part = Participante.objects.create(
                                    nombre=p.get('nombre', 'Sin nombre'),
                                    rol=p.get('rol', 'Otro'),
                                    organizacion=p.get('organizacion', ''),
                                    email=p.get('email', ''),
                                    celular=p.get('celular', ''),
                                )
                            if part:
                                participantes_instances.append(part)
                        else:
                            try:
                                part = Participante.objects.get(pk=int(p))
                                participantes_instances.append(part)
                            except Exception:
                                continue

            if participantes_instances:
                instance.participantes.set(participantes_instances)
        except Exception:
            logger.exception('Error procesando participantes inline en EventoView.perform_create')
        # create compromiso 7 days ahead
        try:
            from datetime import datetime, timedelta
            empleado = None
            try:
                empleado = Empleado.objects.get(user=self.request.user)
            except Empleado.DoesNotExist:
                empleado = None
            fecha_compromiso = datetime.now() + timedelta(days=7)
            compromiso = Compromiso.objects.create(
                tarea=instance.reporte,
                evento=instance,
                descripcion=f"Compromiso automático tras registrar avance (evento {instance.id})",
                fecha_compromiso=fecha_compromiso,
                creado_por=empleado,
            )
            logger.info(f"Compromiso creado id={compromiso.id} para tarea {instance.reporte.id}")
        except Exception:
            logger.exception('Error creando compromiso automático en EventoView.perform_create')

        try:
            send_event_notifications.delay(instance.id, None)
        except Exception:
            logger.exception('Error encolando notificaciones desde EventoView.perform_create')

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            instance = serializer.save()
            # ensure perform_create logic runs
            try:
                self.perform_create(serializer)
            except Exception:
                logger.exception('Error en perform_create dentro de EventoView.create')

            # build compromiso if created by perform_create
            try:
                from .serializer import EventoSerializer, CompromisoSerializer
                evento_ser = EventoSerializer(instance)
                # try to fetch a compromiso related to this evento
                compromiso = instance.compromisos.first()
                compromiso_ser = CompromisoSerializer(compromiso) if compromiso else None
                payload = {"evento": evento_ser.data}
                if compromiso_ser:
                    payload["compromiso"] = compromiso_ser.data
                headers = self.get_success_headers(serializer.data)
                return Response(payload, status=status.HTTP_201_CREATED, headers=headers)
            except Exception:
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.exception('Unhandled exception in EventoView.create')
            return Response({"error": "Internal server error", "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_events(request, task_id):
    try:
        task = Task.objects.get(pk=task_id)
    except Task.DoesNotExist:
        return Response(
            {"error": "Tarea no encontrada"}, status=status.HTTP_404_NOT_FOUND
        )

    if request.method == "GET":
        events = task.eventos.all()
        serializer = EventoSerializer(events, many=True)
        return Response(serializer.data)
    elif request.method == "POST":
        try:
            serializer = EventoSerializer(data=request.data)
            if serializer.is_valid():
                event = serializer.save(reporte=task)
                # If participantes were included in the request, attach/create them
                try:
                    participantes_data = request.data.get('participantes')
                    participantes_instances = []
                    if participantes_data:
                        if isinstance(participantes_data, str):
                            try:
                                participantes_data = json.loads(participantes_data)
                            except Exception:
                                participantes_data = None

                        if isinstance(participantes_data, list):
                            from .models import Participante
                            for p in participantes_data:
                                if isinstance(p, dict):
                                    pid = p.get('id')
                                    if pid:
                                        try:
                                            part = Participante.objects.get(pk=pid)
                                        except Participante.DoesNotExist:
                                            part = None
                                    else:
                                        part = Participante.objects.create(
                                            nombre=p.get('nombre', 'Sin nombre'),
                                            rol=p.get('rol', 'Otro'),
                                            organizacion=p.get('organizacion', ''),
                                            email=p.get('email', ''),
                                            celular=p.get('celular', ''),
                                        )
                                    if part:
                                        participantes_instances.append(part)
                                else:
                                    try:
                                        part = Participante.objects.get(pk=int(p))
                                        participantes_instances.append(part)
                                    except Exception:
                                        continue

                    if participantes_instances:
                        event.participantes.set(participantes_instances)
                except Exception:
                    logger.exception('Error procesando participantes inline en task_events POST')
                # create a compromiso 7 days ahead
                compromiso = None
                try:
                    from datetime import datetime, timedelta
                    empleado = None
                    try:
                        empleado = Empleado.objects.get(user=request.user)
                    except Empleado.DoesNotExist:
                        empleado = None
                    fecha_compromiso = datetime.now() + timedelta(days=7)
                    compromiso = Compromiso.objects.create(
                        tarea=task,
                        evento=event,
                        descripcion=f"Compromiso automático tras registrar avance (evento {event.id})",
                        fecha_compromiso=fecha_compromiso,
                        creado_por=empleado,
                    )
                    logger.info(f"Compromiso creado id={compromiso.id} para tarea {task.id}")
                except Exception:
                    logger.exception('Error creando compromiso automático en task_events POST')

                # send notifications asynchronously
                try:
                    send_event_notifications.delay(event.id, None)
                except Exception:
                    logger.exception('Error encolando notificaciones tras crear evento')

                try:
                    from .serializer import EventoSerializer, CompromisoSerializer
                    evento_ser = EventoSerializer(event)
                    payload = {"evento": evento_ser.data}
                    if compromiso is not None:
                        try:
                            compromiso_ser = CompromisoSerializer(compromiso)
                            payload["compromiso"] = compromiso_ser.data
                        except Exception:
                            logger.exception('Error serializing compromiso in task_events POST')
                    return Response(payload, status=status.HTTP_201_CREATED)
                except Exception:
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception('Unhandled exception in task_events POST')
            return Response({"error": "Internal server error", "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_compromisos(request, task_id):
    try:
        task = Task.objects.get(pk=task_id)
    except Task.DoesNotExist:
        return Response({"error": "Tarea no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    from .serializer import CompromisoSerializer

    if request.method == "GET":
        compromisos = task.compromisos.all()
        serializer = CompromisoSerializer(compromisos, many=True)
        return Response(serializer.data)
    else:
        data = request.data.copy()
        data['tarea'] = task.id
        serializer = CompromisoSerializer(data=data)
        if serializer.is_valid():
            compromiso = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_superuser": user.is_superuser,
                "is_staff": user.is_staff,
                "message": "Datos del perfil recuperados con éxito",
            }
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    """Return aggregated data useful for supervisor dashboards.

    - total_tasks
    - open_tasks
    - closed_tasks
    - upcoming_compromisos (next 7 days)
    - recent_eventos (last 20)
    """
    from django.utils import timezone
    from datetime import timedelta

    now = timezone.now()
    next_week = now + timedelta(days=7)

    total_tasks = Task.objects.count()
    open_tasks = Task.objects.filter(done=False).count()
    closed_tasks = Task.objects.filter(done=True).count()

    upcoming_compromisos_qs = Compromiso.objects.filter(fecha_compromiso__gte=now, fecha_compromiso__lte=next_week).order_by('fecha_compromiso')[:50]
    upcoming_compromisos = []
    for c in upcoming_compromisos_qs:
        upcoming_compromisos.append({
            'id': c.id,
            'tarea': c.tarea.id if c.tarea else None,
            'descripcion': c.descripcion,
            'fecha_compromiso': c.fecha_compromiso,
        })

    recent_eventos_qs = Evento.objects.all().order_by('-fecha')[:20]
    recent_eventos = EventoSerializer(recent_eventos_qs, many=True).data

    payload = {
        'total_tasks': total_tasks,
        'open_tasks': open_tasks,
        'closed_tasks': closed_tasks,
        'upcoming_compromisos': upcoming_compromisos,
        'recent_eventos': recent_eventos,
    }
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_timeline(request, task_id):
    """Return a timeline (events + compromisos) for a given task.

    The response is ordered chronologically and suitable for a timeline UI.
    """
    try:
        task = Task.objects.get(pk=task_id)
    except Task.DoesNotExist:
        return Response({'error': 'Tarea no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    eventos = Evento.objects.filter(reporte=task).order_by('fecha')
    compromisos = Compromiso.objects.filter(tarea=task).order_by('fecha_compromiso')

    eventos_ser = EventoSerializer(eventos, many=True).data
    compromisos_ser = []
    for c in compromisos:
        compromisos_ser.append({
            'id': c.id,
            'descripcion': c.descripcion,
            'fecha_compromiso': c.fecha_compromiso,
            'creado_por': c.creado_por.id if c.creado_por else None,
            'participantes': [p.id for p in c.participantes.all()],
        })

    # Merge and sort by date to create a timeline
    timeline_items = []
    for e in eventos_ser:
        timeline_items.append({
            'type': 'evento',
            'date': e.get('fecha'),
            'data': e,
        })
    for c in compromisos_ser:
        timeline_items.append({
            'type': 'compromiso',
            'date': c.get('fecha_compromiso'),
            'data': c,
        })

    # sort by date (None values will be pushed to the end)
    timeline_items.sort(key=lambda it: it.get('date') or '')

    return Response({'timeline': timeline_items})

class GPTResponseView(APIView):
    def post(self, request, *args, **kwargs):
        prompt = request.data.get("prompt")

        if not prompt:
            return Response(
                {"error": "El prompt es requerido."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            response = openai.Completion.create(
                model="gpt-3.5-turbo", prompt=prompt, max_tokens=150, temperature=0.7
            )

            if response and "choices" in response and len(response["choices"]) > 0:
                gpt_response = response["choices"][0]["text"].strip()
                return Response({"response": gpt_response}, status=status.HTTP_200_OK)
            else:
                return Response(
                    {"error": "Formato de respuesta inválido del GPT"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Exception as e:
            logger.error(f"Error en la consulta al GPT: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class GPTReportDetailView(RetrieveAPIView):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    lookup_field = 'id'  # Asegúrate de que el campo de búsqueda sea 'id'

@api_view(['DELETE'])
def delete_task_image(request, pk, image_field):
    try:
        task = Task.objects.get(pk=pk)
    except Task.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if image_field == 'foto_final':
        task.foto_final.delete()
    
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
def empleado_detail(request):
    try:
        empleado = Empleado.objects.get(user=request.user)
        serializer = EmpleadoSerializer(empleado)
        return Response(serializer.data)
    except Empleado.DoesNotExist:
        return Response({'error': 'Empleado no encontrado'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ubicacion_lookup(request):
    """Create an Ubicacion from coordinates and schedule a reverse-geocode job.

    POST payload: { lat: number, lon: number, nombre: string }

    Behavior:
    - nombre is required.
    - always create a new Ubicacion with status='pending'.
    - schedule `reverse_geocode_and_update` after DB commit (transaction.on_commit).
    - if the background work runs synchronously (CELERY_TASK_ALWAYS_EAGER), return 201 when ready.
    - otherwise return 202 Accepted and a Location header pointing to the detail endpoint.
    """
    try:
        data = request.data
        lat = data.get('lat')
        lon = data.get('lon')
        nombre = data.get('nombre')

        if lat is None or lon is None:
            return Response({'error': 'lat y lon son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except Exception:
            return Response({'error': 'lat y lon deben ser números'}, status=status.HTTP_400_BAD_REQUEST)

        if not nombre or str(nombre).strip() == "":
            return Response({'error': 'nombre es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import Ubicacion
        from .tasks import reverse_geocode_and_update

        try:
            # create as pending; reverse-geocode will refine the name/status
            new_loc = Ubicacion.objects.create(nombre=nombre.strip(), lat=lat_f, lon=lon_f, status='pending')
        except Exception:
            logger.exception('Error creando Ubicacion')
            return Response({'error': 'No se pudo crear ubicación'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Enqueue the reverse-geocode only after the DB transaction commits
        try:
            def _enqueue():
                try:
                    # If tests or local config use eager execution, run synchronously
                    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                        reverse_geocode_and_update(new_loc.id)
                    else:
                        reverse_geocode_and_update.delay(new_loc.id)
                except Exception:
                    logger.exception('Error encolando reverse_geocode task')

            transaction.on_commit(_enqueue)
        except Exception:
            logger.exception('Error programando encolado post-commit')

        # If the task was executed eagerly it may already be ready in DB; refresh
        try:
            new_loc.refresh_from_db()
        except Exception:
            pass

        serializer = UbicacionSerializer(new_loc)
        if new_loc.status == 'ready':
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            # Return 202 Accepted and Location header for polling
            hdrs = {'Location': f'/api/v1/ubicaciones/{new_loc.id}/'}
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED, headers=hdrs)
    except Exception as e:
        logger.exception('Error en ubicacion_lookup')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ubicacion_detail(request, pk):
    """Return Ubicacion detail for polling from the frontend."""
    from .models import Ubicacion
    try:
        u = Ubicacion.objects.get(pk=pk)
    except Ubicacion.DoesNotExist:
        return Response({'error': 'Ubicación no encontrada'}, status=status.HTTP_404_NOT_FOUND)
    serializer = UbicacionSerializer(u)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """Lightweight health check for the API (no auth required)."""
    return Response({"status": "ok"}, status=status.HTTP_200_OK)