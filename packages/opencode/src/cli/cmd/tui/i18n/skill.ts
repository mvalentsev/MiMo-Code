const BUILTIN = new Set([
  "docx-official",
  "xlsx-official",
  "pdf-official",
  "pptx-official",
  "mimocode",
  "evolve",
  "frontend-design",
  "loop",
  "html-to-video-pipeline",
  "arxiv",
  "skill-creator",
  "research-paper-writing",
  "design-blueprint",
  "auto-research",
  "deep-research",
  "modern-python-toolchain",
])

export function skillDescription(
  t: (key: string) => string,
  name: string,
  fallback?: string,
  location?: string,
) {
  if (!BUILTIN.has(name)) return fallback
  if (location && !location.includes("/builtin_skills/")) return fallback
  const translated = t(`tui.skill.${name}.description`)
  return translated || fallback
}
