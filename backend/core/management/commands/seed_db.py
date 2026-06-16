"""
Usage:
    python manage.py seed_db          # seed fresh data
    python manage.py seed_db --flush  # wipe all tables first, then seed
"""
import uuid
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import User, Route, PostalCodeMapping, Location, Fleet, Order, ShipmentBox


# ── Warehouse physical layout ────────────────────────────────────────────────
# 3 zones (A, B, C), 4 racks each, 5 shelves each → 60 locations total
ZONES = ['A', 'B', 'C']
RACKS_PER_ZONE = 4
SHELVES_PER_RACK = 5
WEIGHT_CAPACITY = 150.00  # kg per shelf


# ── Routes & postal codes ────────────────────────────────────────────────────
ROUTES = [
    {'route_id': 'RT-NORTH', 'route_name': 'North City Route'},
    {'route_id': 'RT-SOUTH', 'route_name': 'South Suburbs Route'},
    {'route_id': 'RT-EAST',  'route_name': 'East Industrial Route'},
    {'route_id': 'RT-WEST',  'route_name': 'West Residential Route'},
]

POSTAL_CODES = {
    'RT-NORTH': ['110001', '110002', '110003', '110004', '110005'],
    'RT-SOUTH': ['400001', '400002', '400003', '400004', '400005'],
    'RT-EAST':  ['600001', '600002', '600003', '600004', '600005'],
    'RT-WEST':  ['500001', '500002', '500003', '500004', '500005'],
}


# ── Fleet data ───────────────────────────────────────────────────────────────
FLEETS = [
    {'fleet_id': 'FLT-2024-001', 'origin_hub': 'Mumbai Hub',   'status': 'Reconciled'},
    {'fleet_id': 'FLT-2024-002', 'origin_hub': 'Delhi Hub',    'status': 'Unloading'},
    {'fleet_id': 'FLT-2024-003', 'origin_hub': 'Bangalore Hub','status': 'Arrived'},
    {'fleet_id': 'FLT-2024-004', 'origin_hub': 'Chennai Hub',  'status': 'Expected'},
]


# ── Orders (mix of single-box and multi-box) ─────────────────────────────────
ORDERS = [
    # Single-box orders
    {'order_id': 'ORD-1001', 'total_boxes': 1, 'delivery_address': '12 North Ave, 110001'},
    {'order_id': 'ORD-1002', 'total_boxes': 1, 'delivery_address': '45 South Lane, 400002'},
    {'order_id': 'ORD-1003', 'total_boxes': 1, 'delivery_address': '8 East Road, 600003'},
    {'order_id': 'ORD-1004', 'total_boxes': 1, 'delivery_address': '77 West Blvd, 500001'},
    # Multi-box orders
    {'order_id': 'ORD-2001', 'total_boxes': 3, 'delivery_address': '33 North Park, 110003'},
    {'order_id': 'ORD-2002', 'total_boxes': 2, 'delivery_address': '91 South Mall, 400004'},
    {'order_id': 'ORD-2003', 'total_boxes': 4, 'delivery_address': '5 East Complex, 600002'},
]


# ── Boxes: (tracking_number, fleet_id, order_id, route_id, box_sequence, status) ──
BOXES = [
    # FLT-2024-001 (Reconciled) → all Dispatched
    ('TRK-A001', 'FLT-2024-001', 'ORD-1001', 'RT-NORTH', '1 of 1', 'Dispatched'),
    ('TRK-A002', 'FLT-2024-001', 'ORD-1002', 'RT-SOUTH', '1 of 1', 'Dispatched'),

    # FLT-2024-002 (Unloading) → mix of Unloaded and Stored
    ('TRK-B001', 'FLT-2024-002', 'ORD-2001', 'RT-NORTH', '1 of 3', 'Stored'),   # will get location
    ('TRK-B002', 'FLT-2024-002', 'ORD-2001', 'RT-NORTH', '2 of 3', 'Stored'),   # will get location
    ('TRK-B003', 'FLT-2024-002', 'ORD-2001', 'RT-NORTH', '3 of 3', 'Unloaded'), # awaiting placement
    ('TRK-B004', 'FLT-2024-002', 'ORD-2002', 'RT-SOUTH', '1 of 2', 'Stored'),   # will get location
    ('TRK-B005', 'FLT-2024-002', 'ORD-2002', 'RT-SOUTH', '2 of 2', 'Unloaded'), # awaiting placement
    ('TRK-B006', 'FLT-2024-002', 'ORD-1003', 'RT-EAST',  '1 of 1', 'Unloaded'),

    # FLT-2024-003 (Arrived) → all In-Transit or Unloaded
    ('TRK-C001', 'FLT-2024-003', 'ORD-2003', 'RT-EAST', '1 of 4', 'Unloaded'),
    ('TRK-C002', 'FLT-2024-003', 'ORD-2003', 'RT-EAST', '2 of 4', 'In-Transit'),
    ('TRK-C003', 'FLT-2024-003', 'ORD-2003', 'RT-EAST', '3 of 4', 'In-Transit'),
    ('TRK-C004', 'FLT-2024-003', 'ORD-2003', 'RT-EAST', '4 of 4', 'In-Transit'),
    ('TRK-C005', 'FLT-2024-003', 'ORD-1004', 'RT-WEST',  '1 of 1', 'In-Transit'),

    # FLT-2024-004 (Expected) → all In-Transit
    ('TRK-D001', 'FLT-2024-004', 'ORD-1001', 'RT-NORTH', '1 of 1', 'In-Transit'),
]

