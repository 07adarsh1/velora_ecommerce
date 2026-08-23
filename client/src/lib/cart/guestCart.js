// Guest cart persisted in localStorage — merged into the server cart on login.
const KEY = 'velora_guest_cart';

export const guestCart = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  },
  save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('guest-cart-changed'));
  },
  add(item) {
    const items = this.load();
    const existing = items.find((i) => i.productId === item.productId && i.variantSku === item.variantSku);
    if (existing) existing.quantity += item.quantity;
    else items.push(item);
    this.save(items);
  },
  setQuantity(productId, variantSku, quantity) {
    let items = this.load();
    const existing = items.find((i) => i.productId === productId && i.variantSku === variantSku);
    if (existing) existing.quantity = quantity;
    items = items.filter((i) => i.quantity > 0);
    this.save(items);
  },
  remove(productId, variantSku) {
    this.save(this.load().filter((i) => !(i.productId === productId && i.variantSku === variantSku)));
  },
  clear() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('guest-cart-changed'));
  },
  count() {
    return this.load().reduce((sum, i) => sum + i.quantity, 0);
  },
};
