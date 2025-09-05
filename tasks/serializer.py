from rest_framework.generics import RetrieveAPIView
from .models import Task, Empleado, Evento, Report, Compromiso, Participante, Ubicacion
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


class UbicacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ubicacion
        fields = ['id', 'nombre', 'lat', 'lon', 'creado_en', 'status']


class TaskSerializer(serializers.ModelSerializer):
    ubicacion = serializers.PrimaryKeyRelatedField(queryset=Ubicacion.objects.all(), required=True, allow_null=False)
    ubicacion_detail = UbicacionSerializer(source='ubicacion', read_only=True)
    class Meta:
        model = Task
        fields = '__all__'
        
        
class EmpleadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empleado
        fields = '__all__'      
        

class ParticipanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participante
        fields = '__all__'


class EventoSerializer(serializers.ModelSerializer):
    reporte = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all())
    empleado = serializers.PrimaryKeyRelatedField(queryset=Empleado.objects.all())
    participantes = serializers.PrimaryKeyRelatedField(queryset=Participante.objects.all(), many=True, required=False)
    participantes_detail = ParticipanteSerializer(source='participantes', many=True, read_only=True)

    class Meta:
        model = Evento
        fields = ['id', 'descripcion', 'fecha', 'reporte', 'empleado', 'participantes', 'participantes_detail']

    def create(self, validated_data):
        participantes = validated_data.pop('participantes', [])
        empleado = validated_data.pop('empleado')
        reporte = validated_data.pop('reporte')
        evento = Evento.objects.create(empleado=empleado, reporte=reporte, **validated_data)
        if participantes:
            evento.participantes.set(participantes)
        return evento


class CompromisoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Compromiso
        fields = '__all__'
    participantes = serializers.PrimaryKeyRelatedField(queryset=Participante.objects.all(), many=True, required=False)
    participantes_detail = ParticipanteSerializer(source='participantes', many=True, read_only=True)


# Keep a single, correct UbicacionSerializer above. No duplicate definitions.




