/**
 * Applies tenant branding: primary/accent CSS variables and dark mode.
 * Colors are expected as HSL triples "H S% L%" to align with shadcn tokens.
 */
export function applyTenantTheme(t: {
  theme_primary?: string | null;
  theme_accent?: string | null;
  theme_mode?: string | null;
} | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const wrap = (v: string) => {
    const s = v.trim();
    if (!s) return "";
    // Accept raw HSL triples ("142 71% 45%"), hsl(...), oklch(...), hex, rgb(...), var(...)
    if (/^(hsl|hsla|oklch|rgb|rgba|var)\(/i.test(s) || s.startsWith("#")) return s;
    return `hsl(${s})`;
  };

  const primary = t?.theme_primary ? wrap(t.theme_primary) : "";
  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
  }

  const accent = t?.theme_accent ? wrap(t.theme_accent) : "";
  if (accent) root.style.setProperty("--accent", accent);
  else root.style.removeProperty("--accent");

  const mode = t?.theme_mode ?? "system";
  const isDark = mode === "dark"
    || (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}
