import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { productApi, categoryApi } from '../lib/api/endpoints';
import { useDebouncedValue } from '../hooks/useCart';
import { ProductCard, ProductCardSkeleton } from '../components/product/ProductCard';
import { Button, Chip, EmptyState, ErrorState, Input, Pagination, Select } from '../components/ui';

const RATING_OPTIONS = [
  { value: '4', label: '4★ & up' },
  { value: '3', label: '3★ & up' },
  { value: '2', label: '2★ & up' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const rating = searchParams.get('rating') || '';
  const inStock = searchParams.get('inStock') === 'true';
  const page = Number(searchParams.get('page') || 1);

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 350); // debounced search-as-you-type (PRD §14.3)

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  // Push the debounced search term into the URL once it settles.
  const [lastDebounced, setLastDebounced] = useState(debouncedSearch);
  if (debouncedSearch !== lastDebounced) {
    setLastDebounced(debouncedSearch);
    setParam('search', debouncedSearch);
  }

  const activeFilters = [
    category && { key: 'category', label: category.replaceAll('-', ' ') },
    rating && { key: 'rating', label: `${rating}★ & up` },
    inStock && { key: 'inStock', label: 'In stock' },
    minPrice && { key: 'minPrice', label: `Min ₹${minPrice}` },
    maxPrice && { key: 'maxPrice', label: `Max ₹${maxPrice}` },
    search && { key: 'search', label: `“${search}”` },
  ].filter(Boolean);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['products', { search, category, sort, minPrice, maxPrice, rating, inStock, page }],
    queryFn: () =>
      productApi.list({
        search: search || undefined,
        category: category || undefined,
        sort,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        rating: rating ? Number(rating) : undefined,
        inStock: inStock || undefined,
        page,
        limit: 12,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list().then((r) => r.data),
  });

  const FilterBody = (
    <div className="space-y-6">
      <Input
        label="Search"
        name="search"
        placeholder="Search products…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <div>
        <Select label="Category" name="category" value={category} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Min ₹"
          name="minPrice"
          type="number"
          min={0}
          defaultValue={minPrice}
          onBlur={(e) => setParam('minPrice', e.target.value)}
        />
        <Input
          label="Max ₹"
          name="maxPrice"
          type="number"
          min={0}
          defaultValue={maxPrice}
          onBlur={(e) => setParam('maxPrice', e.target.value)}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Rating</legend>
        <div className="flex flex-wrap gap-2">
          {RATING_OPTIONS.map((o) => (
            <Chip key={o.value} selected={rating === o.value} onClick={() => setParam('rating', rating === o.value ? '' : o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div>
        <Chip selected={inStock} onClick={() => setParam('inStock', inStock ? '' : 'true')}>
          In stock only
        </Chip>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow">Catalog</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Products</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Filters">
          {FilterBody}
          {activeFilters.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-6"
              onClick={() => {
                setSearchInput('');
                setSearchParams(new URLSearchParams());
              }}
            >
              Clear all filters
            </Button>
          )}
        </aside>

        <div>
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
            </Button>
            <p className="hidden text-sm text-ink-soft sm:block">
              {data?.pagination ? (
                <>
                  <span className="font-medium text-ink">{data.pagination.total}</span>{' '}
                  product{data.pagination.total === 1 ? '' : 's'}
                </>
              ) : (
                'Products'
              )}
              {isFetching && <span className="ml-2 text-ink-soft/60">updating…</span>}
            </p>
            <Select name="sort" value={sort} onChange={(e) => setParam('sort', e.target.value)} className="!w-48" aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="price">Price: low → high</option>
              <option value="-price">Price: high → low</option>
              <option value="rating">Top rated</option>
              <option value="popularity">Most popular</option>
            </Select>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <Chip key={f.key} selected onClick={() => setParam(f.key, '')}>
                  {f.label}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Chip>
              ))}
              <button
                className="ml-1 text-sm text-ink-soft underline-offset-2 hover:text-danger hover:underline"
                onClick={() => {
                  setSearchInput('');
                  setSearchParams(new URLSearchParams());
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {error ? (
            <ErrorState onRetry={refetch} />
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {data.data.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
              <Pagination
                page={data.pagination?.page ?? 1}
                totalPages={data.pagination?.totalPages ?? 1}
                onChange={(p) => setParam('page', String(p))}
              />
            </>
          ) : (
            <EmptyState
              title="No products match your filters"
              description="Try clearing a filter or two."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchInput('');
                    setSearchParams(new URLSearchParams());
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl bg-surface shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Filters</h2>
              <button className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-canvas" onClick={() => setSheetOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5">{FilterBody}</div>
            <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-4">
              <Button className="w-full" size="lg" onClick={() => setSheetOpen(false)}>
                Show {data?.pagination?.total ?? ''} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
