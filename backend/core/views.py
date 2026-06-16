from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
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

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs


class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.select_related('assigned_driver').prefetch_related('postal_codes').all()
    serializer_class = RouteSerializer

    @action(detail=True, methods=['get'])
    def manifest(self, request, pk=None):
        """All Stored boxes for this route — the driver's picking list."""
        route = self.get_object()
        boxes = ShipmentBox.objects.filter(
            route=route,
            status__in=[ShipmentBox.Status.STORED, ShipmentBox.Status.RETRIEVED],
        ).select_related('location', 'order')
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
        return qs.order_by('zone', 'rack', 'shelf')


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

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        fleet = self.get_object()
        if fleet.status != 'Unloading':
            return Response({'error': 'Fleet must be in Unloading status to reconcile.'}, status=status.HTTP_400_BAD_REQUEST)
        pending = fleet.boxes.filter(
            status__in=[ShipmentBox.Status.IN_TRANSIT, ShipmentBox.Status.UNLOADED]
        ).count()
        if pending > 0:
            return Response(
                {'error': f'{pending} box(es) are still In-Transit or Unloaded. Reconcile after all boxes are stored.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        fleet.status = 'Reconciled'
        fleet.save()
        return Response(FleetSerializer(fleet).data)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter == 'complete':
            qs = [o for o in qs if o.boxes.filter(status='Dispatched').count() == o.total_boxes]
            return qs
        if status_filter == 'partial':
            qs = [o for o in qs if 0 < o.boxes.filter(status='Dispatched').count() < o.total_boxes]
            return qs
        return qs.order_by('-order_date')


class ShipmentBoxViewSet(viewsets.ModelViewSet):
    queryset = ShipmentBox.objects.select_related('fleet', 'order', 'route', 'location').all()
    serializer_class = ShipmentBoxSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        fleet_id      = self.request.query_params.get('fleet_id')
        route_id      = self.request.query_params.get('route_id')
        search        = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if fleet_id:
            qs = qs.filter(fleet_id=fleet_id)
        if route_id:
            qs = qs.filter(route_id=route_id)
        if search:
            qs = qs.filter(tracking_number__icontains=search)
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
            return Response({'error': f'Box "{tracking_number}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        if box.status != ShipmentBox.Status.IN_TRANSIT:
            return Response({'error': f'Box is already {box.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        box.status = ShipmentBox.Status.UNLOADED
        box.unloaded_at = timezone.now()
        box.save()

        siblings = ShipmentBox.objects.filter(order=box.order).exclude(tracking_number=box.tracking_number)
        return Response({
            'box': ShipmentBoxSerializer(box).data,
            'order_total_boxes': box.order.total_boxes,
            'siblings': ShipmentBoxSerializer(siblings, many=True).data,
        })

    @action(detail=False, methods=['post'])
    def scan_store(self, request):
        """Step 2: Scan the shelf barcode to confirm placement."""
        serializer = BoxStoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            box = ShipmentBox.objects.get(tracking_number=data['tracking_number'])
        except ShipmentBox.DoesNotExist:
            return Response({'error': 'Box not found.'}, status=status.HTTP_404_NOT_FOUND)

        if box.status != ShipmentBox.Status.UNLOADED:
            return Response({'error': f'Box must be Unloaded before storing. Current: {box.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # select_for_update locks the shelf row until commit, preventing two
            # workers from concurrently claiming the same location.
            try:
                location = Location.objects.select_for_update().get(location_id=data['scanned_location_id'])
            except Location.DoesNotExist:
                return Response({'error': f'Location "{data["scanned_location_id"]}" not found.'}, status=status.HTTP_404_NOT_FOUND)

            if location.is_occupied:
                return Response({'error': f'{location.location_id} is already occupied.'}, status=status.HTTP_409_CONFLICT)

            box.location = location
            box.status = ShipmentBox.Status.STORED
            box.stored_at = timezone.now()
            box.save()

            location.is_occupied = True
            location.save()

            unassigned_siblings = ShipmentBox.objects.filter(
                order=box.order, status=ShipmentBox.Status.UNLOADED, location__isnull=True,
            ).exclude(tracking_number=box.tracking_number)

            suggested_locations = []
            if unassigned_siblings.exists():
                suggested_locations = _find_adjacent_locations(location, unassigned_siblings.count())

        return Response({
            'box': ShipmentBoxSerializer(box).data,
            'suggested_sibling_locations': suggested_locations,
        })

    @action(detail=True, methods=['post'], url_path='retrieve')
    def retrieve_box(self, request, pk=None):
        """Driver picks a box off the shelf."""
        box = self.get_object()
        if box.status != ShipmentBox.Status.STORED:
            return Response({'error': f'Box must be Stored to retrieve. Current: {box.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if box.location:
                box.location.is_occupied = False
                box.location.save()
            box.status = ShipmentBox.Status.RETRIEVED
            box.retrieved_at = timezone.now()
            box.save()

        return Response(ShipmentBoxSerializer(box).data)

    @action(detail=True, methods=['post'], url_path='confirm_dispatch')
    def confirm_dispatch(self, request, pk=None):
        """Driver confirms they've picked up a box."""
        box = self.get_object()
        if box.status != ShipmentBox.Status.RETRIEVED:
            return Response({'error': 'Box must be Retrieved before dispatching.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if box.location:
                box.location.is_occupied = False
                box.location.save()
            box.status = ShipmentBox.Status.DISPATCHED
            box.dispatched_at = timezone.now()
            box.location = None
            box.save()

        return Response(ShipmentBoxSerializer(box).data)


@api_view(['GET'])
def stats(request):
    """Summary stats for the dashboard."""
    from django.db.models import Count, Avg, F, ExpressionWrapper, DurationField
    from django.utils import timezone

    boxes = ShipmentBox.objects.all()
    status_counts = {
        row['status']: row['count']
        for row in boxes.values('status').annotate(count=Count('status'))
    }

    # Average minutes boxes have been sitting Unloaded (TAT risk)
    unloaded_boxes = boxes.filter(status='Unloaded', unloaded_at__isnull=False)
    avg_wait_minutes = None
    if unloaded_boxes.exists():
        total_seconds = sum(
            (timezone.now() - b.unloaded_at).total_seconds()
            for b in unloaded_boxes
        )
        avg_wait_minutes = round(total_seconds / unloaded_boxes.count() / 60)

    fleet_counts = {
        row['status']: row['count']
        for row in Fleet.objects.values('status').annotate(count=Count('status'))
    }

    zones = Location.objects.values('zone').annotate(
        total=Count('location_id'),
        occupied=Count('location_id', filter=__import__('django.db.models', fromlist=['Q']).Q(is_occupied=True)),
    ).order_by('zone')

    return Response({
        'box_counts':        status_counts,
        'fleet_counts':      fleet_counts,
        'avg_wait_minutes':  avg_wait_minutes,
        'zone_capacity':     list(zones),
        'total_boxes':       boxes.count(),
        'total_locations':   Location.objects.count(),
        'free_locations':    Location.objects.filter(is_occupied=False).count(),
    })


def _find_adjacent_locations(anchor_location, count):
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
