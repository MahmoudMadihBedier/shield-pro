import React, { useEffect, useRef, useState } from 'react';
import type { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, X, ScanLine } from 'lucide-react';

export interface ScannableItem {
  id: string;
  name: string;
  barcode?: string | null;
  carton_barcode?: string | null;
  carton_pack_size?: number | null;
}

interface BarcodeScanInputProps {
  items: ScannableItem[];
  onResolved: (item: ScannableItem, qty: number) => void;
  onNotFound?: (code: string) => void;
}

/**
 * Resolves a scanned/typed code against an item's unit barcode (qty 1)
 * or carton barcode (qty = carton_pack_size), so a carton scan auto-adds
 * the full pack quantity the same way a manual line entry would.
 */
export function resolveBarcode(items: ScannableItem[], code: string): { item: ScannableItem; qty: number } | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const cartonMatch = items.find((i) => i.carton_barcode && i.carton_barcode === trimmed);
  if (cartonMatch) {
    return { item: cartonMatch, qty: Number(cartonMatch.carton_pack_size) || 1 };
  }

  const unitMatch = items.find((i) => i.barcode && i.barcode === trimmed);
  if (unitMatch) {
    return { item: unitMatch, qty: 1 };
  }

  return null;
}

export const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({ items, onResolved, onNotFound }) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const handleCode = (code: string) => {
    const resolved = resolveBarcode(items, code);
    if (resolved) {
      onResolved(resolved.item, resolved.qty);
    } else if (onNotFound) {
      onNotFound(code);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCode(manualCode);
    setManualCode('');
  };

  useEffect(() => {
    if (!cameraOpen) return;

    setCameraError('');
    let cancelled = false;

    // Loaded on demand so the (fairly large) barcode-decoding library only
    // ships to the browser when the camera scanner is actually opened.
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      reader
        .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, err) => {
          if (cancelled) return;
          if (result) {
            handleCode(result.getText());
            setCameraOpen(false);
          } else if (err && err.name !== 'NotFoundException') {
            // Transient per-frame decode misses are expected and ignored;
            // only surface real device/permission errors.
          }
        })
        .catch((err: any) => {
          if (!cancelled) {
            setCameraError(
              err?.name === 'NotAllowedError'
                ? 'تم رفض إذن الوصول للكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.'
                : 'تعذر تشغيل الكاميرا على هذا الجهاز.'
            );
          }
        });
    });

    return () => {
      cancelled = true;
      try {
        (readerRef.current as any)?.reset?.();
      } catch {
        // no active stream to release
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  return (
    <div className="flex items-center gap-2">
      <form onSubmit={handleManualSubmit} className="flex-1 flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="امسح الباركود بالجهاز أو أدخله يدوياً ثم Enter"
            className="w-full rounded border border-gray-300 py-2 pr-9 pl-3 text-sm font-mono focus:outline-none focus:ring-blue-500 text-left"
            autoComplete="off"
          />
        </div>
      </form>
      <button
        type="button"
        onClick={() => setCameraOpen(true)}
        className="flex items-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
      >
        <Camera className="h-4 w-4" />
        <span>مسح بالكاميرا</span>
      </button>

      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-md">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-gray-800">وجّه الكاميرا نحو الباركود</h4>
              <button type="button" onClick={() => setCameraOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {cameraError ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{cameraError}</div>
            ) : (
              <video ref={videoRef} className="w-full rounded bg-black aspect-video" muted playsInline />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
