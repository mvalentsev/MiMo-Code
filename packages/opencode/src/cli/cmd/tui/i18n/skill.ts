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
  "compose:ask",
  "compose:brainstorm",
  "compose:debug",
  "compose:execute",
  "compose:feedback",
  "compose:merge",
  "compose:parallel",
  "compose:plan",
  "compose:report",
  "compose:review",
  "compose:subagent",
  "compose:tdd",
  "compose:verify",
  "compose:worktree",
])

export function skillDescription(
  t: (key: string) => string,
  name: string,
  fallback?: string,
  location?: string,
) {
  if (!BUILTIN.has(name)) return fallback
  if (location && !location.includes("/builtin_skills/") && !location.includes("/mimocode/compose/")) return fallback
  const translated = t(`tui.skill.${name}.description`)
  return translated || fallback
}
