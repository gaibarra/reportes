from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        # import signal handlers
        try:
            import tasks.signals  # noqa: F401
        except Exception:
            pass
