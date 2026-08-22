import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './lib/auth/tokenStore';
import { tryRefresh } from './lib/api/client';
import { cartApi } from './lib/api/endpoints';
import { guestCart } from './lib/cart/guestCart';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { PageFade } from './components/PageFade';
import { Spinner } from './components/ui';

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Addresses from './pages/Addresses';

// Route-level code split: the admin bundle (incl. charts) loads on demand (PRD §15).
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));

function SessionBootstrap({ children }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Silent session restore via the deduped refresh: the httpOnly cookie
        // (if present) buys a fresh access token; guests stay guests.
        const data = await tryRefresh();
        if (!cancelled && data) {
          // Guest cart merges into the server cart exactly once at login (PRD §4.3).
          const guestItems = guestCart.load();
          if (guestItems.length > 0) {
            try {
              await cartApi.merge(guestItems);
              guestCart.clear();
            } catch {
              // leave the guest cart intact to retry next load
            }
          }
        }
      } catch {
        // offline / API down — app still renders as guest
      } finally {
        if (!cancelled) useAuthStore.getState().setHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return children;
}

function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const location = useLocation();
  if (!hydrated) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 text-accent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>
        <BrowserRouter>
          <ScrollToTop />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
              <PageFade>
                <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route
                  path="/checkout"
                  element={
                    <RequireAuth>
                      <Checkout />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireAuth>
                      <Orders />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <RequireAuth>
                      <OrderDetail />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/addresses"
                  element={
                    <RequireAuth>
                      <Addresses />
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-accent" /></div>}>
                        <AdminLayout />
                      </Suspense>
                    </RequireAuth>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="orders/:id" element={<AdminOrderDetail />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="inventory" element={<AdminInventory />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </PageFade>
            </main>
            <Footer />
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: 'var(--color-surface, #fff)',
                color: 'var(--color-ink, #1c1b1a)',
                border: '1px solid var(--color-line, #e8e5e0)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(28,27,26,0.10)',
                fontSize: '14px',
              },
            }}
          />
        </BrowserRouter>
      </SessionBootstrap>
    </QueryClientProvider>
  );
}
