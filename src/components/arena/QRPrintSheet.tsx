import { useEffect } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  title: string;
  subtitle?: string;
  arenaName?: string;
}

/** Opens a print dialog with an A4 sheet containing the QR centered. */
export async function printQRSheet({ value, title, subtitle, arenaName }: Props) {
  const dataUrl = await QRCode.toDataURL(value, {
    width: 800,
    margin: 2,
    color: { dark: "#050708", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!doctype html>
<html><head><title>${title}</title>
<style>
  @page { size: A4; margin: 24mm; }
  body { font-family: Inter, system-ui, sans-serif; color: #050708; text-align: center; }
  .arena { font-size: 14px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.6; margin-bottom: 12px; }
  .title { font-size: 32px; font-weight: 700; margin: 0 0 8px; }
  .subtitle { font-size: 16px; opacity: 0.7; margin: 0 0 32px; }
  img { width: 380px; height: 380px; }
  .footer { margin-top: 32px; font-size: 13px; opacity: 0.6; }
</style></head>
<body>
  ${arenaName ? `<div class="arena">${arenaName}</div>` : ""}
  <h1 class="title">${title}</h1>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
  <img src="${dataUrl}" alt="QR" />
  <p class="footer">Escaneie com a câmera do celular</p>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`);
  w.document.close();
}

/** Inline preview component (not used for printing). */
export const QRPrintPreview = ({ value, title, arenaName }: Props) => {
  useEffect(() => {}, [value]);
  return (
    <div className="bg-white text-[#050708] rounded-lg p-6 text-center max-w-sm mx-auto">
      {arenaName && <div className="text-xs uppercase tracking-widest opacity-60 mb-2">{arenaName}</div>}
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-xs opacity-60">Escaneie com a câmera</p>
    </div>
  );
};
