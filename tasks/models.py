from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

def get_default_task():
    # Attempt to get a default task, or create one if it doesn't exist
    task, created = Task.objects.get_or_create(
        title="Default Task",
        defaults={'description': 'This is a default task.'}
    )
    return task



class Task(models.Model):
    PRIORIDAD_CHOICES = [
        ('Alta', 'Alta'),
        ('Media', 'Media'),
        ('Baja', 'Baja'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    foto_inicial = models.ImageField(upload_to="fotos/", null=True, blank=True)
    foto_final = models.ImageField(upload_to="fotos/", null=True, blank=True)
    reportado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="reportes_creados")
    resuelto_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reportes_resueltos")
    campus = models.CharField(max_length=100, default="Montejo")
    done = models.BooleanField(default=False)
    prioridad = models.CharField(
        max_length=5,
        choices=PRIORIDAD_CHOICES,
        default='Media'
    )
    # One-to-one relation: each Task has exactly one Ubicacion and each Ubicacion
    # may be linked to at most one Task. Keep null=True to allow transitional states
    # during migration if needed.
    # Make ubicacion required at the data model level: every Task must have a Ubicacion.
    # Keep on_delete=SET_NULL for safety but disallow nulls so creation requires a Ubicacion.
    ubicacion = models.OneToOneField(
        'Ubicacion', null=False, blank=False, on_delete=models.PROTECT, related_name='task'
    )

    def __str__(self):
        return self.title

class Report(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField()
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    foto_inicial_url = models.URLField(max_length=200, blank=True, null=True)
    foto_final_url = models.URLField(max_length=200, blank=True, null=True)
    gpt_report = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['fecha_resolucion']
    
    def __str__(self):
        return self.title

class Empleado(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, default=None)
    nombre_empleado = models.CharField(max_length=50, default=None)
    ubicacion = models.CharField(max_length=50, default=None)
    campus = models.CharField(max_length=30, default=None)
    puesto = models.CharField(max_length=50, null=True, blank=True, default="")
    email = models.EmailField(max_length=50, null=True, blank=True, default="")
    celular = models.CharField(max_length=10, null=True, blank=True, default="")

    def __str__(self):
        return self.nombre_empleado  

class Participante(models.Model):
    ROLE_CHOICES = [
        ('Proveedor', 'Proveedor'),
        ('Autoridad', 'Autoridad'),
        ('Asesor', 'Asesor'),
        ('Ingeniero', 'Ingeniero'),
        ('Otro', 'Otro'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    nombre = models.CharField(max_length=100)
    rol = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Otro')
    organizacion = models.CharField(max_length=120, blank=True, default='')
    email = models.EmailField(max_length=100, blank=True, default='')
    celular = models.CharField(max_length=20, blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} ({self.rol})"

class Evento(models.Model):
    descripcion = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)
    reporte = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='eventos')
    empleado = models.ForeignKey(Empleado, on_delete=models.PROTECT, related_name='eventos')
    participantes = models.ManyToManyField(Participante, blank=True, related_name='eventos')

    def __str__(self):
        return self.descripcion


class Compromiso(models.Model):
    """A simple commitment/follow-up created after an Evento/report.

    We'll keep this lightweight: a target date, description and related task/event.
    """
    tarea = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='compromisos')
    evento = models.ForeignKey(Evento, on_delete=models.SET_NULL, null=True, blank=True, related_name='compromisos')
    descripcion = models.TextField(blank=True)
    fecha_compromiso = models.DateTimeField(null=True, blank=True)
    creado_por = models.ForeignKey(Empleado, on_delete=models.SET_NULL, null=True, blank=True, related_name='compromisos')
    creado_en = models.DateTimeField(auto_now_add=True)
    participantes = models.ManyToManyField(Participante, blank=True, related_name='compromisos')

    def __str__(self):
        return f"Compromiso {self.id} para {self.tarea}"


class Ubicacion(models.Model):
    """Simple model to store named locations with coordinates."""
    nombre = models.CharField(max_length=150)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    # status: processing while a background job reverse-geocodes the coords
    status = models.CharField(max_length=20, default='ready')

    # Optional thumbnail or static map image (future enhancement)
    # thumbnail = models.ImageField(upload_to='ubicaciones/', null=True, blank=True)

    def __str__(self):
        return f"{self.nombre} ({self.lat},{self.lon}) [{self.status}]"


# Post-save safety net: if a Ubicacion exists in a non-ready state, ensure the
# reverse_geocode_and_update task is scheduled. Use transaction.on_commit to
# avoid enqueuing before the DB commit and respect CELERY_TASK_ALWAYS_EAGER.
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.conf import settings


@receiver(post_save, sender=Ubicacion)
def ensure_reverse_geocode_enqueued(sender, instance, created, **kwargs):
    try:
        if instance.status != 'ready':
            # lazily import the task
            from .tasks import reverse_geocode_and_update

            def _enqueue():
                try:
                    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                        reverse_geocode_and_update(instance.id)
                    else:
                        reverse_geocode_and_update.delay(instance.id)
                except Exception:
                    # log but don't raise in signal handler
                    import logging
                    logging.getLogger(__name__).exception('Error encolando reverse_geocode desde post_save')

            transaction.on_commit(_enqueue)
    except Exception:
        import logging
        logging.getLogger(__name__).exception('Error en ensure_reverse_geocode_enqueued')
