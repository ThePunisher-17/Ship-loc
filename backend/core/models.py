import uuid
from django.db import models


class User(models.Model):
    ROLE_CHOICES = [
        ('WarehouseStaff', 'Warehouse Staff'),
        ('Driver', 'Driver'),
        ('Manager', 'Manager'),
    ]
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    active_status = models.BooleanField(default=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.full_name} ({self.role})"


class Route(models.Model):
    route_id = models.CharField(max_length=50, primary_key=True)
    route_name = models.CharField(max_length=100)
    assigned_driver = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='routes',
        limit_choices_to={'role': 'Driver'},
    )

    class Meta:
        db_table = 'routes'

    def __str__(self):
        return self.route_name


class PostalCodeMapping(models.Model):
    postal_code = models.CharField(max_length=20, primary_key=True)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='postal_codes')

    class Meta:
        db_table = 'postal_code_mapping'

    def __str__(self):
        return f"{self.postal_code} → {self.route_id}"


class Location(models.Model):
    # location_id format: Z-[Zone]-R[Rack]-S[Shelf]  e.g. Z-A-R04-S2
    location_id = models.CharField(max_length=50, primary_key=True)
    zone = models.CharField(max_length=10)
    rack = models.CharField(max_length=10)
    shelf = models.CharField(max_length=10)
    is_occupied = models.BooleanField(default=False)
    weight_capacity_kg = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'locations'
        indexes = [
            models.Index(fields=['zone', 'rack', 'shelf'], condition=models.Q(is_occupied=False), name='idx_open_locations'),
        ]

    def __str__(self):
        return self.location_id


class Fleet(models.Model):
    STATUS_CHOICES = [
        ('Expected', 'Expected'),
        ('Arrived', 'Arrived'),
        ('Unloading', 'Unloading'),
        ('Reconciled', 'Reconciled'),
    ]
    fleet_id = models.CharField(max_length=100, primary_key=True)
    origin_hub = models.CharField(max_length=100)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Expected')
    arrival_timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fleets'

    def __str__(self):
        return f"{self.fleet_id} ({self.status})"


class Order(models.Model):
    order_id = models.CharField(max_length=100, primary_key=True)
    total_boxes = models.IntegerField(default=1)
    delivery_address = models.TextField()
    order_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'orders'

    def __str__(self):
        return self.order_id


class ShipmentBox(models.Model):
    STATUS_CHOICES = [
        ('In-Transit', 'In-Transit'),
        ('Unloaded', 'Unloaded'),
        ('Stored', 'Stored'),
        ('Retrieved', 'Retrieved'),
        ('Dispatched', 'Dispatched'),
    ]
    tracking_number = models.CharField(max_length=100, primary_key=True)
    fleet = models.ForeignKey(Fleet, on_delete=models.PROTECT, related_name='boxes')
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name='boxes')
    route = models.ForeignKey(Route, null=True, blank=True, on_delete=models.SET_NULL, related_name='boxes')
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.SET_NULL, related_name='boxes')
    box_sequence = models.CharField(max_length=20)  # e.g. "1 of 3"
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='In-Transit')

    # Timestamps for KPI tracking
    unloaded_at = models.DateTimeField(null=True, blank=True)
    stored_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'shipment_boxes'
        indexes = [
            models.Index(fields=['status'], name='idx_boxes_status'),
        ]

    def __str__(self):
        return f"{self.tracking_number} [{self.status}]"
