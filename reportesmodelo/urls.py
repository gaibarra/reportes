from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

settings.URL_MAX_LENGTH = 2000

urlpatterns = [
    path("admin/", admin.site.urls),
    path('api/v1/', include('tasks.urls')),  # Asegúrate de usar el nombre correcto de tu aplicación
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', TemplateView.as_view(template_name='index.html'), name='index'),
    ]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
