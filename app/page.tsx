'use client';

import { useState } from 'react';

// ─── Types (mirrors server response) ─────────────────────────────────────────

interface Location {
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

interface Leg {
  from: Location;
  to: Location;
  appleUrl: string;
}

interface PlaceResult {
  type: 'place';
  location: Location;
  appleUrl: string;
}

interface DirectionsResult {
  type: 'directions';
  stops: Location[];
  appleUrl: string;
  legs: Leg[];
  isMultiStop: boolean;
}

type ConvertResult = PlaceResult | DirectionsResult;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleConvert() {
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error ?? 'Something went wrong');
      } else {
        setResult(data as ConvertResult);
      }
    } catch {
      setApiError('Network error — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
    } catch {
      // clipboard access denied in some browsers — silently ignore
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-20 px-4 pb-16">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Google Maps → Apple Maps
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Paste any Google Maps link — locations or multi-stop directions — and get the Apple Maps equivalent.
          </p>
        </div>

        {/* Input card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
              placeholder="https://maps.app.goo.gl/…"
              aria-label="Google Maps link"
              className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
            />
            <button
              onClick={handlePaste}
              className="shrink-0 text-sm px-3 py-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
              title="Paste from clipboard"
            >
              Paste
            </button>
          </div>

          <button
            onClick={handleConvert}
            disabled={loading || !url.trim()}
            className="mt-3 w-full text-sm bg-blue-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Converting…' : 'Convert to Apple Maps'}
          </button>
        </div>

        {/* Error */}
        {apiError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        {/* Result */}
        {result && <ResultCard result={result} />}

        {/* Footer */}
        <p className="mt-10 text-center text-xs text-gray-400">
          Open source &middot;{' '}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            GitHub
          </a>
        </p>
      </div>
    </main>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: ConvertResult }) {
  if (result.type === 'place') {
    return (
      <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Location</p>
        <p className="font-medium text-gray-900">{result.location.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{result.location.formattedAddress}</p>
        <p className="mt-1 text-xs text-gray-400 font-mono">
          {result.location.lat.toFixed(6)}, {result.location.lng.toFixed(6)}
        </p>
        <div className="mt-4 flex gap-2">
          <a
            href={result.appleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm bg-gray-900 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-gray-700 transition-colors"
          >
            Open in Apple Maps ↗
          </a>
          <CopyButton value={result.appleUrl} />
        </div>
      </div>
    );
  }

  if (result.type === 'directions') {
    return (
      <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          Directions &middot; {result.stops.length} stops
        </p>

        {/* Stop list */}
        <ol className="space-y-3">
          {result.stops.map((stop, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-semibold">
                {stopLabel(i, result.stops.length)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{stop.name}</p>
                <p className="text-xs text-gray-400 truncate">{stop.formattedAddress}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Main CTA */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
          <a
            href={result.appleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm bg-gray-900 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-gray-700 transition-colors"
          >
            Get Directions in Apple Maps ↗
          </a>
          <CopyButton value={result.appleUrl} />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently ignore
    }
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-500 hover:bg-gray-50 transition-colors"
      title="Copy Apple Maps link"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

function stopLabel(index: number, total: number): string {
  if (total <= 26) return String.fromCharCode(65 + index); // A, B, C…
  return String(index + 1);
}
