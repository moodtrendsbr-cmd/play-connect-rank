import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
  className?: string;
}

/** Renders a QR code as a canvas. Pure client-side, no data leaves the browser. */
export const QRGenerator = ({ value, size = 240, className }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#050708", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).catch(() => {});
  }, [value, size]);

  return <canvas ref={canvasRef} className={className} aria-label="QR code" />;
};

/** Returns a PNG data URL of the QR. Useful for download buttons. */
export async function qrToDataUrl(value: string, size = 600): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 2,
    color: { dark: "#050708", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}
