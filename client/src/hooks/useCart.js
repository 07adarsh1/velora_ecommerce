import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cartApi } from '../lib/api/endpoints';
import { useAuthStore } from '../lib/auth/tokenStore';
import { guestCart } from '../lib/cart/guestCart';

export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Cart data + badge count for logged-in users (server cart) and guests
 * (localStorage). Mutations show toasts and refresh the cart query.
 */
export function useCart() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const isLoggedIn = Boolean(user);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get().then((r) => r.data),
    enabled: isLoggedIn,
  });

  const [guestVersion, setGuestVersion] = useState(0);
  useEffect(() => {
    const handler = () => setGuestVersion((v) => v + 1);
    window.addEventListener('guest-cart-changed', handler);
    return () => window.removeEventListener('guest-cart-changed', handler);
  }, []);

  const guestCount = guestCart.count();
  void guestVersion; // recompute on guest-cart events

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cart'] });

  const addToCart = useMutation({
    mutationFn: async ({ productId, variantSku = null, quantity = 1 }) => {
      const payload = { productId, variantSku, quantity };
      if (isLoggedIn) {
        const res = await cartApi.addItem(payload);
        invalidate();
        return res;
      }
      guestCart.add(payload);
      return null;
    },
    onSuccess: () => toast.success('Added to cart'),
    onError: (err) => toast.error(err.message),
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ productId, variantSku, quantity }) => {
      if (isLoggedIn) {
        const res = await cartApi.updateItem(productId, { variantSku, quantity });
        invalidate();
        return res;
      }
      guestCart.setQuantity(productId, variantSku, quantity);
      return null;
    },
    onError: (err) => toast.error(err.message),
  });

  const removeItem = useMutation({
    mutationFn: async ({ productId, variantSku }) => {
      if (isLoggedIn) {
        const res = await cartApi.removeItem(productId, variantSku);
        invalidate();
        return res;
      }
      guestCart.remove(productId, variantSku);
      return null;
    },
    onSuccess: () => toast.success('Removed from cart'),
    onError: (err) => toast.error(err.message),
  });

  const itemCount = isLoggedIn ? data?.cart.items.reduce((s, i) => s + i.quantity, 0) ?? 0 : guestCount;

  return { cart: data, isLoading, error, refetch, itemCount, isLoggedIn, addToCart, updateQuantity, removeItem };
}
