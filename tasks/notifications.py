import logging
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    import phonenumbers
except Exception:
    phonenumbers = None


def _normalize_phone(number, default_region=None):
    """Normalize and validate phone number using phonenumbers.

    Returns E.164 string or None if invalid or phonenumbers not available.
    """
    if not number:
        return None
    if not phonenumbers:
        logger.warning('phonenumbers no está instalado; no se validará el número')
        return number
    try:
        # Try parsing; if number already in E.164 it's fine
        parsed = phonenumbers.parse(number, default_region)
        if not phonenumbers.is_possible_number(parsed) or not phonenumbers.is_valid_number(parsed):
            return None
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        return None


def _send_email(subject, text_body, recipient_list, context=None, template_html=None):
    try:
        if template_html:
            html_content = render_to_string(template_html, context or {})
        else:
            html_content = None

        # Send multi-part email
        msg = EmailMultiAlternatives(subject=subject, body=text_body, from_email=settings.DEFAULT_FROM_EMAIL, to=recipient_list)
        if html_content:
            msg.attach_alternative(html_content, 'text/html')
        msg.send(fail_silently=False)
        logger.info(f"Email enviado a {recipient_list} subject={subject}")
        return True
    except Exception as e:
        logger.exception(f"Error al enviar email: {e}")
        return False


def _send_whatsapp_via_twilio(to_number, body):
    try:
        from twilio.rest import Client

        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        whatsapp_from = getattr(settings, 'TWILIO_WHATSAPP_FROM', None)

        if not (account_sid and auth_token and whatsapp_from):
            logger.warning('Twilio no configurado; no se enviará WhatsApp')
            return False

        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=body,
            from_=f'whatsapp:{whatsapp_from}',
            to=f'whatsapp:{to_number}'
        )
        logger.info(f"WhatsApp enviado SID={message.sid} to={to_number}")
        return True
    except Exception as e:
        logger.exception(f"Error al enviar WhatsApp: {e}")
        return False


def send_notifications_for_event(evento, report=None):
    """Send email and WhatsApp notifications for an Evento.

    - evento: Evento instance
    - report: optional Report instance related to the event
    """
    results = {'email': False, 'whatsapp': False}

    tarea = getattr(evento, 'reporte', None)
    empleado = getattr(evento, 'empleado', None)

    # Build context for templates
    context = {
        'tarea': tarea,
        'evento': evento,
        'report': report,
        'site_url': getattr(settings, 'BACKEND_URL', '')
    }

    subject = f"Avance registrado: {tarea.title if tarea else 'Tarea'}"

    # Text body fallback
    text_body = evento.descripcion
    if report:
        text_body = f"Reporte: {report.title}\n\n{report.description}\n\nAvance:\n{evento.descripcion}"

    # Email recipients
    recipients = []
    if empleado and getattr(empleado, 'email', None):
        recipients.append(empleado.email)

    if not recipients:
        admins = getattr(settings, 'ADMINS', [])
        recipients = [a[1] for a in admins]

    # Render and send email with template if recipients exist
    if recipients:
        template_html = 'tasks/email/event_notification.html'
        results['email'] = _send_email(subject, text_body, recipients, context=context, template_html=template_html)

    # WhatsApp via Twilio: try empleado.celular or any participante phone numbers
    whatsapp_targets = []
    if empleado and getattr(empleado, 'celular', None):
        whatsapp_targets.append(empleado.celular)

    # include participantes' phones
    try:
        for p in evento.participantes.all():
            if p.celular:
                whatsapp_targets.append(p.celular)
    except Exception:
        pass

    # Normalize numbers
    normalized = []
    for num in whatsapp_targets:
        norm = _normalize_phone(num, default_region=getattr(settings, 'PHONE_DEFAULT_REGION', None))
        if norm:
            normalized.append(norm)

    # Compose WhatsApp message with a link to the task/report
    if tarea:
        link = f"{context['site_url']}/tasks/{tarea.id}"
    else:
        link = context['site_url']

    whatsapp_body = f"Se registró un avance en '{tarea.title if tarea else 'Tarea'}'.\n{evento.descripcion[:200]}\nVer más: {link}"

    if normalized:
        sent_any = False
        for num in set(normalized):
            ok = _send_whatsapp_via_twilio(num, whatsapp_body)
            sent_any = sent_any or ok
        results['whatsapp'] = sent_any
    else:
        logger.info('No hay números validados para enviar WhatsApp')

    return results
