from celery import shared_task

from .models import Evento
from .notifications import send_notifications_for_event

@shared_task
def send_event_notifications(evento_id, report_id=None):
    try:
        evento = Evento.objects.get(pk=evento_id)
    except Evento.DoesNotExist:
        return {'error': 'Evento no encontrado'}

    # import Report lazily to avoid circular imports
    report = None
    if report_id:
        from .models import Report
        try:
            report = Report.objects.get(pk=report_id)
        except Report.DoesNotExist:
            report = None

    return send_notifications_for_event(evento, report=report)


@shared_task
def reverse_geocode_and_update(ubicacion_id):
    """Background task: reverse-geocode a Ubicacion and update its nombre/status."""
    from .models import Ubicacion
    import requests
    try:
        u = Ubicacion.objects.get(pk=ubicacion_id)
    except Ubicacion.DoesNotExist:
        return {'error': 'Ubicacion no encontrada'}

    # Use Celery retries to handle transient failures
    try:
        params = {'format': 'jsonv2', 'lat': str(u.lat), 'lon': str(u.lon), 'zoom': 18, 'addressdetails': 1}
        headers = {'User-Agent': 'reportesmodelo/1.0 (+https://example.com)'}
        resp = requests.get('https://nominatim.openstreetmap.org/reverse', params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        nombre = data.get('display_name') or ''
        if not nombre:
            addr = data.get('address', {})
            parts = []
            for k in ('road', 'house_number', 'neighbourhood', 'suburb', 'city', 'state', 'country'):
                v = addr.get(k)
                if v and v not in parts:
                    parts.append(v)
            if parts:
                nombre = ', '.join(parts)

        if nombre:
            u.nombre = nombre
            u.status = 'ready'
            u.save()
            return {'status': 'updated', 'nombre': nombre}

        # If reverse geocoding returned nothing useful, mark ready (keep generated name)
        u.status = 'ready'
        u.save()
        return {'status': 'ready'}
    except requests.RequestException as exc:
        # Transient network error -- re-raise to allow Celery to retry
        try:
            raise reverse_geocode_and_update.retry(exc=exc, countdown=30)
        except Exception:
            # If retry machinery fails, mark as failed
            u.status = 'failed'
            u.save()
            return {'status': 'failed'}
    except Exception:
        u.status = 'failed'
        u.save()
        return {'status': 'failed'}
