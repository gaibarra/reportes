from rest_framework.generics import RetrieveAPIView
from .models import Task, Empleado, Evento, Report
from rest_framework import serializers
from django.contrib.auth.models import User

class ReportSerializer(serializers.ModelSerializer):
        
    class Meta:
        model = Report
        fields = '__all__'
        
class CustomUserDetailsSerializer(serializers.ModelSerializer):
    is_superuser = serializers.BooleanField()
    is_staff = serializers.BooleanField()

    class Meta:
        model = User
        fields = ('pk', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'is_staff')
        read_only_fields = ('pk', 'email')


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'
        
        
class EmpleadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empleado
        fields = '__all__'      
        

class EventoSerializer(serializers.ModelSerializer):
    reporte = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all())
    empleado = serializers.PrimaryKeyRelatedField(queryset=Empleado.objects.all())

    class Meta:
        model = Evento
        fields = ['id', 'descripcion', 'fecha', 'reporte', 'empleado']

    def create(self, validated_data):
        empleado = validated_data.pop('empleado')
        reporte = validated_data.pop('reporte')
        evento = Evento.objects.create(empleado=empleado, reporte=reporte, **validated_data)
        return evento
    

