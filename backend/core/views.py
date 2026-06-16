from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import User, Route, Location, Fleet, Order, ShipmentBox
from .serializers import (
    UserSerializer, RouteSerializer, LocationSerializer,
    FleetSerializer, OrderSerializer, ShipmentBoxSerializer,
    BoxStoreSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.select_related('assigned_driver').all()
    serializer_class = RouteSerializer

    @action(detail=True, methods=['get'])
    def manifest(self, request, pk=None):
        """All Stored boxes for this route — the driver's picking list."""
        route = self.get_object()
        boxes = ShipmentBox.objects.filter(route=route, status='Stored').select_related('location', 'order')
        serializer = ShipmentBoxSerializer(boxes, many=True)
        return Response(serializer.data)


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        zone = self.request.query_params.get('zone')
        occupied = self.request.query_params.get('occupied')
        if zone:
            qs = qs.filter(zone=zone)
        if occupied is not None:
            qs = qs.filter(is_occupied=occupied.lower() == 'true')
        return qs


class FleetViewSet(viewsets.ModelViewSet):
    queryset = Fleet.objects.all()
    serializer_class = FleetSerializer

    @action(detail=True, methods=['post'])
    def mark_arrived(self, request, pk=None):
        fleet = self.get_object()
        if fleet.status != 'Expected':
            return Response({'error': 'Fleet is not in Expected status.'}, status=status.HTTP_400_BAD_REQUEST)
        fleet.status = 'Arrived'
        fleet.save()
        return Response(FleetSerializer(fleet).data)

    @action(detail=True, methods=['post'])
    def start_unloading(self, request, pk=None):
        fleet = self.get_object()
        if fleet.status != 'Arrived':
            return Response({'error': 'Fleet must be Arrived before unloading.'}, status=status.HTTP_400_BAD_REQUEST)
        fleet.status = 'Unloading'
        fleet.save()
        return Response(FleetSerializer(fleet).data)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer


class ShipmentBoxViewSet(viewsets.ModelViewSet):
    queryset = ShipmentBox.objects.select_related('fleet', 'order', 'route', 'location').all()
    serializer_class = ShipmentBoxSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        fleet_id = self.request.query_params.get('fleet_id')
        route_id = self.request.query_params.get('route_id')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if fleet_id:
            qs = qs.filter(fleet_id=fleet_id)
        if route_id:
            qs = qs.filter(route_id=route_id)
        return qs

    @action(detail=False, methods=['post'])
    def scan_unload(self, request):
        """Step 1: Scan a box off the fleet. Marks it Unloaded."""
        tracking_number = request.data.get('tracking_number')
        if not tracking_number:
            return Response({'error': 'tracking_number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            box = ShipmentBox.objects.get(tracking_number=tracking_number)
        except ShipmentBox.DoesNotExist:
            return Response({'error': 'Box not found.'}, status=status.HTTP_404_NOT_FOUND)

        if box.status != 'In-Transit':
            return Response({'error': f'Box is already {box.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        box.status = 'Unloaded'
        box.unloaded_at = timezone.now()
        box.save()

        # Return sibling info so staff knows how many boxes belong to this order
        siblings = ShipmentBox.objects.filter(order=box.order).exclude(tracking_number=box.tracking_number)
        return Response({
            'box': ShipmentBoxSerializer(box).data,
            'order_total_boxes': box.order.total_boxes,
            'siblings': ShipmentBoxSerializer(siblings, many=True).data,
        })

    @action(detail=False, methods=['post'])
    def scan_store(self, request):
        """
        Step 2 (poka-yoke): Staff scans the physical shelf barcode to confirm placement.
        Validates the location is free, assigns the box, and locks the shelf.
        For multi-box orders, attempts to consolidate siblings to adjacent shelves.
        """
        serializer = BoxStoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            box = ShipmentBox.objects.get(tracking_number=data['tracking_number'])
        except ShipmentBox.DoesNotExist:
            return Response({'error': 'Box not found.'}, status=status.HTTP_404_NOT_FOUND)

        if box.status != 'Unloaded':
            return Response({'error': f'Box must be Unloaded before storing. Current: {box.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            location = Location.objects.get(location_id=data['scanned_location_id'])
        except Location.DoesNotExist:
            return Response({'error': 'Location not found. Check the barcode.'}, status=status.HTTP_404_NOT_FOUND)

        if location.is_occupied:
            return Response({'error': f'{location.location_id} is already occupied.'}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            box.location = location
            box.status = 'Stored'
            box.stored_at = timezone.now()
            box.save()

            location.is_occupied = True
            location.save()

            # Consolidation: find unassigned siblings and suggest adjacent shelves
            unassigned_siblings = ShipmentBox.objects.filter(
                order=box.order,
                status='Unloaded',
                location__isnull=True,
            ).exclude(tracking_number=box.tracking_number)

            suggested_locations = []
            if unassigned_siblings.exists():
                suggested_locations = _find_adjacent_locations(location, unassigned_siblings.count())

        return Response({
            'box': ShipmentBoxSerializer(box).data,
            'suggested_sibling_locations': suggested_locations,
        })

    @action(detail=True, methods=['post'], url_path='confirm_dispatch')
    def confirm_dispatch(self, request, pk=None):
        """Driver confirms they've picked up a box."""
        box = self.get_object()
        if box.status != 'Retrieved':
            return Response({'error': 'Box must be Retrieved before dispatching.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if box.location:
                box.location.is_occupied = False
                box.location.save()

            box.status = 'Dispatched'
            box.dispatched_at = timezone.now()
            box.location = None
            box.save()

        return Response(ShipmentBoxSerializer(box).data)


def _find_adjacent_locations(anchor_location, count):
    """
    Returns up to `count` free locations in the same zone+rack,
    ordered by shelf number proximity to the anchor.
    """
    try:
        anchor_shelf_num = int(anchor_location.shelf)
    except ValueError:
        return []

    candidates = Location.objects.filter(
        zone=anchor_location.zone,
        rack=anchor_location.rack,
        is_occupied=False,
    ).exclude(location_id=anchor_location.location_id)

    scored = []
    for loc in candidates:
        try:
            distance = abs(int(loc.shelf) - anchor_shelf_num)
            scored.append((distance, loc.location_id))
        except ValueError:
            continue

    scored.sort(key=lambda x: x[0])
    return [loc_id for _, loc_id in scored[:count]]


class DashboardView:
    pass
