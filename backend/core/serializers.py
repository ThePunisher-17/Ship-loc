from rest_framework import serializers
from .models import User, Route, PostalCodeMapping, Location, Fleet, Order, ShipmentBox


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class RouteSerializer(serializers.ModelSerializer):
    assigned_driver_name = serializers.CharField(source='assigned_driver.full_name', read_only=True)

    class Meta:
        model = Route
        fields = '__all__'


class PostalCodeMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostalCodeMapping
        fields = '__all__'


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'


class FleetSerializer(serializers.ModelSerializer):
    box_count = serializers.IntegerField(source='boxes.count', read_only=True)

    class Meta:
        model = Fleet
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    stored_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_stored_count(self, obj):
        return obj.boxes.filter(status='Stored').count()


class ShipmentBoxSerializer(serializers.ModelSerializer):
    order_total_boxes = serializers.IntegerField(source='order.total_boxes', read_only=True)
    location_label = serializers.CharField(source='location.location_id', read_only=True)

    class Meta:
        model = ShipmentBox
        fields = '__all__'


class BoxStoreSerializer(serializers.Serializer):
    """Used for the two-step scan-and-store workflow."""
    tracking_number = serializers.CharField()
    scanned_location_id = serializers.CharField()
    staff_user_id = serializers.UUIDField()
