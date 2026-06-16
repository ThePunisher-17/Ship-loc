from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'routes', views.RouteViewSet)
router.register(r'locations', views.LocationViewSet)
router.register(r'fleets', views.FleetViewSet)
router.register(r'orders', views.OrderViewSet)
router.register(r'boxes', views.ShipmentBoxViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', views.stats),
]
