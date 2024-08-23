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
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    foto_inicial = models.ImageField(upload_to="fotos/", null=True, blank=True)
    foto_final = models.ImageField(upload_to="fotos/", null=True, blank=True)
    reportado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="reportes_creados"
    )
    resuelto_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reportes_resueltos",
    )
    campus = models.CharField(max_length=100, default="Montejo")
    done = models.BooleanField(default=False)

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

class Evento(models.Model):
    descripcion = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)
    reporte = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='eventos')
    empleado = models.ForeignKey(Empleado, on_delete=models.PROTECT, related_name='eventos')

    def __str__(self):
        return self.descripcion
