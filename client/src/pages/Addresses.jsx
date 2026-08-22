import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { addressApi } from '../lib/api/endpoints';
import { Badge, Button, EmptyState, ErrorState, Input, Modal, Skeleton } from '../components/ui';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
};

function AddressFields({ form, setForm }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full name" name="fullName" required value={form.fullName} onChange={set('fullName')} />
        <Input label="Phone" name="phone" required value={form.phone} onChange={set('phone')} />
      </div>
      <Input label="Address line 1" name="line1" required value={form.line1} onChange={set('line1')} />
      <Input label="Address line 2 (optional)" name="line2" value={form.line2} onChange={set('line2')} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="City" name="city" required value={form.city} onChange={set('city')} />
        <Input label="State" name="state" required value={form.state} onChange={set('state')} />
        <Input label="PIN code" name="postalCode" required value={form.postalCode} onChange={set('postalCode')} />
      </div>
      <Input label="Country" name="country" required value={form.country} onChange={set('country')} />
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          className="h-4 w-4 rounded border-line"
        />
        Set as default address
      </label>
    </>
  );
}

export default function Addresses() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // address object or null for new
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const save = useMutation({
    mutationFn: () => (editing ? addressApi.update(editing._id, form) : addressApi.create(form)),
    onSuccess: () => {
      toast.success(editing ? 'Address updated' : 'Address added');
      setModalOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save'),
  });

  const remove = useMutation({
    mutationFn: (id) => addressApi.remove(id),
    onSuccess: () => {
      toast.success('Address deleted');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete'),
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (address) => {
    setEditing(address);
    setForm({ ...EMPTY_FORM, ...address });
    setModalOpen(true);
  };

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    );
  }

  const addresses = data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">Delivery details</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Saved addresses</h1>
        </div>
        <Button onClick={openNew}>Add address</Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a shipping address to speed up checkout."
          action={<Button onClick={openNew}>Add your first address</Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a._id} className="rounded-card border border-line bg-surface p-5">
              <div className="flex items-start justify-between">
                <p className="font-medium">
                  {a.fullName} {a.isDefault && <Badge color="blue">default</Badge>}
                </p>
              </div>
              <address className="mt-1.5 text-sm not-italic leading-relaxed text-ink-soft">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}
                <br />
                {a.city}, {a.state} {a.postalCode}
                <br />
                {a.country} · {a.phone}
              </address>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(a._id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        Need to check out?{' '}
        <Link to="/cart" className="font-medium text-accent">
          Back to cart
        </Link>
      </p>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit address' : 'New address'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <AddressFields form={form} setForm={setForm} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save changes' : 'Add address'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
