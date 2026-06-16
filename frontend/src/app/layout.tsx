import type { Metadata } from 'next';
import './globals.css';
import { NavLink } from '@/components/NavLink';

export const metadata: Metadata = {
  title: 'WarehouseOS',
  description: 'Digital Warehouse Localization System',
};

const NAV = [
  { href: '/',          label: 'Dashboard',  icon: '▤'  },
  { href: '/fleets',    label: 'Fleets',     icon: '🚚' },
  { href: '/scan',      label: 'Scan',       icon: '⬡'  },
  { href: '/locations', label: 'Locations',  icon: '⊞'  },
  { href: '/routes',    label: 'Routes',     icon: '⤢'  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 min-h-screen font-sans flex">
        <aside className="w-56 min-h-screen bg-slate-900 flex flex-col fixed top-0 left-0 z-20 shadow-xl">
          <div className="px-5 pt-6 pb-5 border-b border-slate-700/60">
            <p className="font-bold text-white text-base tracking-tight">WarehouseOS</p>
            <p className="text-slate-500 text-xs mt-0.5">Logistics Command Center</p>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 mt-1">
            {NAV.map(n => (
              <NavLink key={n.href} {...n} />
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">A</div>
              <div>
                <p className="text-white text-xs font-medium">Admin</p>
                <p className="text-slate-500 text-xs">Manager</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="ml-56 flex-1 flex flex-col min-h-screen">
          <main className="flex-1 p-6 max-w-7xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
