
from .models import Task, Empleado, Evento
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User

class UserAdmin(BaseUserAdmin):
    form = CustomUserChangeForm
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_superuser', 'is_staff')
    list_filter = ('is_superuser', 'is_staff')

admin.site.unregister(User)
admin.site.register(User, UserAdmin)

admin.site.register(Task)
admin.site.register(Empleado)
admin.site.register(Evento)# Register your models here.
