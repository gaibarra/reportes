from .celery import app as celery_app

# Expose the celery app as a module-level variable for Django/Celery
__all__ = ('celery_app',)
