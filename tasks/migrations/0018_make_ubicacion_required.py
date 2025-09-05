from django.db import migrations, models
import django.db.models.deletion


def create_default_ubicaciones(apps, schema_editor):
    Task = apps.get_model('tasks', 'Task')
    Ubicacion = apps.get_model('tasks', 'Ubicacion')
    for task in Task.objects.filter(ubicacion__isnull=True):
        # create a generic ubicacion for this task
        name = f"Ubicación automática para tarea {task.id}"
        loc = Ubicacion.objects.create(nombre=name, lat=None, lon=None, status='ready')
        task.ubicacion = loc
        task.save()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0017_alter_task_ubicacion_onetoone'),
    ]

    operations = [
        migrations.RunPython(create_default_ubicaciones, reverse_code=noop),
        migrations.AlterField(
            model_name='task',
            name='ubicacion',
            field=models.OneToOneField(blank=False, null=False, on_delete=django.db.models.deletion.PROTECT, related_name='task', to='tasks.ubicacion'),
        ),
    ]
