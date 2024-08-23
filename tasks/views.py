from rest_framework import status
from .models import Task
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.views import APIView
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from openai import OpenAI
from rest_framework.generics import RetrieveAPIView
import logging
import openai

from .serializer import (
    TaskSerializer,
    EmpleadoSerializer,
    EventoSerializer,
    CustomUserDetailsSerializer,
    ReportSerializer,
)
from .models import Task, Empleado, Evento, Report

logger = logging.getLogger(__name__)

# Initialize OpenAI client

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

                # Create a thread
                # # thread = openai.Thread.create()

                # # # Add the user's message to the thread
                # # message = openai.Thread.Message.create(
                # #     thread_id=thread.id,
                # #     role="user",
                # #     content=prompt
                # # )

                # # # Event handler to manage the response
                # # class EventHandler(openai.AssistantEventHandler):
                # #     def on_text_created(self, text) -> None:
                # #         print(f"\nassistant > ", end="", flush=True)

                # #     def on_text_delta(self, delta, snapshot):
                # #         print(delta.value, end="", flush=True)

                # # # Execute the thread with the assistant
                # # with openai.Thread.Run.stream(
                # #     thread_id=thread.id,
                # #     assistant_id=assistant_id,
                # #     instructions="Please generate a detailed report.",
                # #     event_handler=EventHandler(),
                # # ) as stream:
                # #     stream.until_done()

                # # # Extract the generated response
                # # assistant_response = message.content

                # # # Save the GPT-generated report content
                # # report.gpt_report = assistant_response.strip()
                # # report.save()

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


class EmpleadoView(viewsets.ModelViewSet):
    queryset = Empleado.objects.all()
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]


class EventoView(viewsets.ModelViewSet):
    queryset = Evento.objects.all()
    serializer_class = EventoSerializer
    permission_classes = [IsAuthenticated]


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
        serializer = EventoSerializer(data=request.data)
        if serializer.is_valid():
            event = serializer.save(reporte=task)
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