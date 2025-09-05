from django.test import TestCase, Client
from django.urls import reverse
from unittest import mock
from tasks.models import Ubicacion
from tasks.tasks import reverse_geocode_and_update


class UbicacionEndpointTests(TestCase):
    def setUp(self):
        # Patch the Celery task .delay so tests don't attempt to contact a broker
        self._patcher = mock.patch('tasks.tasks.reverse_geocode_and_update.delay')
        self.mock_delay = self._patcher.start()

        self.client = Client()
        # Create and login a user
        from django.contrib.auth.models import User
        self.user = User.objects.create_user('testuser', password='pass')
        self.client.login(username='testuser', password='pass')

    def tearDown(self):
        try:
            self._patcher.stop()
        except Exception:
            pass

    def test_post_without_name_creates_processing_and_returns_202(self):
        url = reverse('ubicacion_lookup')
        resp = self.client.post(url, {'lat': 20.0, 'lon': -89.0}, content_type='application/json')
        # now the API requires a nombre before creating a Ubicacion
        self.assertEqual(resp.status_code, 400)

    def test_post_with_name_creates_new_ubicacion_and_returns_201(self):
        url = reverse('ubicacion_lookup')
        resp = self.client.post(url, {'lat': 20.0, 'lon': -89.0, 'nombre': 'Plaza Central'}, content_type='application/json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn('id', data)
        ub = Ubicacion.objects.get(pk=data['id'])
        self.assertEqual(ub.status, 'ready')
        self.assertEqual(ub.nombre, 'Plaza Central')


class ReverseGeocodeTaskTests(TestCase):
    def setUp(self):
        # Prevent post_save signal from enqueuing the Celery task which would
        # attempt to contact Redis; patch the delay method.
        self._patcher = mock.patch('tasks.tasks.reverse_geocode_and_update.delay')
        self.mock_delay = self._patcher.start()

        self.ub = Ubicacion.objects.create(nombre='Tmp', lat=20.0, lon=-89.0, status='processing')

    def tearDown(self):
        try:
            self._patcher.stop()
        except Exception:
            pass

    @mock.patch('requests.get')
    def test_reverse_geocode_updates_name_and_status(self, mock_get):
        mock_resp = mock.Mock()
        mock_resp.ok = True
        mock_resp.json.return_value = {'display_name': 'Calle Falsa 123, Ciudad'}
        mock_get.return_value = mock_resp

        result = reverse_geocode_and_update(self.ub.id)
        self.ub.refresh_from_db()
        self.assertEqual(self.ub.status, 'ready')
        self.assertEqual(self.ub.nombre, 'Calle Falsa 123, Ciudad')
