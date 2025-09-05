import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'reportesmodelo.settings')

app = Celery('reportesmodelo')
# Load broker/url from Django settings (CELERY_BROKER_URL)
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
