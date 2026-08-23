import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Heart, LogOut, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/tokenStore';
import { authApi } from '../../lib/api/endpoints';
import { useCart } from '../../hooks/useCart';
import { Button } from '../ui';

function Navbar() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { itemCount } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Esc closes the drawer; focus returns to the trigger.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    drawerRef.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Route change closes the drawer.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // logout is best-effort client-side; clearing state is what matters
    }
    clear();
    queryClient.clear();
    toast.success('Logged out');
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors hover:text-accent ${isActive ? 'text-accent' : 'text-ink-soft'}`;

  const iconLinkClass =
    'flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-canvas hover:text-ink';

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-200 ${
          scrolled ? 'border-line bg-surface/90 backdrop-blur-md' : 'border-line bg-surface'
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <button
              className={`${iconLinkClass} md:hidden`}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="font-display text-xl font-semibold tracking-tight text-ink">
              Vel<span className="text-accent">ora</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
              <NavLink to="/products" className={linkClass}>
                Products
              </NavLink>
              {user && (
                <NavLink to="/orders" className={linkClass}>
                  Orders
                </NavLink>
              )}
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={linkClass}>
                  Admin
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button className={`${iconLinkClass} hidden sm:flex`} onClick={() => navigate('/products')} aria-label="Search products">
              <Search className="h-5 w-5" />
            </button>
            {user ? (
              <>
                <Link to="/wishlist" className={`${iconLinkClass} hidden sm:flex`} aria-label="Wishlist">
                  <Heart className="h-5 w-5" />
                </Link>
                <Link to="/profile" className={`${iconLinkClass} hidden sm:flex`} aria-label="Account">
                  <User className="h-5 w-5" />
                </Link>
                <Link to="/cart" className={`${iconLinkClass} relative`} aria-label={`Cart with ${itemCount} items`}>
                  <ShoppingBag className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                      {itemCount}
                    </span>
                  )}
                </Link>
                <Button variant="ghost" size="sm" className="ml-2 hidden lg:inline-flex" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={`${linkClass} mr-2 hidden md:inline-flex`}>
                  Log in
                </NavLink>
                <Link to="/register">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div ref={drawerRef} className="drawer-in fixed inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-surface shadow-2xl">
            <div className="flex h-[72px] items-center justify-between border-b border-line px-4">
              <span className="font-display text-xl font-semibold">
                Vel<span className="text-accent">ora</span>
              </span>
              <button className={iconLinkClass} onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
              {[
                { to: '/products', label: 'Products' },
                user && { to: '/orders', label: 'Orders' },
                user && { to: '/wishlist', label: 'Wishlist' },
                user && { to: '/profile', label: 'Account' },
                user?.role === 'admin' && { to: '/admin', label: 'Admin' },
              ]
                .filter(Boolean)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-input px-3 py-3 text-base font-medium transition-colors ${
                        isActive ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-canvas'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
            </nav>
            <div className="mt-auto border-t border-line p-4">
              {user ? (
                <Button variant="secondary" className="w-full" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> Log out
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login" className="block">
                    <Button variant="secondary" className="w-full">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register" className="block">
                    <Button className="w-full">Sign up</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { Navbar };
