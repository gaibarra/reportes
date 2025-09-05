from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock

from tasks.models import Ubicacion
from tasks.tasks import reverse_geocode_and_update


class UbicacionFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # create a simple user and authenticate
        from django.contrib.auth.models import User
        self.user = User.objects.create_user('tester', 'tester@example.com', 'pass')
        # Using token auth isn't necessary for these tests if views require IsAuthenticated,
        # we will force authentication via force_authenticate on the client.
        self.client.force_authenticate(user=self.user)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch('tasks.tasks.requests.get')
    def test_lookup_eager_runs_and_returns_201_ready(self, mock_get):
        # arrange: patch nominatim response
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'display_name': 'Calle Falsa 123, Ciudad, País'}
        mock_get.return_value = mock_resp

        payload = {'lat': -12.0, 'lon': -77.0, 'nombre': 'Ubicación inicial'}
        resp = self.client.post('/api/v1/ubicaciones/lookup/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        # should have created a Ubicacion and had status ready (eager ran)
        self.assertIn('id', data)
        loc = Ubicacion.objects.get(pk=data['id'])
        self.assertEqual(loc.status, 'ready')
        # nombre should have been replaced by reverse-geocode result
        self.assertIn('Calle Falsa', loc.nombre)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    @patch('tasks.tasks.requests.get')
    def test_lookup_returns_202_and_polling_updates(self, mock_get):
        # arrange: make reverse geocode return a useful name when run
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'display_name': 'Avenida Simulada 999, Ciudad X'}
        mock_get.return_value = mock_resp

        payload = {'lat': -12.5, 'lon': -77.5, 'nombre': 'Temporal'}
        resp = self.client.post('/api/v1/ubicaciones/lookup/', payload, format='json')
        # should be accepted and provide a Location header
        self.assertEqual(resp.status_code, 202)
        self.assertIn('Location', resp.headers)
        data = resp.json()
        self.assertIn('id', data)
        uid = data['id']

        # detail should be pending initially
        det = self.client.get(f'/api/v1/ubicaciones/{uid}/')
        self.assertEqual(det.status_code, 200)
        self.assertEqual(det.json().get('status'), 'pending')

        # simulate background worker run (no celery broker) by calling task function
        reverse_geocode_and_update(uid)

        det2 = self.client.get(f'/api/v1/ubicaciones/{uid}/')
        self.assertEqual(det2.status_code, 200)
        self.assertEqual(det2.json().get('status'), 'ready')
        self.assertIn('Avenida Simulada', det2.json().get('nombre', ''))
