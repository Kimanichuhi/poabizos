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

  if (t?.theme_primary) root.style.setProperty("--primary", t.theme_primary);
  else root.style.removeProperty("--primary");

  if (t?.theme_accent) root.style.setProperty("--accent", t.theme_accent);
  else root.style.removeProperty("--accent");

  const mode = t?.theme_mode ?? "system";
  const isDark = mode === "dark"
    || (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}
