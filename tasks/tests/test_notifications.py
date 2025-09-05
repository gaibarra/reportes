from django.test import SimpleTestCase, override_settings
from types import SimpleNamespace
from django.template.loader import render_to_string
from unittest.mock import patch
import importlib

from tasks import notifications


@override_settings(PHONE_DEFAULT_REGION='US', BACKEND_URL='https://example.com', DEFAULT_FROM_EMAIL='no-reply@example.com')
class NotificationsTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # If phonenumbers was installed after the notifications module was imported,
        # reload notifications so it can pick up the library.
        try:
            import phonenumbers as _pn  # noqa: F401
            importlib.reload(notifications)
        except Exception:
            # leave as-is; tests will assert behavior accordingly
            pass
    def test_normalize_phone(self):
        # US formatted number -> E.164
        raw = '202-555-0125'
        normalized = notifications._normalize_phone(raw, default_region='US')
        if notifications.phonenumbers is None:
            # fallback: original string
            self.assertEqual(normalized, raw)
        else:
            self.assertEqual(normalized, '+12025550125')

        # Already E.164 stays E.164
        raw2 = '+1 202-555-0133'
        normalized2 = notifications._normalize_phone(raw2, default_region='US')
        if notifications.phonenumbers is None:
            self.assertEqual(normalized2, raw2)
        else:
            self.assertEqual(normalized2, '+12025550133')

    def test_render_plaintext_template(self):
        context = {
            'tarea': SimpleNamespace(title='Tarea X', id=123),
            'evento': SimpleNamespace(descripcion='Descripcion de avance'),
            'report': SimpleNamespace(title='Reporte Y', description='Detalle'),
            'site_url': 'https://example.com'
        }
        rendered = render_to_string('tasks/email/event_notification.txt', context)
        self.assertIn('Tarea: Tarea X', rendered)
        self.assertIn('Avance:', rendered)
        self.assertIn('Ver la tarea en: https://example.com/tasks/123', rendered)

    def test_send_notifications_calls_with_normalized_numbers_and_email(self):
        empleado = SimpleNamespace(email='user@example.com', celular='202-555-0125')
        participante = SimpleNamespace(celular='202-555-0133')
        participantes_container = SimpleNamespace(all=lambda: [participante])

        evento = SimpleNamespace(
            reporte=SimpleNamespace(title='Tarea X', id=123),
            empleado=empleado,
            participantes=participantes_container,
            descripcion='Evento description'
        )
        report = SimpleNamespace(title='Reporte Y', description='Detalle')

        sent = {'emails': [], 'whats': []}

        def fake_send_email(subject, text_body, recipient_list, context=None, template_html=None):
            sent['emails'].append({'subject': subject, 'to': tuple(recipient_list), 'template': template_html})
            return True

        def fake_send_whatsapp(to_number, body):
            sent['whats'].append({'to': to_number, 'body': body})
            return True

        with patch('tasks.notifications._send_email', side_effect=fake_send_email) as _e, \
             patch('tasks.notifications._send_whatsapp_via_twilio', side_effect=fake_send_whatsapp) as _w:
            results = notifications.send_notifications_for_event(evento, report=report)

        # Assert email was attempted
        self.assertTrue(results.get('email') or len(sent['emails']) > 0)
        self.assertEqual(sent['emails'][0]['to'], ('user@example.com',))

        # Assert WhatsApp was attempted to correct numbers depending on normalization availability
        self.assertTrue(results.get('whatsapp') or len(sent['whats']) > 0)
        targets = {s['to'] for s in sent['whats']}
        if notifications.phonenumbers is None:
            # fallback: raw numbers expected
            self.assertIn('202-555-0125', targets)
            self.assertIn('202-555-0133', targets)
        else:
            self.assertIn('+12025550125', targets)
            self.assertIn('+12025550133', targets)
