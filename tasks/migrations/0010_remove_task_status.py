# Generated by Django 5.0.1 on 2024-09-09 15:44

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0009_task_status"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="task",
            name="status",
        ),
    ]
