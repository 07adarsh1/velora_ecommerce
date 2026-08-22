import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { Price, ProductMedia, Skeleton, Stars } from '../ui';
import { cimg } from '../../lib/utils/image';
import { formatINR } from '../../lib/api/client';

export function effectivePrice(p) {
  return Math.round(p.basePrice * (1 - p.discountPercent / 100) * 100) / 100;
}

export function ProductCard({ product }) {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const price = effectivePrice(product);
  const hasVariants = product.variants?.length > 0;
  const inStock = hasVariants ? product.variants.some((v) => v.stock > 0) : product.stock > 0;
  const category = typeof product.category === 'object' ? product.category : null;

  // Variant products need an option choice — quick-add routes to the PDP.
  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    if (hasVariants) {
      navigate(`/products/${product.slug}`);
      return;
    }
    addToCart.mutate({ productId: product._id, variantSku: null, quantity: 1, name: product.name });
  };

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(28,27,26,0.08)]"
    >
      <div className="relative">
        <ProductMedia src={cimg(product.images?.[0], { w: 600 })} alt={product.name} />

        {product.discountPercent > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-sale px-2.5 py-1 text-[11px] font-semibold text-white">
            −{product.discountPercent}%
          </span>
        )}
        {!inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1.5 text-center text-xs font-medium text-white backdrop-blur-[2px]">
            Out of stock
          </span>
        )}

        {inStock && (
          <button
            onClick={handleQuickAdd}
            className="absolute inset-x-3 bottom-3 flex min-h-11 items-center justify-center gap-1.5 rounded-input bg-ink/85 text-sm font-medium text-white opacity-0 backdrop-blur transition-all duration-200 [transform:translateY(8px)] group-hover:opacity-100 group-hover:[transform:translateY(0)] hover:bg-ink"
            aria-label={hasVariants ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
          >
            {hasVariants ? (
              'Choose options'
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add to cart
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {category && <span className="eyebrow">{category.name}</span>}
        <h3 className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover:text-accent">
          {product.name}
        </h3>
        {product.numReviews > 0 ? (
          <Stars rating={product.averageRating} count={product.numReviews} />
        ) : (
          <span className="text-xs text-ink-soft/70">No reviews yet</span>
        )}
        <Price
          current={formatINR(price)}
          original={product.discountPercent > 0 ? formatINR(product.basePrice) : undefined}
          discountPercent={product.discountPercent}
          className="mt-auto pt-2"
        />
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="skeleton-shimmer aspect-[4/5] w-full" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  );
}
