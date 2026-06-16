from rest_framework import serializers
from django.utils import timezone
from .models import User, Route, PostalCodeMapping, Location, Fleet, Order, ShipmentBox


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class PostalCodeMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostalCodeMapping
        fields = '__all__'


class RouteSerializer(serializers.ModelSerializer):
    assigned_driver_name = serializers.CharField(source='assigned_driver.full_name', read_only=True)
    postal_codes = serializers.SerializerMethodField()
    box_counts = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = '__all__'

    def get_postal_codes(self, obj):
        return list(obj.postal_codes.values_list('postal_code', flat=True))

    def get_box_counts(self, obj):
        qs = obj.boxes.all()
        return {
            'total':      qs.count(),
            'in_transit': qs.filter(status='In-Transit').count(),
            'unloaded':   qs.filter(status='Unloaded').count(),
            'stored':     qs.filter(status='Stored').count(),
            'retrieved':  qs.filter(status='Retrieved').count(),
            'dispatched': qs.filter(status='Dispatched').count(),
        }


class LocationSerializer(serializers.ModelSerializer):
    current_box = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = '__all__'

    def get_current_box(self, obj):
        if not obj.is_occupied:
            return None
        box = obj.boxes.filter(status=ShipmentBox.Status.STORED).first()
        if not box:
            return None
        return {
            'tracking_number': box.tracking_number,
            'order': box.order_id,
            'route': box.route_id,
            'box_sequence': box.box_sequence,
        }


class FleetSerializer(serializers.ModelSerializer):
    box_count      = serializers.IntegerField(source='boxes.count', read_only=True)
    in_transit_count  = serializers.SerializerMethodField()
    unloaded_count    = serializers.SerializerMethodField()
    stored_count      = serializers.SerializerMethodField()
    dispatched_count  = serializers.SerializerMethodField()
    unload_progress   = serializers.SerializerMethodField()

    class Meta:
        model = Fleet
        fields = '__all__'

    def get_in_transit_count(self, obj):
        return obj.boxes.filter(status='In-Transit').count()

    def get_unloaded_count(self, obj):
        return obj.boxes.filter(status='Unloaded').count()

    def get_stored_count(self, obj):
        return obj.boxes.filter(status=ShipmentBox.Status.STORED).count()

    def get_dispatched_count(self, obj):
        return obj.boxes.filter(status__in=[ShipmentBox.Status.RETRIEVED, ShipmentBox.Status.DISPATCHED]).count()

    def get_unload_progress(self, obj):
        total = obj.boxes.count()
        if total == 0:
            return 0
        done = obj.boxes.exclude(status=ShipmentBox.Status.IN_TRANSIT).count()
        return round((done / total) * 100)


class OrderSerializer(serializers.ModelSerializer):
    stored_count     = serializers.SerializerMethodField()
    dispatched_count = serializers.SerializerMethodField()
    box_statuses     = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_stored_count(self, obj):
        return obj.boxes.filter(status=ShipmentBox.Status.STORED).count()

    def get_dispatched_count(self, obj):
        return obj.boxes.filter(status=ShipmentBox.Status.DISPATCHED).count()

    def get_box_statuses(self, obj):
        return list(
            obj.boxes.values('tracking_number', 'status', 'location__location_id', 'route_id', 'box_sequence')
        )


class ShipmentBoxSerializer(serializers.ModelSerializer):
    order_total_boxes = serializers.IntegerField(source='order.total_boxes', read_only=True)
    location_label    = serializers.CharField(source='location.location_id', read_only=True)
    order_address     = serializers.CharField(source='order.delivery_address', read_only=True)
    minutes_unloaded  = serializers.SerializerMethodField()

    class Meta:
        model = ShipmentBox
        fields = '__all__'

    def get_minutes_unloaded(self, obj):
        if obj.status != ShipmentBox.Status.UNLOADED or not obj.unloaded_at:
            return None
        delta = timezone.now() - obj.unloaded_at
        return int(delta.total_seconds() / 60)


class BoxStoreSerializer(serializers.Serializer):
    tracking_number    = serializers.CharField()
    scanned_location_id = serializers.CharField()
    staff_user_id      = serializers.UUIDField()
