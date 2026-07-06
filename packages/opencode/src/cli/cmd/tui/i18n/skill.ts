export function skillDescription(
  t: (key: string) => string,
  name: string,
  fallback?: string,
  location?: string,
) {
  if (!name.startsWith("compose:") && !location?.includes("/builtin_skills/")) return fallback
  const translated = t(`tui.skill.${name}.description`)
  return translated || fallback
}
