import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { EyeOff, PackagePlus, Pencil, SlidersVertical } from 'lucide-react';
import { adminApi, categoryApi, productApi } from '../../lib/api/endpoints';
import { Badge, Button, Drawer, EmptyState, ErrorState, Input, Modal, Pagination, Select, Skeleton } from '../../components/ui';
import { formatINR, formatDate } from '../../lib/api/client';

const EMPTY_PRODUCT = {
  name: '',
  brand: '',
  description: '',
  category: '',
  images: '',
  basePrice: '',
  discountPercent: 0,
  stock: 0,
};

function ProductForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);
  const [variantsText, setVariantsText] = useState(
    (initial.variants || []).map((v) => `${v.sku}|${v.attributes?.color || ''}|${v.attributes?.size || ''}|${v.price ?? ''}|${v.stock}`).join('\n')
  );
  const [fieldErrors, setFieldErrors] = useState({});

  const save = useMutation({
    mutationFn: async () => {
      const variants = variantsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [sku, color, size, price, stock] = line.split('|').map((s) => s.trim());
          return {
            sku,
            attributes: { color: color || undefined, size: size || undefined },
            ...(price ? { price: Number(price) } : {}),
            stock: Number(stock || 0),
          };
        });

      const body = {
        name: form.name,
        brand: form.brand || undefined,
        description: form.description,
        category: form.category,
        images: form.images.split('\n').map((s) => s.trim()).filter(Boolean),
        basePrice: Number(form.basePrice),
        discountPercent: Number(form.discountPercent || 0),
        stock: Number(form.stock || 0),
        variants,
      };
      return initial._id ? adminApi.updateProduct(initial._id, body) : adminApi.createProduct(body);
    },
    onSuccess: () => {
      toast.success(initial._id ? 'Product updated' : 'Product created');
      onSaved();
    },
    onError: (err) => {
      if (err.details?.length) {
        const map = {};
        for (const d of err.details) map[d.field.replace('body.', '')] = d.message;
        setFieldErrors(map);
      } else {
        toast.error(err.message || 'Save failed');
      }
    },
  });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list().then((r) => r.data) });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-4"
    >
      <Input label="Name" name="name" required value={form.name} onChange={set('name')} error={fieldErrors.name} />
      <Input label="Brand" name="brand" value={form.brand} onChange={set('brand')} />
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id="description"
          className="block w-full rounded-input border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          rows={3}
          required
          minLength={10}
          value={form.description}
          onChange={set('description')}
        />
        {fieldErrors.description && <p className="mt-1 text-xs text-danger">{fieldErrors.description}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Base price (₹)" name="basePrice" type="number" min={0} required value={form.basePrice} onChange={set('basePrice')} />
        <Input label="Discount %" name="discountPercent" type="number" min={0} max={100} value={form.discountPercent} onChange={set('discountPercent')} />
        <Input label="Stock (no variants)" name="stock" type="number" min={0} value={form.stock} onChange={set('stock')} />
      </div>
      <Select label="Category" name="category" required value={form.category} onChange={set('category')}>
        <option value="">Choose…</option>
        {categories?.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </Select>
      <div>
        <label htmlFor="images" className="mb-1 block text-sm font-medium text-ink">
          Image URLs (one per line)
        </label>
        <textarea
          id="images"
          className="block w-full rounded-input border border-line bg-surface px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          rows={2}
          value={form.images}
          onChange={set('images')}
          placeholder="https://…"
        />
      </div>
      <div>
        <label htmlFor="variants" className="mb-1 block text-sm font-medium text-ink">
          Variants — one per line: SKU|color|size|priceOverride|stock
        </label>
        <textarea
          id="variants"
          className="block w-full rounded-input border border-line bg-surface px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          rows={3}
          value={variantsText}
          onChange={(e) => setVariantsText(e.target.value)}
          placeholder={'TSHIRT-BLK-M|Black|M||12'}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {initial._id ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}

function AdjustStockModal({ product, onClose }) {
  const queryClient = useQueryClient();
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [variantSku, setVariantSku] = useState('');

  const adjust = useMutation({
    mutationFn: () =>
      adminApi.adjustStock(product._id, {
        change: Number(change),
        reason,
        variantSku: variantSku || (product.variants?.length > 0 ? variantSku : null),
      }),
    onSuccess: () => {
      toast.success('Stock adjusted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Adjustment failed'),
  });

  return (
    <Modal open onClose={onClose} title={`Adjust stock — ${product.name}`}>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          Current:{' '}
          {product.variants?.length > 0
            ? product.variants.map((v) => `${v.sku}: ${v.stock}`).join(', ')
            : `top-level stock ${product.stock}`}
        </p>
        {product.variants?.length > 0 && (
          <Select label="Variant" name="variantSku" value={variantSku} onChange={(e) => setVariantSku(e.target.value)}>
            <option value="">Choose a variant…</option>
            {product.variants.map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.sku} ({v.stock})
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Change (e.g. 10 restock, -2 correction)"
          name="change"
          type="number"
          required
          value={change}
          onChange={(e) => setChange(e.target.value)}
        />
        <Input
          label="Reason"
          name="reason"
          required
          minLength={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="restock / correction / damaged"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={adjust.isPending} disabled={!change || !reason} onClick={() => adjust.mutate()}>
            Apply adjustment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const th = 'px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-soft';

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [adjusting, setAdjusting] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'products', page],
    queryFn: () => productApi.list({ page, limit: 20, sort: 'newest' }),
  });

  const unpublish = useMutation({
    mutationFn: (id) => adminApi.deleteProduct(id),
    onSuccess: () => {
      toast.success('Product unpublished');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    );
  }

  const products = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Products</h1>
        </div>
        <Button onClick={() => setEditing('new')}>
          <PackagePlus className="h-4 w-4" aria-hidden="true" /> New product
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="No products"
          description="Create your first product."
          action={<Button onClick={() => setEditing('new')}>New product</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Price</th>
                <th className={th}>Stock</th>
                <th className={th}>Rating</th>
                <th className={th}>Status</th>
                <th className={th}>Updated</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className="border-t border-line transition-colors hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-input bg-line/40">
                        {p.images?.[0] && <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{p.name}</p>
                        <p className="truncate text-xs text-ink-soft">{typeof p.category === 'object' ? p.category.name : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatINR(Math.round(p.basePrice * (1 - p.discountPercent / 100)))}
                    {p.discountPercent > 0 && <span className="ml-1 text-xs text-ink-soft/70 line-through">{formatINR(p.basePrice)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.variants?.length > 0 ? (
                      <span className="text-xs text-ink-soft">
                        {p.variants.reduce((s, v) => s + v.stock, 0)} across {p.variants.length} variants
                      </span>
                    ) : (
                      <span className={p.stock === 0 ? 'font-semibold text-danger' : p.stock <= 5 ? 'font-semibold text-warn' : ''}>{p.stock}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{p.numReviews > 0 ? `${p.averageRating.toFixed(1)} (${p.numReviews})` : '—'}</td>
                  <td className="px-4 py-3">{p.isPublished ? <Badge color="green">live</Badge> : <Badge color="gray">unpublished</Badge>}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{formatDate(p.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setAdjusting(p)} aria-label={`Adjust stock for ${p.name}`} title="Adjust stock">
                        <SlidersVertical className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.isPublished && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unpublish.mutate(p._id)}
                          aria-label={`Unpublish ${p.name}`}
                          title="Unpublish"
                          className="!text-ink-soft/70 hover:!bg-danger/10 hover:!text-danger"
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New product' : 'Edit product'} wide>
        {editing && (
          <ProductForm
            initial={
              editing === 'new'
                ? EMPTY_PRODUCT
                : {
                    ...editing,
                    images: (editing.images || []).join('\n'),
                    basePrice: String(editing.basePrice),
                    discountPercent: editing.discountPercent ?? 0,
                    stock: editing.variants?.length > 0 ? 0 : editing.stock,
                    category: typeof editing.category === 'object' ? editing.category._id : editing.category,
                  }
            }
            onSaved={() => {
              setEditing(null);
              queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>

      {adjusting && <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}
