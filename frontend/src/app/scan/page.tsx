'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { ScanUnloadResponse, ScanStoreResponse } from '@/types';

type Step = 'idle' | 'unloaded' | 'stored';

export default function ScanPage() {
  const [step, setStep] = useState<Step>('idle');
  const [trackingInput, setTrackingInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [unloadResult, setUnloadResult] = useState<ScanUnloadResponse | null>(null);
  const [storeResult, setStoreResult] = useState<ScanStoreResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUnload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.scanUnload(trackingInput.trim());
      setUnloadResult(result);
      setStep('unloaded');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStore(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Using a placeholder staff ID for prototype; real app would use session
      const result = await api.scanStore(
        unloadResult!.box.tracking_number,
        locationInput.trim(),
        '00000000-0000-0000-0000-000000000000'
      );
      setStoreResult(result);
      setStep('stored');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('idle');
    setTrackingInput('');
    setLocationInput('');
    setUnloadResult(null);
    setStoreResult(null);
    setError('');
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Scan Workflow</h1>
      <p className="text-sm text-gray-500 mb-6">Two-step poka-yoke: scan parcel, then scan shelf.</p>

      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {(['idle', 'unloaded', 'stored'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-blue-600 text-white' :
              (['idle', 'unloaded', 'stored'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i + 1}
            </div>
            <span className="text-sm text-gray-600">
              {s === 'idle' ? 'Scan Box' : s === 'unloaded' ? 'Scan Shelf' : 'Done'}
            </span>
            {i < 2 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Scan box barcode */}
      {step === 'idle' && (
        <form onSubmit={handleUnload} className="bg-white rounded-xl shadow p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Box Tracking Number</span>
            <input
              type="text"
              value={trackingInput}
              onChange={e => setTrackingInput(e.target.value)}
              placeholder="Scan or type tracking number"
              autoFocus
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Confirm Unload'}
          </button>
        </form>
      )}

      {/* Step 2: Scan shelf */}
      {step === 'unloaded' && unloadResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Box Unloaded</p>
            <p className="font-mono font-bold text-gray-900">{unloadResult.box.tracking_number}</p>
            <p className="text-sm text-gray-600 mt-1">
              Order <span className="font-mono">{unloadResult.box.order}</span>
              {' — '}{unloadResult.box.box_sequence} of {unloadResult.order_total_boxes} boxes
            </p>
            {unloadResult.siblings.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-medium text-amber-800">
                  {unloadResult.siblings.length} sibling box(es) for this order:
                </p>
                {unloadResult.siblings.map(s => (
                  <p key={s.tracking_number} className="text-xs font-mono text-amber-700 mt-1">
                    {s.tracking_number} — {s.status}
                  </p>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleStore} className="bg-white rounded-xl shadow p-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Scan Shelf Barcode</span>
              <input
                type="text"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="e.g. Z-A-R04-S2"
                autoFocus
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Placement'}
            </button>
          </form>
        </div>
      )}

      {/* Done */}
      {step === 'stored' && storeResult && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-green-800 font-semibold">Stored successfully</p>
            <p className="font-mono text-sm text-green-700 mt-1">
              {storeResult.box.tracking_number} → {storeResult.box.location}
            </p>
          </div>

          {storeResult.suggested_sibling_locations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-sm font-medium text-blue-800 mb-2">
                Suggested adjacent shelves for sibling boxes:
              </p>
              <div className="flex flex-wrap gap-2">
                {storeResult.suggested_sibling_locations.map(loc => (
                  <span key={loc} className="font-mono text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900"
          >
            Scan Next Box
          </button>
        </div>
      )}
    </div>
  );
}
