import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, LocateFixed } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notifications/notificationService';
import { useMyLocation } from '../../hooks/useMyLocation';
import type { BusinessCategory } from '../../types';

const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'petrol', label: 'Petrol station' },
  { value: 'ev_charging', label: 'EV charging' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'tyre_shop', label: 'Tyre shop' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'bike_service', label: 'Bike service' },
  { value: 'accessories', label: 'Accessories shop' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'other', label: 'Other' },
];

export function BusinessRegisterScreen() {
  const navigate = useNavigate();
  const { user } = useApp();
  // Reuses the existing, working GPS pipeline (no changes to it) so the
  // business is registered at the device's real current location — never a
  // guessed or hardcoded coordinate.
  const { position, permission, retry } = useMyLocation();
  const [form, setForm] = useState({
    name: '',
    category: 'mechanic' as BusinessCategory,
    contactName: '',
    address: '',
    phone: '',
    website: '',
    openingHours: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!user || !form.name || !position) return;
    setSubmitting(true);
    try {
      await api.registerBusiness({
        ownerId: user.id,
        name: form.name,
        category: form.category,
        contactName: form.contactName,
        address: form.address,
        // Real device GPS location, captured at registration time.
        location: { lat: position.lat, lng: position.lng },
        phone: form.phone,
        website: form.website,
        openingHours: form.openingHours,
        description: form.description,
        services: [],
        photos: [],
        isOpenNow: true,
      });
      notificationService.toast('Business registered', `${form.name} is now visible to riders on the map.`, 'success');
      navigate('/business/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(form.name && position && !submitting);

  return (
    <div className="px-4 md:px-6 py-4 max-w-lg mx-auto rise-fade">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-asphalt-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl">Register Business</h1>
      </div>

      {/* Real GPS location status — this business will be saved at your device's actual current position */}
      {!position ? (
        <div className="flex items-start gap-2.5 bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 mb-4">
          {permission === 'denied' || permission === 'unavailable' ? (
            <>
              <MapPin size={16} className="text-signal-amber shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-asphalt-100">Location access needed</p>
                <p className="text-xs text-asphalt-400 mt-0.5">
                  We save your business at your device's real GPS location — enable location access to continue.
                </p>
              </div>
              <button onClick={retry} className="text-xs font-semibold text-ember-400 shrink-0 mt-0.5">
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="w-4 h-4 border-2 border-asphalt-500 border-t-gps-400 rounded-full animate-spin shrink-0 mt-0.5" />
              <p className="text-xs text-asphalt-300">Getting your real GPS location…</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-gps-500/10 border border-gps-500/30 rounded-xl px-4 py-2.5 mb-4">
          <LocateFixed size={15} className="text-gps-400 shrink-0" />
          <p className="text-xs text-gps-400">
            Will be saved at your current location ({position.lat.toFixed(5)}, {position.lng.toFixed(5)})
          </p>
        </div>
      )}

      <div className="space-y-4">
        <Field label="Business name">
          <input value={form.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} placeholder="e.g. Ramesh Bike Works" />
        </Field>

        <Field label="Business type">
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => update({ category: c.value })}
                className={`text-sm rounded-xl py-2.5 border font-medium ${
                  form.category === c.value ? 'bg-ember-500/15 border-ember-500 text-ember-400' : 'bg-asphalt-800 border-asphalt-600 text-asphalt-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Owner / contact name">
          <input value={form.contactName} onChange={(e) => update({ contactName: e.target.value })} className={inputClass} placeholder="Who should riders ask for?" />
        </Field>

        <Field label="Address">
          <input value={form.address} onChange={(e) => update({ address: e.target.value })} className={inputClass} placeholder="Street, area, city" />
        </Field>

        <Field label="Phone">
          <input value={form.phone} onChange={(e) => update({ phone: e.target.value })} className={inputClass} placeholder="+91…" />
        </Field>

        <Field label="Website (optional)">
          <input value={form.website} onChange={(e) => update({ website: e.target.value })} className={inputClass} placeholder="https://" />
        </Field>

        <Field label="Opening hours">
          <input value={form.openingHours} onChange={(e) => update({ openingHours: e.target.value })} className={inputClass} placeholder="9 AM – 9 PM" />
        </Field>

        <Field label="Description">
          <textarea value={form.description} onChange={(e) => update({ description: e.target.value })} rows={3} className={`${inputClass} resize-none`} placeholder="What makes your business rider-friendly?" />
        </Field>

        <Button fullWidth size="lg" onClick={submit} disabled={!canSubmit}>
          {submitting ? 'Registering…' : !position ? 'Waiting for GPS location…' : 'Register Business'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-asphalt-300 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ember-500 text-asphalt-100 placeholder:text-asphalt-500';
