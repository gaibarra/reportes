"""Backfill Ubicacion.status to 'ready' for existing rows if not set."""
from django.db import migrations


def forwards(apps, schema_editor):
    Ubicacion = apps.get_model('tasks', 'Ubicacion')
    Ubicacion.objects.filter(status__isnull=True).update(status='ready')


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0015_ubicacion_status'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
