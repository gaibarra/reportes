from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Ubicacion
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Ubicacion)
def enqueue_reverse_geocode_on_create(sender, instance, created, **kwargs):
    """If an Ubicacion is created and status is processing, ensure the Celery task is enqueued.

    This is a safety net for other flows that may create Ubicacion records directly.
    """
    if not created:
        return
    try:
        if instance.status == 'processing':
            from .tasks import reverse_geocode_and_update
            reverse_geocode_and_update.delay(instance.id)
    except Exception:
        logger.exception('Failed to enqueue reverse_geocode_and_update from post_save')
