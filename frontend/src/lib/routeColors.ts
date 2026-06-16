export interface RouteColor {
  bg: string;
  border: string;
  text: string;
  badge: string;
  dot: string;
  icon: string;
}

const ROUTE_COLORS: Record<string, RouteColor> = {
  'RT-NORTH': { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500',   icon: '↑' },
  'RT-SOUTH': { bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700', dot: 'bg-green-500',  icon: '↓' },
  'RT-EAST':  { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500', icon: '→' },
  'RT-WEST':  { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500', icon: '←' },
};

const FALLBACK: RouteColor = {
  bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700',
  badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', icon: '⊕',
};

export function getRouteColor(routeId: string): RouteColor {
  return ROUTE_COLORS[routeId] ?? FALLBACK;
}
