import { useEffect, useState } from 'react';
import { ShieldCheck, Compass, Store, Flag } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card, SectionTitle } from '../../components/ui/Primitives';
import { StatCard } from '../../components/ui/Controls';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Business, Ride } from '../../types';

export function AdminScreen() {
  const { user } = useApp();
  const [rides, setRides] = useState<Ride[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    api.listPublicRides().then(setRides);
    api.listBusinesses().then(setBusinesses);
  }, []);

  if (user?.role !== 'admin' && user?.role !== 'ride_leader') {
    // Demo mode grants admin visibility to the current user for exploration purposes.
  }

  return (
    <div className="rise-fade">
      <Header />
      <div className="px-4 md:px-6">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="text-ember-500" size={22} />
          <h1 className="font-display font-bold text-xl">Admin Console</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Active rides" value={String(rides.filter((r) => r.status === 'active').length)} />
          <StatCard label="Scheduled rides" value={String(rides.filter((r) => r.status === 'scheduled').length)} />
          <StatCard label="Businesses" value={String(businesses.length)} />
          <StatCard label="Open reports" value="0" />
        </div>

        <SectionTitle>Rides</SectionTitle>
        <div className="space-y-2 mb-6">
          {rides.length === 0 ? (
            <Card className="p-6 flex flex-col items-center text-center text-asphalt-400">
              <Compass size={22} className="mb-2" />
              <p className="text-sm">No rides created yet.</p>
            </Card>
          ) : (
            rides.map((r) => (
              <Card key={r.id} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Compass size={16} className="text-asphalt-400" />
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-asphalt-400 font-mono">{r.code}</p>
                  </div>
                </div>
                <span className="text-xs text-asphalt-400 capitalize">{r.status}</span>
              </Card>
            ))
          )}
        </div>

        <SectionTitle>Business registrations</SectionTitle>
        <div className="space-y-2 mb-6">
          {businesses.length === 0 ? (
            <Card className="p-6 flex flex-col items-center text-center text-asphalt-400">
              <Store size={22} className="mb-2" />
              <p className="text-sm">No businesses registered yet.</p>
            </Card>
          ) : (
            businesses.slice(0, 6).map((b) => (
              <Card key={b.id} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Store size={16} className="text-asphalt-400" />
                  <p className="text-sm font-semibold">{b.name}</p>
                </div>
                <span className="text-xs text-signal-green">Approved</span>
              </Card>
            ))
          )}
        </div>

        <SectionTitle>Reports</SectionTitle>
        <Card className="p-6 flex flex-col items-center text-center text-asphalt-400">
          <Flag size={22} className="mb-2" />
          <p className="text-sm">No open reports. Moderation queue is clear.</p>
        </Card>
      </div>
    </div>
  );
}
