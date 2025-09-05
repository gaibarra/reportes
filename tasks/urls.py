from django.urls import include, path
from rest_framework import routers
from rest_framework.documentation import include_docs_urls
from .views import (
    EmpleadoView, EventoView, LoginView, TaskView, task_events,
    task_compromisos, ParticipanteView,
    CurrentUserView, MyProfileView, ReportCreateView, GPTResponseView, GPTReportDetailView, delete_task_image, empleado_detail, health
)
from .views import ubicacion_lookup
from .views import ubicacion_detail

from .views import dashboard_overview, task_timeline

# Definir routers
router = routers.DefaultRouter()
router.register(r'tasks', TaskView, basename='tasks')
router.register(r'empleados', EmpleadoView, basename='empleados')
router.register(r'participantes', ParticipanteView, basename='participantes')

# Router separado para los eventos
eventos_router = routers.DefaultRouter()
eventos_router.register(r'eventos', EventoView, basename='eventos')

urlpatterns = [
    path('', include(router.urls)),  # Incluye las rutas del router principal
    path('health/', health, name='health'),
    path('tasks/<int:task_id>/events/', task_events, name='task_events'),  # Ruta personalizada para eventos de tareas
    path('tasks/<int:task_id>/compromisos/', task_compromisos, name='task_compromisos'),
    path('dashboard/overview/', dashboard_overview, name='dashboard_overview'),
    path('tasks/<int:task_id>/timeline/', task_timeline, name='task_timeline'),
    path('login/', LoginView.as_view(), name='login'),
    path('user/', CurrentUserView.as_view(), name='current-user'),  # Endpoint para el usuario actual
    path('user/debug/', MyProfileView.as_view(), name='profile-debug'),  # Ruta de depuración para verificar is_superuser e is_staff
    path('auth/', include('dj_rest_auth.urls')),  # Rutas de dj-rest-auth
    path('auth/registration/', include('dj_rest_auth.registration.urls')),  # Rutas de registro
    path('docs/', include_docs_urls(title='Tasks API')),  # Documentación de la API
    path('gpt-response/', GPTResponseView.as_view(), name='gpt_response'),
    path('gpt-report/', ReportCreateView.as_view(), name='gpt-report'),
    path('informe-gpt/<int:id>/', GPTReportDetailView.as_view(), name='gpt_report_detail'), 
    path('tasks/<int:pk>/delete-image/<str:image_field>/', delete_task_image, name='delete-task-image'),
    path('empleado-detail/', empleado_detail, name='empleado_detail'),
    path('ubicaciones/lookup/', ubicacion_lookup, name='ubicacion_lookup'),
    path('ubicaciones/<int:pk>/', ubicacion_detail, name='ubicacion_detail'),
]