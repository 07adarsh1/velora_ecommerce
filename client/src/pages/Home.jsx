import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Headphones,
  Laptop,
  Watch,
  Sparkles,
  Dumbbell,
  BookOpen,
  Gamepad2,
  ShoppingBag,
  Layers,
} from 'lucide-react';
import { productApi, categoryApi } from '../lib/api/endpoints';
import { ProductCard, ProductCardSkeleton } from '../components/product/ProductCard';
import { Button, EmptyState, ErrorState, SectionHeader } from '../components/ui';
import { cimg } from '../lib/utils/image';

const CATEGORY_ICONS = {
  audio: Headphones,
  electronics: Laptop,
  wearables: Watch,
  'home-kitchen': Sparkles,
  fitness: Dumbbell,
  books: BookOpen,
  gaming: Gamepad2,
  accessories: ShoppingBag,
};

function getCategoryIcon(slug = '', name = '') {
  const key = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase();
  return CATEGORY_ICONS[key] || Layers;
}

/** Subtle transform-only parallax for the hero media (docs/ui-prd.md §4.2). */
function useParallax() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOffset(Math.min(window.scrollY * 0.05, 36)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return offset;
}

export default function Home() {
  const parallax = useParallax();

  const { data: featured, isLoading, error, refetch } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => productApi.list({ sort: 'rating', limit: 8 }).then((r) => r.data),
  });

  const { data: newest } = useQuery({
    queryKey: ['products', 'newest'],
    queryFn: () => productApi.list({ sort: 'newest', limit: 4 }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list().then((r) => r.data),
  });

  const hero = featured?.find((p) => p.images?.[0]);
  const editorial = featured?.find((p) => p.images?.[0] && p !== hero);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="max-w-xl">
          <p className="eyebrow">The everyday shelf, curated</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Everything you need, on the shelf.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            Browse the catalog, pay securely, track every order — a full e-commerce experience built production-style.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products">
              <Button size="lg">
                Shop now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link to="/products?sort=rating">
              <Button size="lg" variant="secondary">
                Top rated
              </Button>
            </Link>
          </div>
        </div>
        {hero && (
          <div className="relative">
            <Link
              to={`/products/${hero.slug}`}
              className="group block overflow-hidden rounded-media border border-line bg-surface transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(28,27,26,0.08)]"
              aria-label={`Featured: ${hero.name}`}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-line/20 p-6 sm:aspect-[5/4] sm:p-10 flex items-center justify-center">
                <img
                  src={cimg(hero.images[0], { w: 900 })}
                  alt={hero.name}
                  fetchPriority="high"
                  className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/40 to-transparent p-5 pt-16">
                <p className="eyebrow !text-white/80">Featured</p>
                <p className="mt-1 font-display text-lg font-medium text-white">{hero.name}</p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* Category rail */}
      {categories && categories.length > 0 && (
        <section aria-label="Shop by category">
          <SectionHeader
            eyebrow="Browse"
            title="Shop by category"
            action={
              <Link to="/products" className="text-sm font-medium text-accent hover:text-accent-hover">
                All categories →
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {categories.map((c) => {
              const Icon = getCategoryIcon(c.slug, c.name);
              return (
                <Link
                  key={c._id}
                  to={`/products?category=${c.slug}`}
                  className="group flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-[0_8px_24px_rgba(28,27,26,0.06)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent transition-all duration-200 group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium tracking-tight text-ink transition-colors group-hover:text-accent">
                    {c.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Top rated */}
      <section aria-label="Top rated products">
        <SectionHeader
          eyebrow="Community favourites"
          title="Top rated"
          action={
            <Link to="/products?sort=rating" className="text-sm font-medium text-accent hover:text-accent-hover">
              View all →
            </Link>
          }
        />
        {error ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : featured && featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState title="No products yet" description="Run the seed script in server/ to populate the catalog." />
        )}
      </section>

      {/* Editorial strip */}
      {editorial && (
        <section className="grid items-stretch gap-0 overflow-hidden rounded-media border border-line bg-surface md:grid-cols-2">
          <div className="relative flex min-h-64 items-center justify-center bg-line/20 p-8 sm:p-12">
            <img
              src={cimg(editorial.images[0], { w: 1000 })}
              alt={editorial.name}
              loading="lazy"
              className="max-h-72 w-full object-contain transition-transform duration-300 hover:scale-105"
            />
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="eyebrow">In focus</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {editorial.name}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              {editorial.description?.split('.')[0]}. Hand-picked by our team and loved by the community — see why it
              earns its place on the shelf.
            </p>
            <Link to={`/products/${editorial.slug}`} className="mt-6 self-start">
              <Button variant="secondary">
                Explore <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* New arrivals */}
      {newest && newest.length > 0 && (
        <section aria-label="New arrivals">
          <SectionHeader
            eyebrow="Just landed"
            title="New arrivals"
            action={
              <Link to="/products?sort=newest" className="text-sm font-medium text-accent hover:text-accent-hover">
                View all →
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {newest.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
