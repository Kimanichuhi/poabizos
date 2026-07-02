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
    // Tint the sidebar with the tenant's primary color
    root.style.setProperty("--sidebar", `color-mix(in oklab, ${primary} 82%, oklch(0.18 0.02 245))`);
    root.style.setProperty("--sidebar-foreground", "oklch(0.98 0 0)");
    root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${primary} 55%, oklch(0.25 0.02 245))`);
    root.style.setProperty("--sidebar-accent-foreground", "oklch(0.99 0 0)");
    root.style.setProperty("--sidebar-border", `color-mix(in oklab, ${primary} 40%, oklch(0.3 0.02 245))`);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", "oklch(0.99 0 0)");
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar");
    root.style.removeProperty("--sidebar-foreground");
    root.style.removeProperty("--sidebar-accent");
    root.style.removeProperty("--sidebar-accent-foreground");
    root.style.removeProperty("--sidebar-border");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-primary-foreground");
  }

  const accent = t?.theme_accent ? wrap(t.theme_accent) : "";
  if (accent) root.style.setProperty("--accent", accent);
  else root.style.removeProperty("--accent");


  const mode = t?.theme_mode ?? "system";
  const isDark = mode === "dark"
    || (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}
