import { Link, NavLink, Outlet } from 'react-router-dom';
import { Boxes, LayoutDashboard, Package, ShoppingCart, TicketPercent, Users } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/tokenStore';
import { Button, EmptyState } from '../../components/ui';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
];

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);

  // UX guard only — the API enforces the role on every request regardless
  // of what the frontend shows (PRD §3).
  if (user && user.role !== 'admin') {
    return (
      <EmptyState
        title="Admins only"
        description="Your account does not have access to this area."
        action={
          <Link to="/">
            <Button>Back to the shop</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <nav
        aria-label="Admin"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:w-44 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2.5 rounded-input px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
