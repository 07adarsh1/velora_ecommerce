import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">
            Shelf<span className="text-accent">Life</span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            A production-grade e-commerce experience — real payments, live inventory, and every order tracked end to end.
          </p>
        </div>
        <nav aria-label="Shop">
          <p className="eyebrow">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/products" className="text-ink-soft hover:text-accent">All products</Link></li>
            <li><Link to="/products?sort=rating" className="text-ink-soft hover:text-accent">Top rated</Link></li>
            <li><Link to="/products?sort=newest" className="text-ink-soft hover:text-accent">New arrivals</Link></li>
            <li><Link to="/orders" className="text-ink-soft hover:text-accent">Track an order</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <p className="eyebrow">Help</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/login" className="text-ink-soft hover:text-accent">Sign in</Link></li>
            <li><Link to="/register" className="text-ink-soft hover:text-accent">Create an account</Link></li>
            <li><Link to="/forgot-password" className="text-ink-soft hover:text-accent">Reset password</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-soft sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} ShelfLife — portfolio project.</p>
          <p className="tracking-wide">Payments run in sandbox / test mode · Signature-verified checkout</p>
        </div>
      </div>
    </footer>
  );
}
