from django.test import TestCase, override_settings
from unittest.mock import patch

from django.contrib.auth.models import User
from tasks.models import Empleado, Evento, Report, Task, Ubicacion
from tasks.tasks import send_event_notifications


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, PHONE_DEFAULT_REGION='US', BACKEND_URL='https://example.com')
class CeleryTaskTests(TestCase):
    def setUp(self):
        # minimal setup: create a task, user, empleado, report, evento
        # create a Ubicacion first because Task.ubicacion is required
        self.ubicacion = Ubicacion.objects.create(
            nombre='Ubicacion Test', lat=0.0, lon=0.0, status='ready'
        )
        self.task = Task.objects.create(title='Tarea Test', ubicacion=self.ubicacion)
        user = User.objects.create_user(username='testuser', password='pass')
        # Empleado expects a OneToOne User; model fields are nombre_empleado, email, celular
        self.empleado = Empleado.objects.create(
            user=user,
            nombre_empleado='User Test',
            ubicacion='HQ',
            campus='Montejo',
            email='user@example.com',
            celular='2025550125'
        )
        self.report = Report.objects.create(title='Reporte Test', description='Desc', task=self.task)
        self.evento = Evento.objects.create(reporte=self.task, empleado=self.empleado, descripcion='Avance test')

    def test_send_event_notifications_task_calls_helper(self):
        with patch('tasks.tasks.send_notifications_for_event') as mock_send:
            mock_send.return_value = {'email': True, 'whatsapp': True}
            # call the task implementation synchronously via .run to ensure it executes in tests
            result = send_event_notifications.run(self.evento.id, report_id=self.report.id)
            mock_send.assert_called_once()
            self.assertEqual(result, {'email': True, 'whatsapp': True})
