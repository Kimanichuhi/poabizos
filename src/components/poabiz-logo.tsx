import logoAsset from "@/assets/poabiz-logo.png.asset.json";

export const LOGO_URL = logoAsset.url;

export function PoaBizLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="PoaBiz OS"
      className={`${className} rounded-md object-contain bg-white p-0.5 shadow-sm shrink-0`}
    />
  );
}
