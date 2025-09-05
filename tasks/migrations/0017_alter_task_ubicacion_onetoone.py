from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0016_backfill_ubicacion_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='task',
            name='ubicacion',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='task', to='tasks.ubicacion'),
        ),
    ]
