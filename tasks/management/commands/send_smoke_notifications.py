from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.contrib.auth.models import User
from django.template.loader import render_to_string
import uuid

from tasks.models import Task, Report, Empleado, Evento, Participante
from tasks import notifications


class Command(BaseCommand):
    help = 'Smoke test notifications: dry-run by default, use --live to actually send (requires credentials)'

    def add_arguments(self, parser):
        parser.add_argument('--live', action='store_true', help='Actually send messages (requires Twilio & email configured)')
        parser.add_argument('--phone', help='Override employee celular for the smoke test')
        parser.add_argument('--email', help='Override employee email for the smoke test')
        parser.add_argument('--require', action='append', help='Add a required setting name to check before live send (can be used multiple times)')

    def handle(self, *args, **options):
        live = options.get('live')
        phone = options.get('phone')
        email = options.get('email')

        self.stdout.write('Preparing smoke test (dry-run by default)')

        username = f'smoke_{uuid.uuid4().hex[:8]}'
        user = User.objects.create_user(username=username, password='password')

        empleado_email = email or getattr(settings, 'SMOKE_EMAIL', 'smoke@example.com')
        empleado_cel = phone or getattr(settings, 'SMOKE_PHONE', '')

        empleado = Empleado.objects.create(
            user=user,
            nombre_empleado='Smoke Test',
            ubicacion='HQ',
            campus='Montejo',
            email=empleado_email,
            celular=empleado_cel,
        )

        task = Task.objects.create(title=f'Smoke Task {username}')
        report = Report.objects.create(title='Smoke Report', description='Smoke test report', task=task)

        evento = Evento.objects.create(reporte=task, empleado=empleado, descripcion='Smoke test: please ignore')

        # Render templates to show what would be sent
        context = {'tarea': task, 'evento': evento, 'report': report, 'site_url': getattr(settings, 'BACKEND_URL', '')}

        text = render_to_string('tasks/email/event_notification.txt', context)
        html = render_to_string('tasks/email/event_notification.html', context)

        self.stdout.write('\n--- Rendered plaintext email ---')
        self.stdout.write(text)
        self.stdout.write('\n--- Rendered HTML email (truncated) ---')
        self.stdout.write(html[:1000])

        # Show normalized phone if possible
        norm = notifications._normalize_phone(empleado.celular, default_region=getattr(settings, 'PHONE_DEFAULT_REGION', None))
        self.stdout.write(f'\nEmployee email: {empleado.email}')
        self.stdout.write(f'Employee raw celular: {empleado.celular}')
        self.stdout.write(f'Employee normalized celular: {norm}')

        # Identify Twilio config
        tw_cfg = {
            'TWILIO_ACCOUNT_SID': getattr(settings, 'TWILIO_ACCOUNT_SID', None),
            'TWILIO_AUTH_TOKEN': getattr(settings, 'TWILIO_AUTH_TOKEN', None),
            'TWILIO_WHATSAPP_FROM': getattr(settings, 'TWILIO_WHATSAPP_FROM', None),
        }
        self.stdout.write('\nTwilio config present: ' + str(all(tw_cfg.values())))

        if not live:
            self.stdout.write('\nDry-run finished. To perform a live send, re-run with --live and ensure email/TWILIO settings are set in Django settings or environment.')
            return

        # Safety checks for live send — configurable
        default_required = [
            'DEFAULT_FROM_EMAIL',
            'EMAIL_HOST',
            'EMAIL_HOST_USER',
            'EMAIL_HOST_PASSWORD',
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_WHATSAPP_FROM',
        ]

        required = list(getattr(settings, 'SMOKE_REQUIRED_SETTINGS', default_required))
        # Append any additional required settings passed on CLI
        cli_requires = options.get('require') or []
        for r in cli_requires:
            if r not in required:
                required.append(r)

        missing = [k for k in required if not getattr(settings, k, None)]

        if missing:
            msg = f"Cannot run live send; missing settings: {', '.join(sorted(set(missing)))}"
            # Use CommandError to return non-zero exit and show message
            raise CommandError(msg)

        # Live send
        self.stdout.write('\nPerforming live send...')
        result = notifications.send_notifications_for_event(evento, report=report)
        self.stdout.write(f'Live send result: {result}')

        self.stdout.write('\nCompleted smoke test.')
