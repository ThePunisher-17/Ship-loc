from django.contrib import admin
from .models import User, Route, PostalCodeMapping, Location, Fleet, Order, ShipmentBox


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'role', 'active_status', 'user_id')
    list_filter = ('role', 'active_status')
    search_fields = ('full_name',)


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ('route_id', 'route_name', 'assigned_driver')


@admin.register(PostalCodeMapping)
class PostalCodeMappingAdmin(admin.ModelAdmin):
    list_display = ('postal_code', 'route')
    list_filter = ('route',)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('location_id', 'zone', 'rack', 'shelf', 'is_occupied', 'weight_capacity_kg')
    list_filter = ('zone', 'is_occupied')
    search_fields = ('location_id',)


@admin.register(Fleet)
class FleetAdmin(admin.ModelAdmin):
    list_display = ('fleet_id', 'origin_hub', 'status', 'arrival_timestamp')
    list_filter = ('status',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'total_boxes', 'delivery_address', 'order_date')
    search_fields = ('order_id', 'delivery_address')


@admin.register(ShipmentBox)
class ShipmentBoxAdmin(admin.ModelAdmin):
    list_display = ('tracking_number', 'fleet', 'order', 'route', 'location', 'box_sequence', 'status')
    list_filter = ('status', 'fleet', 'route')
    search_fields = ('tracking_number',)
