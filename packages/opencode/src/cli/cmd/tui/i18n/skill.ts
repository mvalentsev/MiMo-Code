export function skillDescription(
  t: (key: string) => string,
  name: string,
  fallback?: string,
  bundled?: boolean,
) {
  if (!bundled) return fallback
  const translated = t(`tui.skill.${name}.description`)
  return translated || fallback
}
