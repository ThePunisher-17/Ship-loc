'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { ScanUnloadResponse, ScanStoreResponse, User } from '@/types';

type Step = 'idle' | 'unloaded' | 'stored';

export default function ScanPage() {
  const { toast } = useToast();
  const [step, setStep]                 = useState<Step>('idle');
  const [trackingInput, setTrackingInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [staffList, setStaffList]         = useState<User[]>([]);
  const [unloadResult, setUnloadResult]   = useState<ScanUnloadResponse | null>(null);
  const [storeResult, setStoreResult]     = useState<ScanStoreResponse | null>(null);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    api.getUsers({ role: 'WarehouseStaff' })
      .then(d => {
        setStaffList(d.results.filter(u => u.active_status));
        if (d.results.length > 0) setSelectedStaff(d.results[0].user_id);
      })
      .catch(() => {});
  }, []);

  async function handleUnload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.scanUnload(trackingInput.trim());
      setUnloadResult(result);
      setStep('unloaded');
      toast(`Box ${result.box.tracking_number} unloaded`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast(msg, 'error');
    } finally { setLoading(false); }
  }

  async function handleStore(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaff) { setError('Select a staff member first'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await api.scanStore(
        unloadResult!.box.tracking_number,
        locationInput.trim(),
        selectedStaff,
      );
      setStoreResult(result);
      setStep('stored');
      toast(`Stored at ${result.box.location_label}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast(msg, 'error');
    } finally { setLoading(false); }
  }

  function reset() {
    setStep('idle');
    setTrackingInput('');
    setLocationInput('');
    setUnloadResult(null);
    setStoreResult(null);
    setError('');
  }

  const stepLabels: [Step, string][] = [['idle', 'Scan Box'], ['unloaded', 'Scan Shelf'], ['stored', 'Done']];

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Scan Workflow</h1>
        <p className="text-sm text-slate-500 mt-0.5">Two-step poka-yoke: scan parcel barcode, then scan shelf barcode.</p>
      </div>

      {/* Staff selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Staff on duty</label>
        {staffList.length === 0 ? (
          <p className="text-sm text-slate-400">Loading staff…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {staffList.map(u => (
              <button
                key={u.user_id}
                onClick={() => setSelectedStaff(u.user_id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  selectedStaff === u.user_id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {u.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 items-center">
        {stepLabels.map(([s, label], i) => {
          const stepIdx = stepLabels.findIndex(([k]) => k === step);
          const thisIdx = i;
          const done    = stepIdx > thisIdx;
          const active  = stepIdx === thisIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${active ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{label}</span>
              {i < stepLabels.length - 1 && <span className="text-slate-300 mx-1">→</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Step 1: Scan box */}
      {step === 'idle' && (
        <form onSubmit={handleUnload} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Box Tracking Number (AWB)</label>
            <input
              type="text" value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
              placeholder="e.g. TRK-C001" autoFocus required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Scan the barcode or type the AWB number manually</p>
          </div>
          <button type="submit" disabled={loading || !selectedStaff}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Scanning…' : 'Confirm Unload ↵'}
          </button>
        </form>
      )}

      {/* Step 2: Box info + shelf scan */}
      {step === 'unloaded' && unloadResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Box Unloaded ✓</p>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono font-bold text-slate-900 text-base">{unloadResult.box.tracking_number}</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{unloadResult.box.route ?? 'No route'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-0.5">Order</p>
                <p className="font-mono font-semibold text-slate-700">{unloadResult.box.order}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-0.5">Sequence</p>
                <p className="font-semibold text-slate-700">{unloadResult.box.box_sequence} <span className="text-slate-400 font-normal">of {unloadResult.order_total_boxes}</span></p>
              </div>
            </div>
            {unloadResult.box.order_address && (
              <p className="text-xs text-slate-400 mt-3">📍 {unloadResult.box.order_address}</p>
            )}
            {unloadResult.siblings.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-800 mb-1">
                  {unloadResult.siblings.length} sibling box(es) for this order
                </p>
                {unloadResult.siblings.map(s => (
                  <div key={s.tracking_number} className="flex justify-between text-xs mt-1">
                    <span className="font-mono text-amber-700">{s.tracking_number}</span>
                    <span className={`font-semibold ${s.status === 'Stored' ? 'text-green-600' : s.status === 'Unloaded' ? 'text-orange-600' : 'text-slate-500'}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleStore} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shelf Location Barcode</label>
              <input
                type="text" value={locationInput} onChange={e => setLocationInput(e.target.value)}
                placeholder="e.g. Z-A-R01-S3" autoFocus required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-slate-400 mt-1">Scan the shelf barcode to confirm placement</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={reset} className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm hover:bg-slate-50">
                ← Back
              </button>
              <button type="submit" disabled={loading}
                className="flex-2 flex-grow bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Confirming…' : 'Confirm Placement ↵'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Done */}
      {step === 'stored' && storeResult && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-green-800 font-bold text-base">✓ Stored successfully</p>
            <p className="font-mono text-sm text-green-700 mt-1">
              {storeResult.box.tracking_number} → <span className="font-bold">{storeResult.box.location_label}</span>
            </p>
          </div>

          {storeResult.suggested_sibling_locations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-blue-800 mb-2">
                Suggested adjacent shelves for sibling boxes:
              </p>
              <div className="flex flex-wrap gap-2">
                {storeResult.suggested_sibling_locations.map(loc => (
                  <span key={loc} className="font-mono text-xs bg-blue-100 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-200">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-900">
            Scan Next Box →
          </button>
        </div>
      )}
    </div>
  );
}
