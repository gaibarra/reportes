# Generated by Django 5.0.1 on 2024-06-25 16:35

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0003_alter_report_task'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='report',
            options={'ordering': ['fecha_resolucion']},
        ),
    ]