# Boxes that should be placed on specific locations after seeding
# (tracking_number, location_id)
BOX_PLACEMENTS = [
    ('TRK-B001', 'Z-A-R01-S1'),
    ('TRK-B002', 'Z-A-R01-S2'),
    ('TRK-B004', 'Z-A-R01-S3'),
    ('TRK-B005', None),  # Unloaded, no location yet
]


class Command(BaseCommand):
    help = 'Seed the database with realistic warehouse prototype data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Delete all existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self.stdout.write('Flushing existing data...')
            ShipmentBox.objects.all().delete()
            Order.objects.all().delete()
            Fleet.objects.all().delete()
            PostalCodeMapping.objects.all().delete()
            Route.objects.all().delete()
            Location.objects.all().delete()
            User.objects.all().delete()
            self.stdout.write(self.style.WARNING('All tables cleared.'))

        with transaction.atomic():
            self._seed_users()
            self._seed_routes()
            self._seed_postal_codes()
            self._seed_locations()
            self._seed_fleets()
            self._seed_orders()
            self._seed_boxes()

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully.'))
        self._print_summary()

    # ── Seeders ──────────────────────────────────────────────────────────────

    def _seed_users(self):
        users = [
            User(user_id=uuid.UUID('aaaaaaaa-0000-0000-0000-000000000001'),
                 full_name='Ravi Kumar',     role='Manager'),
            User(user_id=uuid.UUID('aaaaaaaa-0000-0000-0000-000000000002'),
                 full_name='Priya Singh',    role='Manager'),
            User(user_id=uuid.UUID('bbbbbbbb-0000-0000-0000-000000000001'),
                 full_name='Amit Sharma',    role='WarehouseStaff'),
            User(user_id=uuid.UUID('bbbbbbbb-0000-0000-0000-000000000002'),
                 full_name='Sunita Rao',     role='WarehouseStaff'),
            User(user_id=uuid.UUID('bbbbbbbb-0000-0000-0000-000000000003'),
                 full_name='Vijay Patel',    role='WarehouseStaff'),
            User(user_id=uuid.UUID('cccccccc-0000-0000-0000-000000000001'),
                 full_name='Deepak Nair',    role='Driver'),
            User(user_id=uuid.UUID('cccccccc-0000-0000-0000-000000000002'),
                 full_name='Meena Iyer',     role='Driver'),
            User(user_id=uuid.UUID('cccccccc-0000-0000-0000-000000000003'),
                 full_name='Suresh Menon',   role='Driver'),
            User(user_id=uuid.UUID('cccccccc-0000-0000-0000-000000000004'),
                 full_name='Kavita Joshi',   role='Driver'),
        ]
        for u in users:
            User.objects.get_or_create(user_id=u.user_id, defaults={
                'full_name': u.full_name, 'role': u.role,
            })
        self.stdout.write(f'  Users          → {len(users)} created/verified')

    def _seed_routes(self):
        driver_ids = [
            uuid.UUID('cccccccc-0000-0000-0000-000000000001'),
            uuid.UUID('cccccccc-0000-0000-0000-000000000002'),
            uuid.UUID('cccccccc-0000-0000-0000-000000000003'),
            uuid.UUID('cccccccc-0000-0000-0000-000000000004'),
        ]
        for i, r in enumerate(ROUTES):
            driver = User.objects.get(user_id=driver_ids[i])
            Route.objects.get_or_create(route_id=r['route_id'], defaults={
                'route_name': r['route_name'],
                'assigned_driver': driver,
            })
        self.stdout.write(f'  Routes         → {len(ROUTES)} created/verified')

    def _seed_postal_codes(self):
        count = 0
        for route_id, codes in POSTAL_CODES.items():
            route = Route.objects.get(route_id=route_id)
            for code in codes:
                _, created = PostalCodeMapping.objects.get_or_create(
                    postal_code=code, defaults={'route': route}
                )
                if created:
                    count += 1
        self.stdout.write(f'  Postal codes   → {count} created')

    def _seed_locations(self):
        count = 0
        for zone in ZONES:
            for rack_num in range(1, RACKS_PER_ZONE + 1):
                for shelf_num in range(1, SHELVES_PER_RACK + 1):
                    rack = f'R{rack_num:02d}'
                    shelf = f'S{shelf_num}'
                    location_id = f'Z-{zone}-{rack}-{shelf}'
                    _, created = Location.objects.get_or_create(
                        location_id=location_id,
                        defaults={
                            'zone': zone,
                            'rack': rack_num,
                            'shelf': shelf_num,
                            'is_occupied': False,
                            'weight_capacity_kg': WEIGHT_CAPACITY,
                        }
                    )
                    if created:
                        count += 1
        self.stdout.write(f'  Locations      → {count} created ({len(ZONES)} zones × {RACKS_PER_ZONE} racks × {SHELVES_PER_RACK} shelves)')

    def _seed_fleets(self):
        for f in FLEETS:
            Fleet.objects.get_or_create(fleet_id=f['fleet_id'], defaults={
                'origin_hub': f['origin_hub'],
                'status': f['status'],
            })
        self.stdout.write(f'  Fleets         → {len(FLEETS)} created/verified')

    def _seed_orders(self):
        for o in ORDERS:
            Order.objects.get_or_create(order_id=o['order_id'], defaults={
                'total_boxes': o['total_boxes'],
                'delivery_address': o['delivery_address'],
            })
        self.stdout.write(f'  Orders         → {len(ORDERS)} created/verified')

    def _seed_boxes(self):
        from django.utils import timezone

        now = timezone.now()
        placed_location_ids = {loc_id for _, loc_id in BOX_PLACEMENTS if loc_id}

        count = 0
        for (tracking, fleet_id, order_id, route_id, seq, box_status) in BOXES:
            fleet = Fleet.objects.get(fleet_id=fleet_id)
            order = Order.objects.get(order_id=order_id)
            route = Route.objects.get(route_id=route_id)

            defaults = {
                'fleet': fleet,
                'order': order,
                'route': route,
                'box_sequence': seq,
                'status': box_status,
                'unloaded_at': now if box_status in ('Unloaded', 'Stored', 'Retrieved', 'Dispatched') else None,
                'stored_at':   now if box_status in ('Stored', 'Retrieved', 'Dispatched') else None,
                'dispatched_at': now if box_status == 'Dispatched' else None,
            }
            _, created = ShipmentBox.objects.get_or_create(
                tracking_number=tracking, defaults=defaults
            )
            if created:
                count += 1

        # Assign locations to Stored boxes and mark shelves occupied
        for tracking, location_id in BOX_PLACEMENTS:
            if location_id is None:
                continue
            try:
                box = ShipmentBox.objects.get(tracking_number=tracking)
                location = Location.objects.get(location_id=location_id)
                box.location = location
                box.save()
                location.is_occupied = True
                location.save()
            except (ShipmentBox.DoesNotExist, Location.DoesNotExist):
                pass

        self.stdout.write(f'  Shipment boxes → {count} created/verified')

    # ── Summary ───────────────────────────────────────────────────────────────

    def _print_summary(self):
        self.stdout.write('\n── Warehouse State ─────────────────────────────')
        self.stdout.write(f'  Users      : {User.objects.count()} ({User.objects.filter(role="Manager").count()} managers, {User.objects.filter(role="WarehouseStaff").count()} staff, {User.objects.filter(role="Driver").count()} drivers)')
        self.stdout.write(f'  Routes     : {Route.objects.count()}')
        self.stdout.write(f'  Locations  : {Location.objects.count()} total, {Location.objects.filter(is_occupied=False).count()} free')
        self.stdout.write(f'  Fleets     : {Fleet.objects.count()}')
        self.stdout.write(f'  Orders     : {Order.objects.count()} ({sum(o.total_boxes for o in Order.objects.all())} total boxes expected)')
        for s in ('In-Transit', 'Unloaded', 'Stored', 'Retrieved', 'Dispatched'):
            c = ShipmentBox.objects.filter(status=s).count()
            if c:
                self.stdout.write(f'  Boxes [{s:10s}]: {c}')
        self.stdout.write('────────────────────────────────────────────────')
