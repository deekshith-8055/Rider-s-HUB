import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff } from 'lucide-react';
import { Modal } from '../ui/Overlays';

/**
 * Live camera QR scanner. Uses getUserMedia + jsQR so it works on every
 * browser (Chrome, Safari/iOS, Firefox) — not just those with BarcodeDetector.
 * Camera access needs HTTPS or localhost.
 */
export function QrScannerModal({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    setError(null);

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (cancelled || !video || !canvas) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (hit?.data) {
            onResultRef.current(hit.data);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera scanning needs a secure (HTTPS) connection and a supported browser.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        raf = requestAnimationFrame(tick);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or type the Ride ID instead.'
            : "Couldn't open the camera. Type the Ride ID instead."
        );
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Scan ride QR">
      {error ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <CameraOff size={28} className="text-signal-amber" />
          <p className="text-sm text-asphalt-300">{error}</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-8 border-2 border-gps-400/80 rounded-2xl pointer-events-none" />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-xs text-asphalt-400 text-center mt-3">Point the camera at the QR code on the leader's screen.</p>
    </Modal>
  );
}
