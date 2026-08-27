export const ALL_PROMPT_CATEGORIES_LABEL = "Semua";

export const PROMPT_CATEGORY_META = [
  {
    slug: "newsroom",
    label: "Newsroom",
    color: "#d6a93a",
    icon: "newspaper",
  },
  { slug: "osint", label: "OSINT", color: "#7dd3fc", icon: "radar" },
  {
    slug: "engineering",
    label: "Engineering",
    color: "#94a3b8",
    icon: "code",
  },
  { slug: "security", label: "Security", color: "#991b1b", icon: "shield" },
  { slug: "product", label: "Product", color: "#a78bfa", icon: "box" },
  { slug: "audit", label: "Audit", color: "#fb7185", icon: "scan" },
  { slug: "codex", label: "Codex", color: "#22d3ee", icon: "terminal" },
  { slug: "backend", label: "Backend", color: "#38bdf8", icon: "server" },
  { slug: "frontend", label: "Frontend", color: "#f472b6", icon: "layout" },
  { slug: "database", label: "Database", color: "#2dd4bf", icon: "database" },
  { slug: "supabase", label: "Supabase", color: "#34d399", icon: "bolt" },
  {
    slug: "automation",
    label: "Automation",
    color: "#f59e0b",
    icon: "workflow",
  },
  {
    slug: "monitoring",
    label: "Monitoring",
    color: "#60a5fa",
    icon: "activity",
  },
  { slug: "reports", label: "Reports", color: "#c084fc", icon: "file" },
  { slug: "ai", label: "AI", color: "#06b6d4", icon: "sparkles" },
  { slug: "devops", label: "DevOps", color: "#f97316", icon: "rocket" },
];

export const PROMPT_CATEGORIES = PROMPT_CATEGORY_META.map(
  (category) => category.slug,
);

export function normalizePromptCategory(value, fallback = "newsroom") {
  if (typeof value !== "string") return fallback;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function getPromptCategoryMeta(category) {
  const slug =
    typeof category === "object"
      ? normalizePromptCategory(category?.slug, "")
      : normalizePromptCategory(category, "");
  const fallback = PROMPT_CATEGORY_META.find((item) => item.slug === slug) || {
    slug,
    label: slug || "Prompt",
    color: "#64748b",
    icon: "tag",
  };

  if (!category || typeof category !== "object") return fallback;

  return {
    slug: slug || fallback.slug,
    label: String(category.label || fallback.label),
    color: /^#[0-9a-f]{6}$/i.test(category.color || "")
      ? category.color
      : fallback.color,
    icon: String(category.icon || fallback.icon),
  };
}

export function buildPromptCategoryOptions(categories = []) {
  const categoriesBySlug = new Map(
    PROMPT_CATEGORY_META.map((category) => [category.slug, category]),
  );

  categories
    .map(getPromptCategoryMeta)
    .filter((category) => category.slug)
    .forEach((category) => {
      if (!categoriesBySlug.has(category.slug)) {
        categoriesBySlug.set(category.slug, category);
      }
    });

  return [
    { slug: ALL_PROMPT_CATEGORIES_LABEL, label: ALL_PROMPT_CATEGORIES_LABEL },
    ...Array.from(categoriesBySlug.values()),
  ];
}
