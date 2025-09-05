# Compatibility module: some code references `tasks.serializers` (plural)
# while our canonical file is `tasks/serializer.py` (singular).
# Export the main symbols so third-party config (e.g. dj-rest-auth settings)
# referencing `tasks.serializers.CustomUserDetailsSerializer` keep working.
from .serializer import (
    ReportSerializer,
    CustomUserDetailsSerializer,
    UbicacionSerializer,
    TaskSerializer,
    EmpleadoSerializer,
    ParticipanteSerializer,
    EventoSerializer,
    CompromisoSerializer,
)
