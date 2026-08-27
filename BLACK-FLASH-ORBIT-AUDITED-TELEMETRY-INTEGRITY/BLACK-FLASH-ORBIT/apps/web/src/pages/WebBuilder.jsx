import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  FileCode2,
  Globe2,
  Layers3,
  Loader2,
  Image as ImageIcon,
  Plus,
  GripVertical,
  RefreshCcw,
  Rocket,
  Trash2,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { UserMenu } from "../components/auth/UserMenu.jsx";
import { CommandCenterSidebar } from "../components/CommandCenterSidebar.jsx";
import { useProfile } from "../hooks/useProfile.js";
import { api } from "../services/api.js";

const releaseState = [
  { label: "Module", value: "web-builder", tone: "text-amber-300" },
  { label: "API", value: "v1", tone: "text-white" },
  { label: "Auth", value: "required", tone: "text-emerald-300" },
];

const emptyProjectForm = {
  description: "",
  slug: "",
  title: "",
};

const emptyPageForm = {
  path: "/",
  title: "",
};

const AUTO_REFRESH_MS = 30000;
const SECTION_AUTOSAVE_DELAY_MS = 700;
const SECTION_HISTORY_LIMIT = 60;

async function loadJSZip() {
  const mod = await import("jszip");
  return mod.default || mod;
}

const autosaveStatusConfig = {
  failed: { label: "Save failed", tone: "red" },
  saved: { label: "Saved", tone: "green" },
  saving: { label: "Saving...", tone: "amber" },
  unsaved: { label: "Unsaved changes", tone: "amber" },
};
const defaultWebTheme = {
  accent: "#7f1d1d",
  background: "#050506",
  primary: "#f5c14b",
  radius: 18,
  spacing: 24,
  text: "#f4f4f5",
};
const previewViewports = {
  desktop: {
    frameWidth: "100%",
    icon: Monitor,
    label: "Desktop",
    sizeLabel: "Full width",
  },
  tablet: {
    frameWidth: "min(100%, 768px)",
    icon: Tablet,
    label: "Tablet",
    sizeLabel: "768px",
  },
  mobile: {
    frameWidth: "min(100%, 390px)",
    icon: Smartphone,
    label: "Mobile",
    sizeLabel: "390px",
  },
};

const componentLibrary = [
  {
    id: "hero",
    label: "Hero",
    type: "hero",
    summary: "Lead visual untuk headline utama dan ringkasan editorial.",
    props: {
      label: "Papua Selatan Today",
      title: "Newsroom intelligence for regional multimedia coverage",
      body: "Dashboard publikasi untuk berita cepat, visual lapangan, dan arsip editorial.",
      actionLabel: "Baca laporan utama",
    },
  },
  {
    id: "navbar",
    label: "Navbar",
    type: "text",
    summary: "Navigasi brand dan kanal utama media.",
    props: {
      label: "ORBIT News",
      title: "BLACK FLASH ORBIT",
      body: "Beranda / Berita / Multimedia / Arsip",
    },
  },
  {
    id: "footer",
    label: "Footer",
    type: "text",
    summary: "Penutup situs dengan identitas redaksi dan kanal kontak.",
    props: {
      label: "Footer",
      title: "BLACK FLASH ORBIT",
      body: "Editorial desk, multimedia archive, and secure newsroom operations.",
    },
  },
  {
    id: "card",
    label: "Card",
    type: "feature-grid",
    summary: "Kartu modular untuk highlight data, program, atau layanan.",
    props: {
      label: "Highlights",
      title: "Editorial command cards",
      body: "Ringkasan modul siap pakai untuk project newsroom.",
      items: ["Breaking Desk", "Fact Check", "Media Archive"],
    },
  },
  {
    id: "gallery",
    label: "Gallery",
    type: "gallery",
    summary: "Grid visual untuk foto lapangan dan aset multimedia.",
    props: {
      label: "Gallery",
      title: "Field visuals",
      body: "Kurasi foto, video still, dan dokumentasi lapangan.",
      items: ["Jayapura Desk", "Merauke Field", "Asmat Archive"],
    },
  },
  {
    id: "news-grid",
    label: "News Grid",
    type: "article-list",
    summary: "Grid artikel untuk headline, ringkasan, dan kanal berita.",
    props: {
      label: "Latest News",
      title: "Top newsroom updates",
      body: "Daftar berita utama untuk halaman depan.",
      items: [
        "Agenda pemerintahan daerah",
        "Kabar ekonomi masyarakat",
        "Liputan multimedia lapangan",
      ],
    },
  },
  {
    id: "cta",
    label: "CTA",
    type: "cta",
    summary: "Ajakan aksi untuk langganan, kontak redaksi, atau arsip.",
    props: {
      label: "CTA",
      title: "Siapkan paket publikasi berikutnya",
      body: "Kirim draft, aset visual, dan metadata agar editor dapat meninjau paket berita.",
      actionLabel: "Mulai kurasi",
    },
  },
];

const defaultComponentIds = componentLibrary.map((component) => component.id);
const componentIdSet = new Set(defaultComponentIds);
const imageSectionTypes = new Set(["hero", "gallery", "feature-grid"]);
const webBuilderTemplates = [
  {
    id: "news-portal",
    label: "News Portal",
    pages: [
      buildTemplatePage("Home", "/", ["navbar", "hero", "news-grid", "gallery", "cta", "footer"], {
        hero: {
          props: {
            title: "Breaking news for regional coverage",
            body: "Live updates, field reports, and editorial highlights for a modern newsroom.",
          },
        },
        "news-grid": {
          props: {
            title: "Top stories",
            body: "Curated headlines and newsroom updates across the latest coverage.",
          },
        },
      }),
      buildTemplatePage("Berita", "/berita", ["navbar", "news-grid", "cta", "footer"], {
        "news-grid": {
          props: {
            title: "Berita terbaru",
            body: "Sajikan paket berita utama dengan daftar artikel yang rapi.",
          },
        },
      }),
      buildTemplatePage("Profil", "/profil", ["navbar", "hero", "card", "footer"], {
        hero: {
          props: {
            title: "Newsroom profile",
            body: "Profil redaksi, kanal, dan alur kerja multimedia.",
          },
        },
      }),
    ],
    theme: {
      accent: "#7f1d1d",
      background: "#050506",
      primary: "#f5c14b",
      radius: 18,
      spacing: 24,
      text: "#f4f4f5",
    },
  },
  {
    id: "company-profile",
    label: "Company Profile",
    pages: [
      buildTemplatePage("Home", "/", ["navbar", "hero", "card", "gallery", "cta", "footer"], {
        hero: {
          props: {
            title: "Company profile for a modern media brand",
            body: "Build trust with a clean narrative, service blocks, and visual proof.",
          },
        },
      }),
      buildTemplatePage("Profil", "/profil", ["navbar", "hero", "card", "footer"], {
        hero: {
          props: {
            title: "About the company",
            body: "Introduce the team, mission, and operating principles.",
          },
        },
      }),
      buildTemplatePage("Tim", "/tim", ["navbar", "card", "footer"], {
        card: {
          props: {
            title: "Leadership team",
            body: "Key roles and responsibilities across the organization.",
          },
        },
      }),
    ],
    theme: {
      accent: "#4c1d95",
      background: "#08070c",
      primary: "#c4b5fd",
      radius: 20,
      spacing: 26,
      text: "#f5f3ff",
    },
  },
  {
    id: "landing-page",
    label: "Landing Page",
    pages: [
      buildTemplatePage("Home", "/", ["navbar", "hero", "card", "cta", "footer"], {
        hero: {
          props: {
            title: "Launch-ready landing page",
            body: "Drive one clear action with a focused hero, features, and CTA.",
          },
        },
        card: {
          props: {
            title: "Key benefits",
            body: "Show the strongest reasons to act now.",
          },
        },
      }),
      buildTemplatePage("Contact", "/contact", ["navbar", "cta", "footer"], {
        cta: {
          props: {
            title: "Talk to the team",
            body: "Route attention toward a single conversion action.",
          },
        },
      }),
    ],
    theme: {
      accent: "#9f1239",
      background: "#060406",
      primary: "#fb7185",
      radius: 22,
      spacing: 22,
      text: "#fff1f2",
    },
  },
];

function getResponseData(response, fallback = null) {
  return response?.data ?? response ?? fallback;
}

function getErrorMessage(error, fallback = "Request Web Builder gagal.") {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeSlugInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validateProjectForm(form) {
  const title = form.title.trim();
  const slug = form.slug.trim();

  if (!title) return "Title project wajib diisi.";
  if (title.length > 160) return "Title project maksimal 160 karakter.";
  if (form.description.length > 800) {
    return "Description project maksimal 800 karakter.";
  }
  if (slug && !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    return "Slug hanya boleh huruf kecil, angka, dan tanda hubung.";
  }

  return "";
}

function validatePageForm(form) {
  const title = form.title.trim();
  const path = form.path.trim();

  if (!title) return "Title halaman wajib diisi.";
  if (title.length > 160) return "Title halaman maksimal 160 karakter.";
  if (path.length > 120) return "Path halaman maksimal 120 karakter.";
  if (path !== "/" && !/^\/?[a-z0-9][a-z0-9/_-]*$/.test(path)) {
    return "Path halaman hanya boleh huruf kecil, angka, garis miring, underscore, dan tanda hubung.";
  }

  return "";
}

function createProjectPayload(form) {
  const payload = {
    title: form.title.trim(),
  };
  const description = form.description.trim();
  const slug = normalizeSlugInput(form.slug);

  if (description) payload.description = description;
  if (slug) payload.slug = slug;

  return payload;
}

function getSelectedComponents(componentIds = defaultComponentIds) {
  const selectedIds = componentIds.filter((componentId) =>
    componentIdSet.has(componentId),
  );
  const activeIds = selectedIds.length ? selectedIds : defaultComponentIds;

  return activeIds
    .map((componentId) =>
      componentLibrary.find((component) => component.id === componentId),
    )
    .filter(Boolean);
}

function createComponentSection(component, index) {
  return {
    id: `${component.id}-${index + 1}`,
    type: component.type,
    props: { ...component.props },
    styles: {
      component: component.id,
    },
  };
}

function buildComponentSections(componentIds = defaultComponentIds) {
  return getSelectedComponents(componentIds).map(createComponentSection);
}

function buildTemplateSections(componentIds, overrides = {}) {
  return buildComponentSections(componentIds).map((section) => {
    const componentId = section.styles?.component || section.type;
    const override = overrides[componentId] || {};

    return {
      ...section,
      props: {
        ...section.props,
        ...(override.props || {}),
      },
      styles: {
        ...section.styles,
        ...(override.styles || {}),
      },
    };
  });
}

function buildTemplatePage(title, path, componentIds, overrides = {}) {
  return {
    path,
    sections: buildTemplateSections(componentIds, overrides),
    sortOrder: 0,
    title,
  };
}

function createDraftSection(componentId) {
  const component = componentLibrary.find((item) => item.id === componentId);

  if (!component) return null;

  return {
    ...createComponentSection(component, 0),
    id: `${component.id}-${Date.now().toString(36)}`,
  };
}

function cloneSectionForPayload(section, index) {
  return {
    id: section.id || `section-${index + 1}`,
    type: section.type,
    props: { ...(section.props || {}) },
    styles: { ...(section.styles || {}) },
  };
}

function cloneSectionsForDraft(sections) {
  if (!Array.isArray(sections) || !sections.length) return [];

  return sections.map((section, index) => cloneSectionForPayload(section, index));
}

function getSectionComponentIds(sections) {
  return sections
    .map((section) => section?.styles?.component)
    .filter((componentId) => componentIdSet.has(componentId));
}

function getSectionsSignature(sections) {
  try {
    return JSON.stringify(cloneSectionsForDraft(sections));
  } catch {
    return "[]";
  }
}

function getAutosaveStatusConfig(status) {
  return autosaveStatusConfig[status] || autosaveStatusConfig.saved;
}

function limitSectionHistory(items) {
  return items.slice(-SECTION_HISTORY_LIMIT);
}

function normalizeThemeHex(value, fallback) {
  const cleanValue = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(cleanValue) ? cleanValue : fallback;
}

function hexToRgb(hex) {
  const cleanHex = normalizeThemeHex(hex, defaultWebTheme.primary).slice(1);
  const value = Number.parseInt(cleanHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToRgba(value, alpha) {
  return `rgba(${value.r}, ${value.g}, ${value.b}, ${alpha})`;
}

function normalizeThemeNumber(value, fallback, { min, max }) {
  const nextValue = Number(value);

  if (!Number.isFinite(nextValue)) return fallback;
  return Math.min(max, Math.max(min, nextValue));
}

function normalizeWebTheme(theme = {}) {
  return {
    accent: normalizeThemeHex(theme.accent, defaultWebTheme.accent),
    background: normalizeThemeHex(theme.background, defaultWebTheme.background),
    primary: normalizeThemeHex(theme.primary, defaultWebTheme.primary),
    radius: normalizeThemeNumber(theme.radius, defaultWebTheme.radius, {
      min: 8,
      max: 28,
    }),
    spacing: normalizeThemeNumber(theme.spacing, defaultWebTheme.spacing, {
      min: 12,
      max: 40,
    }),
    text: normalizeThemeHex(theme.text, defaultWebTheme.text),
  };
}

function themeToCssVariables(theme) {
  const nextTheme = normalizeWebTheme(theme);
  const primaryRgb = hexToRgb(nextTheme.primary);
  const accentRgb = hexToRgb(nextTheme.accent);

  return {
    "--orbit-accent": nextTheme.primary,
    "--orbit-accent-strong": nextTheme.accent,
    "--orbit-accent-rgb": `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`,
    "--orbit-accent-strong-rgb": `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    "--orbit-bg": nextTheme.background,
    "--orbit-card-radius": `${nextTheme.radius}px`,
    "--orbit-page-spacing": `${nextTheme.spacing}px`,
    "--orbit-text": nextTheme.text,
  };
}

function syncPageSections(pages, pageId, sections) {
  const nextSections = cloneSectionsForDraft(sections);

  return pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          metadata: {
            ...(page.metadata || {}),
            componentLibrary: getSectionComponentIds(nextSections),
          },
          sections: nextSections,
        }
      : page,
  );
}

function createPageSectionsPatch(page, sections) {
  const nextSections = cloneSectionsForDraft(sections);

  return {
    metadata: {
      ...(page?.metadata || {}),
      componentLibrary: getSectionComponentIds(nextSections),
    },
    sections: nextSections,
  };
}

function createPagePayload(form, sections = buildComponentSections()) {
  const path = form.path.trim() || "/";
  const activeSections = Array.isArray(sections) ? sections : [];

  return {
    metadata: {
      componentLibrary: getSectionComponentIds(activeSections),
    },
    path: path.startsWith("/") ? path : `/${path}`,
    sections: activeSections.map(cloneSectionForPayload),
    title: form.title.trim(),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeExportFilename(pagePath) {
  const cleanPath = String(pagePath || "").trim().toLowerCase();

  if (!cleanPath || cleanPath === "/" || cleanPath === "/home" || cleanPath === "home") {
    return "index.html";
  }

  const slug = cleanPath
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "index"}.html`;
}

function buildExportAllManifest({
  pages = [],
  previewMode,
  project,
  projectForm,
  theme,
  generatedAt = new Date().toISOString(),
}) {
  const exportPages = Array.isArray(pages) ? pages : [];
  const files = exportPages.map((page) => {
    const pagePath = page?.path || "/";
    const html = buildPreviewHtml({
      componentSections: Array.isArray(page?.sections) ? page.sections : [],
      generatedAt,
      page,
      previewMode,
      project,
      projectForm,
      pageForm: { path: pagePath, title: page?.title || "Home" },
      theme,
    });

    return {
      filename: normalizeExportFilename(pagePath),
      html,
      path: pagePath,
    };
  });

  return {
    files,
    generatedAt,
    projectTitle: project?.title || projectForm?.title || "Web Builder Preview",
    theme: normalizeWebTheme(theme),
  };
}

function buildThemeStyleTokens(theme = defaultWebTheme) {
  const webTheme = normalizeWebTheme(theme);
  const themeCssVars = themeToCssVariables(webTheme);
  const themeVarsCss = Object.entries(themeCssVars)
    .map(([key, value]) => `      ${key}: ${value};`)
    .join("\n");

  return {
    themeAccentGallery: rgbToRgba(hexToRgb(webTheme.accent), 0.36),
    themeAccentOverlay: rgbToRgba(hexToRgb(webTheme.primary), 0.18),
    themeAccentPanel: rgbToRgba(hexToRgb(webTheme.accent), 0.18),
    themeAccentSoftOverlay: rgbToRgba(hexToRgb(webTheme.accent), 0.14),
    themePrimaryGallery: rgbToRgba(hexToRgb(webTheme.primary), 0.32),
    themeVarsCss,
    webTheme,
  };
}

function buildWebsiteCss(theme = defaultWebTheme) {
  const {
    themeAccentGallery,
    themeAccentOverlay,
    themeAccentPanel,
    themeAccentSoftOverlay,
    themePrimaryGallery,
    themeVarsCss,
    webTheme,
  } = buildThemeStyleTokens(theme);

  return `
    :root {
      color-scheme: dark;
      --bg: ${webTheme.background};
      --bg-soft: #0a0a0b;
      --panel: rgba(255,255,255,0.04);
      --line: rgba(255,255,255,0.12);
      --text: ${webTheme.text};
      --muted: #a1a1aa;
      --accent: ${webTheme.primary};
      --accent-strong: ${webTheme.accent};
      --maroon: ${webTheme.accent};
      --radius: ${webTheme.radius}px;
      --spacing: ${webTheme.spacing}px;
${themeVarsCss}
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(217,173,87,0.18), transparent 28%),
        linear-gradient(180deg, #0a0a0b, var(--bg));
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    a { color: inherit; }
    .shell {
      width: min(100%, 1180px);
      margin: 0 auto;
      padding: var(--spacing);
    }
    .hero,
    .page-card,
    .component {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: var(--radius);
      backdrop-filter: blur(14px);
    }
    .hero {
      padding: clamp(22px, 4vw, 44px);
      background:
        linear-gradient(135deg, ${themeAccentOverlay}, ${themeAccentSoftOverlay}),
        rgba(255,255,255,0.04);
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 11px;
      font-weight: 800;
    }
    h1 {
      margin: 12px 0 10px;
      max-width: 820px;
      font-size: clamp(34px, 6vw, 72px);
      line-height: 0.98;
    }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
    .meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text);
      background: rgba(0,0,0,0.22);
    }
    .grid {
      display: grid;
      gap: 12px;
      margin-top: 16px;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }
    .page-card { padding: 14px; }
    .page-path {
      font-size: 11px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-weight: 800;
    }
    .page-card h3 {
      margin: 10px 0 6px;
      font-size: 18px;
      line-height: 1.2;
    }
    .section-title {
      margin: 18px 0 10px;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
    }
    .component {
      margin-top: 12px;
      background: rgba(255,255,255,0.035);
      padding: calc(var(--spacing) * 0.75);
    }
    .component h2 {
      margin: 8px 0 8px;
      font-size: 24px;
      line-height: 1.12;
    }
    .component span,
    .component article span,
    figcaption {
      color: var(--muted);
      line-height: 1.5;
    }
    .component-media {
      margin: 0 0 14px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) - 4px);
      background: rgba(0,0,0,0.24);
    }
    .component-media img {
      display: block;
      width: 100%;
      height: 220px;
      object-fit: cover;
    }
    .component-label,
    .component-hero p,
    .component-cta p {
      margin: 0;
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .component-nav,
    .component-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-radius: calc(var(--radius) - 2px);
      background: rgba(0,0,0,0.28);
    }
    .component-nav strong,
    .component-footer strong {
      color: var(--text);
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .component-hero,
    .component-cta {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, ${themeAccentOverlay}, ${themeAccentPanel});
    }
    .component-hero.has-media {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto;
    }
    .component-hero.has-media .component-copy {
      min-width: 0;
    }
    .component-hero.has-media .component-media {
      margin: 0;
      align-self: stretch;
    }
    .component-hero.has-media .component-media img {
      height: 100%;
      min-height: 240px;
    }
    .component-hero a,
    .component-cta a {
      border-radius: 999px;
      background: var(--accent);
      color: #080808;
      font-size: 12px;
      font-weight: 900;
      padding: 10px 14px;
      text-decoration: none;
      white-space: nowrap;
    }
    .component-gallery {
      background: linear-gradient(180deg, rgba(255,255,255,0.04), ${themeAccentPanel});
    }
    .component-gallery.has-media .component-media,
    .component-card-grid.has-media .component-media {
      margin-top: 0;
    }
    .card-grid,
    .gallery-grid,
    .news-grid {
      display: grid;
      gap: 10px;
      margin-top: 14px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .card-grid article,
    .news-grid article,
    .gallery-grid figure {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(0,0,0,0.22);
      padding: 12px;
    }
    .card-grid strong,
    .news-grid h3 {
      display: block;
      margin: 0 0 6px;
      color: var(--text);
      font-size: 15px;
    }
    .news-grid p {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .gallery-grid figure div {
      display: grid;
      min-height: 92px;
      place-items: center;
      border-radius: calc(var(--radius) - 6px);
      background: linear-gradient(135deg, ${themePrimaryGallery}, ${themeAccentGallery});
      color: var(--text);
      font-weight: 900;
    }
    .gallery-grid figcaption {
      display: block;
      margin-top: 10px;
      font-size: 13px;
    }
    .export-meta {
      margin-top: 18px;
      color: var(--muted);
      font-size: 11px;
    }
    @media (max-width: 520px) {
      .shell { padding: 14px; }
      .component-nav,
      .component-footer,
      .component-hero,
      .component-cta {
        grid-template-columns: 1fr;
        align-items: start;
      }
      .component-hero.has-media {
        grid-template-columns: 1fr;
      }
      .component-nav,
      .component-footer {
        display: grid;
      }
      .component-media img {
        height: 180px;
      }
      .component-hero a,
      .component-cta a {
        width: fit-content;
      }
    }`;
}

function buildWebsiteHtmlWithStylesheet(html, cssHref) {
  return String(html || "").replace(
    /<style>[\s\S]*?<\/style>/,
    `<link rel="stylesheet" href="${escapeHtml(cssHref)}">`,
  );
}

function getWebBuilderPublishChecklist({
  assetLibrary = [],
  draftSections = [],
  lastExportAll = null,
  lastWebsiteZipGeneratedAt = "",
  pages = [],
  templatePagesOverride = null,
  webTheme = defaultWebTheme,
}) {
  const theme = normalizeWebTheme(webTheme);
  const hasTheme =
    Boolean(theme.primary && theme.accent && theme.background && theme.text) &&
    theme.radius >= 8 &&
    theme.spacing >= 12;
  const hasTemplate = Array.isArray(templatePagesOverride)
    ? templatePagesOverride.length > 0
    : false;
  const hasPages = Array.isArray(pages) && pages.length > 0;
  const hasSections = Array.isArray(draftSections) && draftSections.length > 0;
  const hasExportAll = Boolean(lastExportAll?.files?.length);
  const hasZip = Boolean(lastWebsiteZipGeneratedAt);

  return {
    complete:
      hasTemplate && hasPages && hasSections && hasTheme && hasExportAll && hasZip,
    items: [
      { key: "template", label: "template selected", done: hasTemplate },
      { key: "pages", label: "pages available", done: hasPages },
      { key: "sections", label: "sections available", done: hasSections },
      { key: "theme", label: "theme configured", done: hasTheme },
      { key: "export", label: "export all pages completed", done: hasExportAll },
      { key: "zip", label: "ZIP generated", done: hasZip },
    ],
  };
}

function getPreviewPages(projectDetail, projectForm, pageForm, selectedProjectId) {
  if (projectDetail?.pages?.length) return projectDetail.pages;

  if (!selectedProjectId) return [];

  const fallbackPage = {
    id: "preview-page",
    path: pageForm.path || "/",
    sections: [],
    sortOrder: 0,
    title: pageForm.title || "Home",
  };

  return [fallbackPage];
}

function getSectionItems(props, fallbackItems = []) {
  if (Array.isArray(props.items) && props.items.length) {
    return props.items.slice(0, 4);
  }

  return fallbackItems;
}

function getSectionImageUrl(section) {
  return String(section?.props?.imageUrl || "").trim();
}

function sectionSupportsImage(section) {
  return imageSectionTypes.has(section?.type);
}

function renderPreviewSection(section) {
  const props = section?.props || {};
  const component = section?.styles?.component || section?.id || section?.type;
  const label = escapeHtml(props.label || component || "Component");
  const title = escapeHtml(props.title || props.heading || "Untitled");
  const body = escapeHtml(props.body || props.content || props.text || "");
  const actionLabel = escapeHtml(props.actionLabel || "Open");
  const imageUrl = escapeHtml(getSectionImageUrl(section));
  const imageAlt = escapeHtml(props.imageAlt || props.title || props.label || title);
  const mediaMarkup = imageUrl
    ? `<figure class="component-media"><img src="${imageUrl}" alt="${imageAlt}" loading="lazy"></figure>`
    : "";

  if (component === "navbar") {
    return `<nav class="component component-nav" aria-label="Primary navigation"><strong>${title}</strong><span>${body}</span></nav>`;
  }

  if (component === "footer") {
    return `<footer class="component component-footer"><strong>${title}</strong><span>${body}</span></footer>`;
  }

  if (section?.type === "hero") {
    return `<section class="component component-hero ${imageUrl ? "has-media" : ""}">${mediaMarkup}<div class="component-copy"><p>${label}</p><h2>${title}</h2><span>${body}</span></div><a href="#content">${actionLabel}</a></section>`;
  }

  if (section?.type === "gallery") {
    const items = getSectionItems(props, ["Frame 01", "Frame 02", "Frame 03"]);
    const itemMarkup = items
      .map(
        (item, index) =>
          `<figure><div>${String(index + 1).padStart(2, "0")}</div><figcaption>${escapeHtml(item)}</figcaption></figure>`,
      )
      .join("");

    return `<section class="component component-gallery ${imageUrl ? "has-media" : ""}">${mediaMarkup}<p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span><div class="gallery-grid">${itemMarkup}</div></section>`;
  }

  if (section?.type === "article-list") {
    const items = getSectionItems(props, [
      "Lead berita utama",
      "Update redaksi",
      "Arsip multimedia",
    ]);
    const itemMarkup = items
      .map(
        (item) =>
          `<article><p>Newsroom</p><h3>${escapeHtml(item)}</h3><span>Ringkasan berita siap publikasi.</span></article>`,
      )
      .join("");

    return `<section class="component component-news-grid"><p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span><div class="news-grid">${itemMarkup}</div></section>`;
  }

  if (section?.type === "feature-grid") {
    const items = getSectionItems(props, ["Editorial", "Multimedia", "Archive"]);
    const itemMarkup = items
      .map(
        (item) =>
          `<article><strong>${escapeHtml(item)}</strong><span>Reusable content block.</span></article>`,
      )
      .join("");

    return `<section class="component component-card-grid ${imageUrl ? "has-media" : ""}">${mediaMarkup}<p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span><div class="card-grid">${itemMarkup}</div></section>`;
  }

  if (section?.type === "cta") {
    return `<section class="component component-cta"><div><p>${label}</p><h2>${title}</h2><span>${body}</span></div><a href="#content">${actionLabel}</a></section>`;
  }

  return `<section class="component"><p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span></section>`;
}

function buildPreviewHtml({
  componentSections,
  generatedAt = new Date().toISOString(),
  cssHref = "",
  embeddedStyles = true,
  page,
  previewMode,
  project,
  projectForm,
  pageForm,
  theme = defaultWebTheme,
}) {
  const {
    themeAccentGallery,
    themeAccentOverlay,
    themeAccentPanel,
    themeAccentSoftOverlay,
    themePrimaryGallery,
    themeVarsCss,
    webTheme,
  } = buildThemeStyleTokens(theme);
  const resolvedProjectTitle =
    project?.title || projectForm.title || "Web Builder Preview";
  const resolvedDescription =
    project?.description ||
    projectForm.description ||
    "Realtime preview from existing Web Builder state.";
  const resolvedPageTitle = page?.title || pageForm.title || "Home";
  const resolvedPagePath = page?.path || pageForm.path || "/";
  const documentTitle =
    resolvedPageTitle === resolvedProjectTitle
      ? resolvedPageTitle
      : `${resolvedPageTitle} - ${resolvedProjectTitle}`;
  const fallbackPages = getPreviewPages(
    project,
    projectForm,
    pageForm,
    project?.id,
  );
  const activeSections = Array.isArray(page?.sections) && page.sections.length
    ? page.sections
    : componentSections;
  const websiteCss = buildWebsiteCss(webTheme);
  const styleMarkup = embeddedStyles
    ? `<style>${websiteCss}</style>`
    : `<link rel="stylesheet" href="${escapeHtml(cssHref)}">`;
  const pages = Array.isArray(project?.pages) && project.pages.length
    ? project.pages.slice(0, 4)
    : (fallbackPages.length ? fallbackPages : [page])
        .filter(Boolean)
        .slice(0, 4);
  const sectionMarkup = (activeSections || []).map(renderPreviewSection).join("");
  const pageMarkup = pages
    .map(
      (item) => `
        <article class="page-card">
          <div class="page-path">${escapeHtml(item.path || "/")}</div>
          <h3>${escapeHtml(item.title || "Page")}</h3>
          <p>${escapeHtml(
            item.sections?.length ? `${item.sections.length} sections ready` : "Empty page skeleton",
          )}</p>
        </article>`,
    )
    .join("");

  return `<!doctype html>
<!-- Generated by BLACK FLASH ORBIT Web Builder at ${escapeHtml(generatedAt)} -->
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(resolvedDescription)}">
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: ${webTheme.background};
      --bg-soft: #0a0a0b;
      --panel: rgba(255,255,255,0.04);
      --line: rgba(255,255,255,0.12);
      --text: ${webTheme.text};
      --muted: #a1a1aa;
      --accent: ${webTheme.primary};
      --accent-strong: ${webTheme.accent};
      --maroon: ${webTheme.accent};
      --radius: ${webTheme.radius}px;
      --spacing: ${webTheme.spacing}px;
${themeVarsCss}
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(217,173,87,0.18), transparent 28%),
        linear-gradient(180deg, #0a0a0b, var(--bg));
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    a { color: inherit; }
    .shell {
      width: min(100%, 1180px);
      margin: 0 auto;
      padding: var(--spacing);
    }
    .hero,
    .page-card,
    .component {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: var(--radius);
      backdrop-filter: blur(14px);
    }
    .hero {
      padding: clamp(22px, 4vw, 44px);
      background:
        linear-gradient(135deg, ${themeAccentOverlay}, ${themeAccentSoftOverlay}),
        rgba(255,255,255,0.04);
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 11px;
      font-weight: 800;
    }
    h1 {
      margin: 12px 0 10px;
      max-width: 820px;
      font-size: clamp(34px, 6vw, 72px);
      line-height: 0.98;
    }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
    .meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text);
      background: rgba(0,0,0,0.22);
    }
    .grid {
      display: grid;
      gap: 12px;
      margin-top: 16px;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }
    .page-card { padding: 14px; }
    .page-path {
      font-size: 11px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-weight: 800;
    }
    .page-card h3 {
      margin: 10px 0 6px;
      font-size: 18px;
      line-height: 1.2;
    }
    .section-title {
      margin: 18px 0 10px;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
    }
    .component {
      margin-top: 12px;
      background: rgba(255,255,255,0.035);
      padding: calc(var(--spacing) * 0.75);
    }
    .component h2 {
      margin: 8px 0 8px;
      font-size: 24px;
      line-height: 1.12;
    }
    .component span,
    .component article span,
    figcaption {
      color: var(--muted);
      line-height: 1.5;
    }
    .component-media {
      margin: 0 0 14px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) - 4px);
      background: rgba(0,0,0,0.24);
    }
    .component-media img {
      display: block;
      width: 100%;
      height: 220px;
      object-fit: cover;
    }
    .component-label,
    .component-hero p,
    .component-cta p {
      margin: 0;
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .component-nav,
    .component-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-radius: calc(var(--radius) - 2px);
      background: rgba(0,0,0,0.28);
    }
    .component-nav strong,
    .component-footer strong {
      color: var(--text);
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .component-hero,
    .component-cta {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, ${themeAccentOverlay}, ${themeAccentPanel});
    }
    .component-hero.has-media {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto;
    }
    .component-hero.has-media .component-copy {
      min-width: 0;
    }
    .component-hero.has-media .component-media {
      margin: 0;
      align-self: stretch;
    }
    .component-hero.has-media .component-media img {
      height: 100%;
      min-height: 240px;
    }
    .component-hero a,
    .component-cta a {
      border-radius: 999px;
      background: var(--accent);
      color: #080808;
      font-size: 12px;
      font-weight: 900;
      padding: 10px 14px;
      text-decoration: none;
      white-space: nowrap;
    }
    .component-gallery {
      background: linear-gradient(180deg, rgba(255,255,255,0.04), ${themeAccentPanel});
    }
    .component-gallery.has-media .component-media,
    .component-card-grid.has-media .component-media {
      margin-top: 0;
    }
    .card-grid,
    .gallery-grid,
    .news-grid {
      display: grid;
      gap: 10px;
      margin-top: 14px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .card-grid article,
    .news-grid article,
    .gallery-grid figure {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(0,0,0,0.22);
      padding: 12px;
    }
    .card-grid strong,
    .news-grid h3 {
      display: block;
      margin: 0 0 6px;
      color: var(--text);
      font-size: 15px;
    }
    .news-grid p {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .gallery-grid figure div {
      display: grid;
      min-height: 92px;
      place-items: center;
      border-radius: calc(var(--radius) - 6px);
      background: linear-gradient(135deg, ${themePrimaryGallery}, ${themeAccentGallery});
      color: var(--text);
      font-weight: 900;
    }
    .gallery-grid figcaption {
      display: block;
      margin-top: 10px;
      font-size: 13px;
    }
    .export-meta {
      margin-top: 18px;
      color: var(--muted);
      font-size: 11px;
    }
    @media (max-width: 520px) {
      .shell { padding: 14px; }
      .component-nav,
      .component-footer,
      .component-hero,
      .component-cta {
        grid-template-columns: 1fr;
        align-items: start;
      }
      .component-hero.has-media {
        grid-template-columns: 1fr;
      }
      .component-nav,
      .component-footer {
        display: grid;
      }
      .component-media img {
        height: 180px;
      }
      .component-hero a,
      .component-cta a {
        width: fit-content;
      }
    }
  </style>
</head>
<body>
  <main class="shell" data-page-path="${escapeHtml(resolvedPagePath)}">
    <section class="hero">
      <div class="eyebrow">${escapeHtml(resolvedPagePath)}</div>
      <h1>${escapeHtml(resolvedPageTitle)}</h1>
      <p>${escapeHtml(resolvedDescription)}</p>
      <div class="meta">
        <span class="chip">Project: ${escapeHtml(resolvedProjectTitle)}</span>
        <span class="chip">Path: ${escapeHtml(resolvedPagePath)}</span>
        <span class="chip">Mode: ${escapeHtml(previewMode)}</span>
      </div>
      <div class="export-meta">Generated ${escapeHtml(generatedAt)}</div>
    </section>

    <div class="section-title" id="content">Components</div>
    ${sectionMarkup || '<section class="component"><h2>No components selected</h2><span>Select a component from the library.</span></section>'}

    <div class="section-title">Pages</div>
    <section class="grid">
      ${pageMarkup || '<article class="page-card"><h3>No pages yet</h3><p>Add a page to render the live preview.</p></article>'}
    </section>
  </main>
</body>
</html>`;
}

function WebBuilderStat({ label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <strong className="mt-2 block text-2xl font-black text-white">
        {value}
      </strong>
    </article>
  );
}

function StatusPill({ children, tone = "amber" }) {
  const toneClass =
    tone === "red"
      ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
      : tone === "green"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : "border-amber-300/25 bg-amber-300/10 text-amber-200";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${toneClass}`}>
      {children}
    </span>
  );
}

function WebBuilderEmptyState({ children, title }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-5 text-sm leading-6 text-zinc-500">
      <h3 className="font-black text-zinc-200">{title}</h3>
      <p className="mt-2">{children}</p>
    </div>
  );
}

function WebBuilderLoading() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
          key={item}
        />
      ))}
    </div>
  );
}

export function WebBuilder() {
  const { profile } = useProfile();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [pageForm, setPageForm] = useState(emptyPageForm);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSync, setLastSync] = useState("-");
  const [lastExport, setLastExport] = useState(null);
  const [lastExportAll, setLastExportAll] = useState(null);
  const [lastWebsiteZipGeneratedAt, setLastWebsiteZipGeneratedAt] = useState("");
  const [lastPublishedAt, setLastPublishedAt] = useState("");
  const [publishStatus, setPublishStatus] = useState("draft");
  const [draggedSectionId, setDraggedSectionId] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [webTheme, setWebTheme] = useState(defaultWebTheme);
  const [templatePagesOverride, setTemplatePagesOverride] = useState(null);
  const [activeTemplateLabel, setActiveTemplateLabel] = useState("");
  const [assetForm, setAssetForm] = useState({
    name: "",
    url: "",
  });
  const [assetLibrary, setAssetLibrary] = useState([]);
  const [draftSections, setDraftSections] = useState(() =>
    buildComponentSections(),
  );
  const [sectionHistory, setSectionHistory] = useState({
    future: [],
    past: [],
  });
  const [autosaveStatus, setAutosaveStatus] = useState("saved");
  const [activeSectionId, setActiveSectionId] = useState("hero-1");
  const [selectedPageId, setSelectedPageId] = useState("");
  const activeAutosavePromiseRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);
  const assetUploadInputRef = useRef(null);
  const draftPageIdRef = useRef("");
  const publishSnapshotRef = useRef("");
  const lastPersistedPageSectionsRef = useRef({
    pageId: "",
    signature: "",
  });

  const userRole = profile?.role || "user";

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setError("");

    try {
      const data = await api.getWebBuilderProjects();
      const nextProjects = Array.isArray(data) ? data : [];

      setProjects(nextProjects);
      setSelectedProjectId((currentId) => {
        if (nextProjects.some((project) => project.id === currentId)) {
          return currentId;
        }

        return nextProjects[0]?.id || "";
      });
      setLastSync(new Date().toLocaleTimeString("id-ID"));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Gagal memuat project Web Builder."));
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const loadProjectDetail = useCallback(async (projectId) => {
    if (!projectId) {
      setProjectDetail(null);
      return;
    }

    setIsLoadingDetail(true);
    setError("");

    try {
      const response = await api.getWebBuilderProject(projectId);
      setProjectDetail(getResponseData(response, null));
    } catch (loadError) {
      setProjectDetail(null);
      setError(getErrorMessage(loadError, "Gagal memuat detail Web Builder."));
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadProjectDetail(selectedProjectId);
  }, [loadProjectDetail, selectedProjectId]);

  useEffect(() => {
    setTemplatePagesOverride(null);
    setActiveTemplateLabel("");
    publishSnapshotRef.current = "";
    setLastExport(null);
    setLastExportAll(null);
    setLastWebsiteZipGeneratedAt("");
    setLastPublishedAt("");
    setPublishStatus("draft");
  }, [selectedProjectId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadProjects();
      if (selectedProjectId) {
        loadProjectDetail(selectedProjectId);
      }
      setPreviewRevision((current) => current + 1);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [loadProjectDetail, loadProjects, selectedProjectId]);

  const isProjectDetailCurrent = projectDetail?.id === selectedProjectId;
  const pages = useMemo(() => {
    const detailPages = Array.isArray(templatePagesOverride)
      ? templatePagesOverride
      : isProjectDetailCurrent && Array.isArray(projectDetail?.pages)
        ? projectDetail.pages
        : [];

    if (!selectedPageId || draftPageIdRef.current !== selectedPageId) {
      return detailPages;
    }

    return syncPageSections(detailPages, selectedPageId, draftSections);
  }, [
    draftSections,
    isProjectDetailCurrent,
    projectDetail?.pages,
    selectedPageId,
    templatePagesOverride,
  ]);
  const exportedProjects = projects.filter(
    (project) => project.status === "exported",
  ).length;
  const selectedProject =
    (isProjectDetailCurrent ? { ...projectDetail, pages } : null) ||
    projects.find((project) => project.id === selectedProjectId) ||
    null;
  const selectedPage = useMemo(() => {
    const detailPages = pages;

    if (!detailPages.length) return null;

    return (
      detailPages.find((page) => page.id === selectedPageId) ||
      detailPages[0] ||
      null
    );
  }, [pages, selectedPageId]);

  const publishChecklist = useMemo(
    () =>
      getWebBuilderPublishChecklist({
        draftSections,
        lastExportAll,
        lastWebsiteZipGeneratedAt,
        pages,
        templatePagesOverride,
        webTheme,
      }),
    [
      draftSections,
      lastExportAll,
      lastWebsiteZipGeneratedAt,
      pages,
      templatePagesOverride,
      webTheme,
    ],
  );
  const publishStatusTone =
    publishStatus === "published"
      ? "green"
      : publishStatus === "ready"
        ? "green"
        : "amber";
  const publishChecklistComplete = publishChecklist.complete;
  const currentExportTime =
    lastExportAll?.generatedAt || lastExport?.exportedAt || "";
  const publishProductionUrl = selectedProject?.slug
    ? `https://production.example.com/${selectedProject.slug}`
    : "https://production.example.com/your-site";
  const publishPreviewUrl = selectedProject?.slug
    ? `https://preview.example.com/${selectedProject.slug}`
    : "https://preview.example.com/your-site";

  useEffect(() => {
    const currentSignature = JSON.stringify({
      assetCount: assetLibrary.length,
      draftSections: getSectionsSignature(draftSections),
      selectedPageId,
      templatePagesOverride: Array.isArray(templatePagesOverride)
        ? templatePagesOverride.map((page) => ({
            path: page.path || "/",
            sections: page.sections?.length || 0,
            title: page.title || "Home",
          }))
        : [],
      webTheme,
    });

    if (!publishSnapshotRef.current) {
      publishSnapshotRef.current = currentSignature;
      return;
    }

    if (publishSnapshotRef.current !== currentSignature) {
      publishSnapshotRef.current = currentSignature;
      setLastExport(null);
      setLastExportAll(null);
      setLastWebsiteZipGeneratedAt("");
      setPublishStatus("draft");
    }
  }, [
    assetLibrary.length,
    draftSections,
    selectedPageId,
    templatePagesOverride,
    webTheme,
  ]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedPageId("");
      draftPageIdRef.current = "";
      lastPersistedPageSectionsRef.current = {
        pageId: "",
        signature: "",
      };
      setSectionHistory({ future: [], past: [] });
      setTemplatePagesOverride(null);
      setAutosaveStatus("saved");
      setDraftSections(buildComponentSections());
      setActiveSectionId("hero-1");
      return;
    }

    if (!selectedPage) {
      setSelectedPageId("");
      draftPageIdRef.current = "";
      lastPersistedPageSectionsRef.current = {
        pageId: "",
        signature: "",
      };
      setSectionHistory({ future: [], past: [] });
      setTemplatePagesOverride(null);
      setAutosaveStatus("saved");
      setDraftSections(buildComponentSections());
      setActiveSectionId("hero-1");
      return;
    }

    if (selectedPage.id && selectedPageId !== selectedPage.id) {
      setSelectedPageId(selectedPage.id);
    }

    const persistedSections = cloneSectionsForDraft(selectedPage.sections);
    const nextSections = persistedSections;
    const safeSections = nextSections.length
      ? nextSections
      : buildComponentSections();

    draftPageIdRef.current = selectedPage.id || "";
    lastPersistedPageSectionsRef.current = {
      pageId: selectedPage.id || "",
      signature: getSectionsSignature(persistedSections),
    };
    setSectionHistory({ future: [], past: [] });
    setAutosaveStatus(
      getSectionsSignature(safeSections) === getSectionsSignature(persistedSections)
        ? "saved"
        : "unsaved",
    );
    setDraftSections(safeSections);
    setActiveSectionId((currentId) =>
      safeSections.some((section) => section.id === currentId)
        ? currentId
        : safeSections[0]?.id || "hero-1",
    );
  }, [selectedProjectId, selectedPage?.id]);

  useEffect(() => {
    if (
      !selectedProjectId ||
      !selectedPageId ||
      !selectedPage?.id ||
      draftPageIdRef.current !== selectedPageId
    ) {
      setAutosaveStatus("saved");
      return undefined;
    }

    const nextSections = cloneSectionsForDraft(draftSections);
    const nextSignature = getSectionsSignature(nextSections);
    const persisted = lastPersistedPageSectionsRef.current;

    if (
      persisted.pageId === selectedPageId &&
      persisted.signature === nextSignature
    ) {
      setAutosaveStatus("saved");
      return undefined;
    }

    setAutosaveStatus("unsaved");

    const timeoutId = window.setTimeout(async () => {
      autosaveTimeoutRef.current = null;
      saveCurrentPageSections().catch(() => {});
    }, SECTION_AUTOSAVE_DELAY_MS);

    autosaveTimeoutRef.current = timeoutId;

    return () => {
      if (autosaveTimeoutRef.current === timeoutId) {
        autosaveTimeoutRef.current = null;
      }

      window.clearTimeout(timeoutId);
    };
  }, [
    draftSections,
    selectedPage?.id,
    selectedPage?.metadata,
    selectedPageId,
    selectedProjectId,
  ]);

  const canUndoSections = sectionHistory.past.length > 0;
  const canRedoSections = sectionHistory.future.length > 0;
  const autosaveStatusMeta = getAutosaveStatusConfig(autosaveStatus);

  useEffect(() => {
    function handleSectionHistoryShortcut(event) {
      const key = String(event.key || "").toLowerCase();
      const hasCommandKey = event.ctrlKey || event.metaKey;

      if (!hasCommandKey || event.altKey || event.defaultPrevented) return;

      const isUndo = key === "z" && !event.shiftKey;
      const isRedo =
        (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);

      if (isUndo && canUndoSections) {
        event.preventDefault();
        handleUndoSections();
      } else if (isRedo && canRedoSections) {
        event.preventDefault();
        handleRedoSections();
      }
    }

    window.addEventListener("keydown", handleSectionHistoryShortcut);

    return () =>
      window.removeEventListener("keydown", handleSectionHistoryShortcut);
  }, [canRedoSections, canUndoSections, draftSections, sectionHistory]);

  const dashboardStats = useMemo(
    () => [
      { label: "Projects", value: projects.length },
      { label: "Pages", value: pages.length },
      { label: "Exported", value: exportedProjects },
      { label: "Auth", value: "ON" },
    ],
    [exportedProjects, pages.length, projects.length],
  );

  const activeDraftSection =
    draftSections.find((section) => section.id === activeSectionId) ||
    draftSections[0] ||
    null;
  const activePreviewPage = {
    ...(selectedPage || {}),
    path: selectedPage?.path || pageForm.path || "/",
    sections: draftSections,
    title: selectedPage?.title || pageForm.title || "Home",
  };
  const previewHtml = useMemo(
    () =>
      buildPreviewHtml({
        componentSections: draftSections,
        page: activePreviewPage,
        previewMode,
        project: selectedProject,
        projectForm,
        pageForm,
        theme: webTheme,
      }),
    [
      activePreviewPage,
      pageForm,
      previewMode,
      projectForm,
      draftSections,
      selectedProject,
      webTheme,
    ],
  );
  const previewFrame = previewViewports[previewMode];

  function syncPreview() {
    setPreviewRevision((current) => current + 1);
  }

  function updateWebTheme(partialTheme) {
    setWebTheme((current) => normalizeWebTheme({ ...current, ...partialTheme }));
  }

  function handleUseTemplate(template) {
    if (!template) return;

    const nextTheme = normalizeWebTheme(template.theme || defaultWebTheme);
    const templatePages = Array.isArray(template.pages) ? template.pages : [];
    const primaryPage = templatePages[0] || null;
    const nextPrimaryPageId =
      selectedPage?.id || primaryPage?.id || `template-${template.id}-home`;
    const nextPages = templatePages.map((page, index) => ({
      ...page,
      id:
        index === 0
          ? nextPrimaryPageId
          : page.id || `template-${template.id}-${index + 1}`,
      sections: cloneSectionsForDraft(page.sections),
    }));
    const nextSections = cloneSectionsForDraft(nextPages[0]?.sections || []);

    setWebTheme(nextTheme);
    setTemplatePagesOverride(nextPages);
    setActiveTemplateLabel(template.label || "");
    setPageForm(
      nextPages[0]
        ? {
            path: nextPages[0].path || "/",
            title: nextPages[0].title || "Home",
          }
        : emptyPageForm,
    );
    commitDraftSections(nextSections, {
      activeSectionId: nextSections[0]?.id || "",
    });
    if (selectedPage?.id && selectedPageId !== nextPrimaryPageId) {
      setSelectedPageId(nextPrimaryPageId);
    }
    setNotice(`Template "${template.label}" berhasil diterapkan.`);
    setError("");
  }

  function handleAddAsset(event) {
    event?.preventDefault?.();

    const name = assetForm.name.trim();
    const url = assetForm.url.trim();

    if (!name || !url) {
      setError("Name dan URL asset wajib diisi.");
      setNotice("");
      return;
    }

    const nextAsset = {
      id: `asset-${Date.now().toString(36)}`,
      name,
      type: "image",
      url,
    };

    setAssetLibrary((current) => [...current, nextAsset]);
    setAssetForm({ name: "", url: "" });
    setNotice("Asset image berhasil ditambahkan.");
    setError("");
  }

  function handleUploadAssetClick() {
    assetUploadInputRef.current?.click();
  }

  function handleUploadAssetChange(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!String(file.type || "").startsWith("image/")) {
      setError("File harus berupa gambar.");
      setNotice("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setAssetLibrary((current) => [
      {
        id: `asset-${Date.now().toString(36)}`,
        name: file.name,
        type: "image",
        url: objectUrl,
      },
      ...current,
    ]);
    setNotice("Image asset berhasil diunggah.");
    setError("");
  }

  function handleDeleteAsset(assetId) {
    setAssetLibrary((current) => {
      const removedAsset = current.find((asset) => asset.id === assetId);

      if (removedAsset?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(removedAsset.url);
      }

      return current.filter((asset) => asset.id !== assetId);
    });
  }

  function handleApplyAssetToActiveSection(assetUrl) {
    if (!activeDraftSection || !sectionSupportsImage(activeDraftSection)) {
      return;
    }

    handleEditSection("imageUrl", assetUrl);
  }

  function commitDraftSections(nextSections, options = {}) {
    const currentSnapshot = cloneSectionsForDraft(draftSections);
    const nextSnapshot = cloneSectionsForDraft(nextSections);

    if (getSectionsSignature(currentSnapshot) === getSectionsSignature(nextSnapshot)) {
      return false;
    }

    setSectionHistory((currentHistory) => ({
      future: [],
      past: limitSectionHistory([...currentHistory.past, currentSnapshot]),
    }));
    setDraftSections(nextSnapshot);

    if (options.activeSectionId !== undefined) {
      setActiveSectionId(options.activeSectionId);
    }

    setAutosaveStatus("unsaved");
    syncPreview();
    return true;
  }

  async function saveCurrentPageSections() {
    if (
      !selectedProjectId ||
      !selectedPageId ||
      !selectedPage?.id ||
      draftPageIdRef.current !== selectedPageId
    ) {
      setAutosaveStatus("saved");
      return false;
    }

    const activeSave = activeAutosavePromiseRef.current;

    if (activeSave) {
      await activeSave.catch(() => null);
    }

    const nextSections = cloneSectionsForDraft(draftSections);
    const nextSignature = getSectionsSignature(nextSections);
    const persisted = lastPersistedPageSectionsRef.current;

    if (
      persisted.pageId === selectedPageId &&
      persisted.signature === nextSignature
    ) {
      setAutosaveStatus("saved");
      return true;
    }

    setAutosaveStatus("saving");

    const savePromise = api.updateWebBuilderPage(
      selectedPageId,
      createPageSectionsPatch(selectedPage, nextSections),
    );

    activeAutosavePromiseRef.current = savePromise;

    try {
      await savePromise;
      lastPersistedPageSectionsRef.current = {
        pageId: selectedPageId,
        signature: nextSignature,
      };
      setLastSync(new Date().toLocaleTimeString("id-ID"));
      setAutosaveStatus("saved");
      return true;
    } catch (saveError) {
      setAutosaveStatus("failed");
      setError(getErrorMessage(saveError, "Gagal menyimpan section halaman."));
      throw saveError;
    } finally {
      if (activeAutosavePromiseRef.current === savePromise) {
        activeAutosavePromiseRef.current = null;
      }
    }
  }

  async function flushPendingAutosave() {
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    const activeSave = activeAutosavePromiseRef.current;

    if (activeSave) {
      await activeSave.catch(() => null);
    }

    return saveCurrentPageSections();
  }

  function handleUndoSections() {
    if (!sectionHistory.past.length) return;

    const currentSnapshot = cloneSectionsForDraft(draftSections);
    const previousSections =
      sectionHistory.past[sectionHistory.past.length - 1] || [];
    const nextSections = cloneSectionsForDraft(previousSections);

    setSectionHistory((currentHistory) => ({
      future: [currentSnapshot, ...currentHistory.future].slice(
        0,
        SECTION_HISTORY_LIMIT,
      ),
      past: currentHistory.past.slice(0, -1),
    }));
    setDraftSections(nextSections);
    setActiveSectionId((currentId) =>
      nextSections.some((section) => section.id === currentId)
        ? currentId
        : nextSections[0]?.id || "",
    );
    setAutosaveStatus("unsaved");
    syncPreview();
  }

  function handleRedoSections() {
    if (!sectionHistory.future.length) return;

    const currentSnapshot = cloneSectionsForDraft(draftSections);
    const nextSections = cloneSectionsForDraft(sectionHistory.future[0] || []);

    setSectionHistory((currentHistory) => ({
      future: currentHistory.future.slice(1),
      past: limitSectionHistory([...currentHistory.past, currentSnapshot]),
    }));
    setDraftSections(nextSections);
    setActiveSectionId((currentId) =>
      nextSections.some((section) => section.id === currentId)
        ? currentId
        : nextSections[0]?.id || "",
    );
    setAutosaveStatus("unsaved");
    syncPreview();
  }

  function handleAddSection(componentId) {
    const nextSection = createDraftSection(componentId);

    if (!nextSection) return;

    commitDraftSections([...draftSections, nextSection], {
      activeSectionId: nextSection.id,
    });
  }

  function handleEditSection(field, value) {
    if (!activeDraftSection) return;

    commitDraftSections(
      draftSections.map((section) =>
        section.id === activeDraftSection.id
          ? {
              ...section,
              props: {
                ...(section.props || {}),
                [field]: value,
              },
            }
          : section,
      ),
    );
  }

  function handleEditSectionItems(value) {
    if (!activeDraftSection) return;

    const items = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

    commitDraftSections(
      draftSections.map((section) =>
        section.id === activeDraftSection.id
          ? {
              ...section,
              props: {
                ...(section.props || {}),
                items,
              },
            }
          : section,
      ),
    );
  }

  function handleDeleteSection(sectionId) {
    const nextSections = draftSections.filter(
      (section) => section.id !== sectionId,
    );
    const nextActiveSectionId =
      activeSectionId === sectionId ? nextSections[0]?.id || "" : activeSectionId;

    commitDraftSections(nextSections, {
      activeSectionId: nextActiveSectionId,
    });
  }

  function handleMoveSection(sectionId, direction) {
    const currentIndex = draftSections.findIndex(
      (section) => section.id === sectionId,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= draftSections.length
    ) {
      return;
    }

    const nextSections = [...draftSections];
    const [section] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, section);

    commitDraftSections(nextSections);
  }

  function handleDragStartSection(sectionId, event) {
    setDraggedSectionId(sectionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
  }

  function handleDragEndSection() {
    setDraggedSectionId("");
  }

  function handleDropSection(targetSectionId) {
    const draggedIndex = draftSections.findIndex(
      (section) => section.id === draggedSectionId,
    );
    const targetIndex = draftSections.findIndex(
      (section) => section.id === targetSectionId,
    );

    if (draggedIndex >= 0 && targetIndex >= 0 && draggedIndex !== targetIndex) {
      const nextSections = [...draftSections];
      const [draggedSection] = nextSections.splice(draggedIndex, 1);
      const insertIndex =
        draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;

      nextSections.splice(insertIndex, 0, draggedSection);
      commitDraftSections(nextSections);
    }

    setDraggedSectionId("");
  }

  function handleDropSectionToEnd() {
    const draggedIndex = draftSections.findIndex(
      (section) => section.id === draggedSectionId,
    );

    if (draggedIndex >= 0 && draggedIndex !== draftSections.length - 1) {
      const nextSections = [...draftSections];
      const [draggedSection] = nextSections.splice(draggedIndex, 1);
      nextSections.push(draggedSection);
      commitDraftSections(nextSections);
    }

    setDraggedSectionId("");
  }

  async function handleCreateProject(event) {
    event.preventDefault();

    const validationError = validateProjectForm(projectForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreatingProject(true);
    setError("");
    setNotice("");

    try {
      const response = await api.createWebBuilderProject(
        createProjectPayload(projectForm),
      );
      const createdProject = getResponseData(response, null);

      setProjectForm(emptyProjectForm);
      setTemplatePagesOverride(null);
      setNotice("Project Web Builder berhasil dibuat.");
      await loadProjects();

      if (createdProject?.id) {
        setSelectedProjectId(createdProject.id);
      }
    } catch (createError) {
      setError(getErrorMessage(createError, "Gagal membuat project."));
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleCreatePage(event) {
    event.preventDefault();

    if (!selectedProjectId) {
      setError("Pilih project sebelum membuat halaman.");
      return;
    }

    const validationError = validatePageForm(pageForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreatingPage(true);
    setError("");
    setNotice("");

    try {
      const response = await api.createWebBuilderPage(
        selectedProjectId,
        createPagePayload(pageForm, draftSections),
      );
      const createdPage = getResponseData(response, null);
      setSelectedPageId(createdPage?.id || "");
      setPageForm(emptyPageForm);
      setTemplatePagesOverride(null);
      setNotice("Halaman Web Builder berhasil dibuat.");
      await loadProjectDetail(selectedProjectId);
    } catch (createError) {
      setError(getErrorMessage(createError, "Gagal membuat halaman."));
    } finally {
      setIsCreatingPage(false);
    }
  }

  async function handleExportProject() {
    if (!selectedProjectId) {
      setError("Pilih project sebelum export.");
      return;
    }

    setIsExporting(true);
    setError("");
    setNotice("");

    try {
      await flushPendingAutosave();
      const exportedAt = new Date().toISOString();
      const exportHtml = buildPreviewHtml({
        componentSections: draftSections,
        generatedAt: exportedAt,
        page: activePreviewPage,
        previewMode,
        project: selectedProject,
        projectForm,
        pageForm,
        theme: webTheme,
      });

      const exported = {
        exportedAt,
        format: "orbit-web-builder-local-v1",
        html: exportHtml,
        pageId: selectedPage?.id || null,
        pagePath: activePreviewPage.path || "/",
        pageTitle: activePreviewPage.title || "Home",
        sectionCount: draftSections.length,
      };

      setLastExport(exported);
      setNotice("Export HTML berhasil dibuat dari draft lokal.");
    } catch (exportError) {
      setError(getErrorMessage(exportError, "Gagal export project."));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportAllPages() {
    if (!selectedProjectId) {
      setError("Pilih project sebelum export.");
      return;
    }

    setIsExporting(true);
    setError("");
    setNotice("");

    try {
      await flushPendingAutosave();
      const generatedAt = new Date().toISOString();
      const exportPages = pages.length
        ? pages
        : selectedPage
          ? [selectedPage]
          : [];
      const manifest = buildExportAllManifest({
        generatedAt,
        pages: exportPages,
        previewMode,
        project: selectedProject,
        projectForm,
        theme: webTheme,
      });

      setLastExportAll(manifest);
      setNotice(
        `Export all pages berhasil dibuat untuk ${manifest.files.length} file.`,
      );
    } catch (exportError) {
      setError(getErrorMessage(exportError, "Gagal export semua halaman."));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadWebsiteZip() {
    if (!lastExportAll) {
      return;
    }

    setIsExportingZip(true);
    setError("");
    setNotice("");

    try {
      const exportManifest = lastExportAll;
      const websiteCss = buildWebsiteCss(exportManifest.theme || webTheme);
      const zipManifest = {
        ...exportManifest,
        files: exportManifest.files.map((file) => ({
          ...file,
          html: buildWebsiteHtmlWithStylesheet(
            file.html,
            "assets/css/styles.css",
          ),
        })),
      };

      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const websiteFolder = zip.folder("website");

      websiteFolder.file("manifest.json", JSON.stringify(zipManifest, null, 2));
      websiteFolder.folder("assets")?.folder("css")?.file("styles.css", websiteCss);

      zipManifest.files.forEach((file) => {
        websiteFolder.file(file.filename, file.html);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${selectedProject?.slug || "orbit-web-builder"}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setLastWebsiteZipGeneratedAt(new Date().toISOString());

      setNotice(
        `Website ZIP berhasil dibuat untuk ${zipManifest.files.length} halaman.`,
      );
    } catch (zipError) {
      setError(getErrorMessage(zipError, "Gagal download website ZIP."));
    } finally {
      setIsExportingZip(false);
    }
  }

  function handleDownloadExport() {
    const html = lastExport?.html || previewHtml;

    if (!html) return;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${selectedProject?.slug || "orbit-web-builder"}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadManifest() {
    const manifest = lastExportAll;

    if (!manifest) return;

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${selectedProject?.slug || "orbit-web-builder"}-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar releaseState={releaseState} userRole={userRole} />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Universal Web Builder</p>
              <h2 className="text-xl font-black text-white md:text-2xl">
                Project Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="orbit-icon-button"
                disabled={isLoadingProjects}
                onClick={loadProjects}
                type="button"
                title="Refresh Web Builder">
                <RefreshCcw
                  className={isLoadingProjects ? "animate-spin" : ""}
                  size={18}
                />
              </button>
              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6">
            <section className="rounded-lg border border-amber-300/15 bg-[linear-gradient(135deg,_rgba(217,173,87,0.12),_rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-black/20 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-200">
                    <Globe2 size={23} />
                  </div>
                  <p className="mt-5 orbit-kicker">/api/v1/web-builder</p>
                  <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
                    Build newsroom web projects from protected backend data.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                    Dashboard ini memakai kontrak backend Web Builder yang sudah
                    ada: project CRUD, page CRUD, owner auth, dan export HTML.
                  </p>
                </div>

                <div className="grid content-start gap-3">
                  <StatusPill tone="green">Bearer Auth Active</StatusPill>
                  <StatusLine label="Last Sync" value={lastSync} />
                  <StatusLine
                    label="Selected"
                    value={selectedProject?.title || "-"}
                  />
                  <StatusLine
                    label="Export"
                    value={lastExport?.exportedAt ? "ready" : "not generated"}
                  />
                </div>
              </div>
            </section>

            {(error || notice) && (
              <section
                aria-live="polite"
                className={`rounded-lg border p-4 text-sm font-bold ${
                  error
                    ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
                    : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                }`}>
                <div className="flex gap-2">
                  {error ? <AlertTriangle size={17} /> : <Rocket size={17} />}
                  <span>{error || notice}</span>
                </div>
              </section>
            )}

            <section className="grid gap-4 md:grid-cols-4">
              {dashboardStats.map((item) => (
                <WebBuilderStat
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
              <aside className="grid gap-4">
                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="orbit-kicker">Project List</p>
                      <h3 className="mt-1 text-lg font-black text-white">
                        Owned Projects
                      </h3>
                    </div>
                    <Layers3 className="text-amber-300" size={21} />
                  </div>

                  {isLoadingProjects ? (
                    <WebBuilderLoading />
                  ) : projects.length ? (
                    <div className="grid gap-2">
                      {projects.map((project) => (
                        <button
                          className={`rounded-lg border p-3 text-left transition ${
                            project.id === selectedProjectId
                              ? "border-amber-300/35 bg-amber-300/10"
                              : "border-white/10 bg-black/20 hover:border-white/20"
                          }`}
                          key={project.id}
                          onClick={() => setSelectedProjectId(project.id)}
                          type="button">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-black text-white">
                                {project.title}
                              </h4>
                              <p className="mt-1 truncate text-xs text-zinc-500">
                                /{project.slug}
                              </p>
                            </div>
                            <StatusPill
                              tone={project.status === "exported" ? "green" : "amber"}>
                              {project.status}
                            </StatusPill>
                          </div>
                          <p className="mt-3 text-xs text-zinc-600">
                            Updated {formatDateTime(project.updatedAt)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <WebBuilderEmptyState title="Belum ada project">
                      Buat project pertama untuk mengaktifkan workspace Web
                      Builder.
                    </WebBuilderEmptyState>
                  )}
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <p className="orbit-kicker">Create Project</p>
                  <form className="mt-4 grid gap-3" onSubmit={handleCreateProject}>
                    <FieldInput
                      label="Title"
                      maxLength={160}
                      onChange={(value) =>
                        setProjectForm((current) => ({ ...current, title: value }))
                      }
                      placeholder="Papua Selatan News Hub"
                      value={projectForm.title}
                    />
                    <FieldInput
                      label="Slug"
                      maxLength={80}
                      onChange={(value) =>
                        setProjectForm((current) => ({
                          ...current,
                          slug: normalizeSlugInput(value),
                        }))
                      }
                      placeholder="papua-selatan-news-hub"
                      value={projectForm.slug}
                    />
                    <FieldTextarea
                      label="Description"
                      maxLength={800}
                      onChange={(value) =>
                        setProjectForm((current) => ({
                          ...current,
                          description: value,
                        }))
                      }
                      placeholder="Portal editorial untuk paket berita daerah."
                      value={projectForm.description}
                    />
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300 px-4 py-3 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isCreatingProject}
                      type="submit">
                      {isCreatingProject ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                      Create Project
                    </button>
                  </form>
                </section>
              </aside>

              <section className="grid gap-4 xl:grid-cols-3 xl:items-start">
                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-3">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Project Detail</p>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        {selectedProject?.title || "No project selected"}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        {selectedProject?.description ||
                          "Pilih project untuk melihat halaman dan status export."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedProjectId || isExporting}
                        onClick={handleExportProject}
                        type="button">
                        {isExporting ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <FileCode2 size={15} />
                        )}
                        Export
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedProjectId || isExporting}
                        onClick={handleExportAllPages}
                        type="button">
                        {isExporting ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <FileCode2 size={15} />
                        )}
                        Export All Pages
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!lastExportAll || isExportingZip}
                        onClick={handleDownloadWebsiteZip}
                        type="button">
                        {isExportingZip ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <FileCode2 size={15} />
                        )}
                        Download Website ZIP
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!lastExportAll}
                        onClick={handleDownloadManifest}
                        type="button">
                        <ArrowUpRight size={15} />
                        Download Manifest
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!lastExport?.html}
                        onClick={handleDownloadExport}
                        type="button">
                        <ArrowUpRight size={15} />
                        Download HTML
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <StatusLine label="Slug" value={selectedProject?.slug || "-"} />
                    <StatusLine
                      label="Status"
                      value={selectedProject?.status || "-"}
                    />
                    <StatusLine
                      label="Last Export"
                      value={formatDateTime(selectedProject?.lastExportedAt)}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Publish Manager</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Publish status
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Status ini hanya mengatur readiness lokal sebelum integrasi
                        deployment dibuat.
                      </p>
                    </div>
                    <StatusPill tone={publishStatusTone}>{publishStatus}</StatusPill>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <StatusLine label="Current Status" value={publishStatus} />
                    <StatusLine
                      label="Last Export"
                      value={formatDateTime(currentExportTime)}
                    />
                    <StatusLine
                      label="Last Publish"
                      value={formatDateTime(lastPublishedAt)}
                    />
                    <StatusLine
                      label="Production URL"
                      value={publishProductionUrl}
                    />
                    <StatusLine label="Preview URL" value={publishPreviewUrl} />
                    <StatusLine
                      label="Template"
                      value={activeTemplateLabel || "-"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedProjectId}
                      onClick={() => setPublishStatus("ready")}
                      type="button">
                      Mark as Ready
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedProjectId || !publishChecklistComplete}
                      onClick={() => {
                        setPublishStatus("published");
                        setLastPublishedAt(new Date().toISOString());
                      }}
                      type="button">
                      Mark as Published
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedProjectId}
                      onClick={() => setPublishStatus("draft")}
                      type="button">
                      Reset to Draft
                    </button>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      Publish Checklist
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {publishChecklist.items.map((item) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                          key={item.key}>
                          <span className="min-w-0 truncate text-xs font-bold text-zinc-300">
                            {item.label}
                          </span>
                          <StatusPill tone={item.done ? "green" : "amber"}>
                            {item.done ? "OK" : "Pending"}
                          </StatusPill>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <article className="rounded-lg border border-white/10 bg-black/20 p-4 xl:col-start-3">
                  <p className="orbit-kicker">Section Edit</p>
                  {activeDraftSection ? (
                    <div className="mt-4 grid gap-3">
                      <StatusLine
                        label="Type"
                        value={
                          activeDraftSection.styles?.component ||
                          activeDraftSection.type
                        }
                      />
                      <FieldInput
                        label="Label"
                        maxLength={80}
                        onChange={(value) => handleEditSection("label", value)}
                        placeholder="Section label"
                        value={activeDraftSection.props?.label || ""}
                      />
                      <FieldInput
                        label="Title"
                        maxLength={160}
                        onChange={(value) => handleEditSection("title", value)}
                        placeholder="Section title"
                        value={activeDraftSection.props?.title || ""}
                      />
                      <FieldTextarea
                        label="Body"
                        maxLength={800}
                        onChange={(value) => handleEditSection("body", value)}
                        placeholder="Section body"
                        value={activeDraftSection.props?.body || ""}
                      />
                      <FieldInput
                        label="Action Label"
                        maxLength={80}
                        onChange={(value) =>
                          handleEditSection("actionLabel", value)
                        }
                        placeholder="Button label"
                        value={activeDraftSection.props?.actionLabel || ""}
                      />
                      {sectionSupportsImage(activeDraftSection) && (
                        <FieldInput
                          label="Image URL"
                          maxLength={1000}
                          onChange={(value) =>
                            handleEditSection("imageUrl", value)
                          }
                          placeholder="https://example.com/image.jpg"
                          value={activeDraftSection.props?.imageUrl || ""}
                        />
                      )}
                      {Array.isArray(activeDraftSection.props?.items) && (
                        <FieldTextarea
                          label="Items"
                          maxLength={800}
                          onChange={handleEditSectionItems}
                          placeholder="One item per line"
                          value={activeDraftSection.props.items.join("\n")}
                        />
                      )}
                    </div>
                  ) : (
                    <WebBuilderEmptyState title="Tidak ada section aktif">
                      Pilih atau tambahkan section untuk membuka editor.
                    </WebBuilderEmptyState>
                  )}
                </article>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Template Library</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Ready-made layouts
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Start from a multi-page template with sections and theme
                        already mapped for the current draft.
                      </p>
                    </div>
                    <StatusPill tone="amber">
                      {webBuilderTemplates.length} templates
                    </StatusPill>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {webBuilderTemplates.map((template) => {
                      const firstPage = template.pages[0];
                      const sectionCount = firstPage?.sections?.length || 0;

                      return (
                        <article
                          className="rounded-lg border border-white/10 bg-black/20 p-4"
                          key={template.id}>
                          <div className="flex flex-col gap-3">
                            <div>
                              <h4 className="text-sm font-black text-white">
                                {template.label}
                              </h4>
                              <p className="mt-2 text-xs leading-5 text-zinc-500">
                                {template.pages.length} pages
                                {sectionCount ? ` · ${sectionCount} sections` : ""}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {template.pages.map((page) => (
                                <span
                                  className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400"
                                  key={`${template.id}-${page.path}`}>
                                  {page.path}
                                </span>
                              ))}
                            </div>

                            <button
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs font-black text-amber-100 transition hover:bg-amber-300/15"
                              onClick={() => handleUseTemplate(template)}
                              type="button">
                              <Rocket size={14} />
                              Use Template
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Component Library</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Reusable blocks
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Pilih blok untuk template halaman dan live preview.
                      </p>
                    </div>
                    <StatusPill tone="green">
                      {draftSections.length} sections
                    </StatusPill>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {componentLibrary.map((component) => (
                      <button
                        className="rounded-lg border border-white/10 bg-black/20 p-4 text-left transition hover:border-amber-300/30 hover:bg-amber-300/10"
                        key={component.id}
                        onClick={() => handleAddSection(component.id)}
                        type="button">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white">
                              {component.label}
                            </h4>
                            <p className="mt-2 text-xs leading-5 text-zinc-500">
                              {component.summary}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                            <Plus size={12} />
                            Add
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Section Builder</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Compose page sections
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Tambah, edit, hapus, dan urutkan section. Preview
                        sinkron langsung dari draft ini.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={autosaveStatusMeta.tone}>
                        {autosaveStatusMeta.label}
                      </StatusPill>
                      <button
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/30 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!canUndoSections}
                        onClick={handleUndoSections}
                        type="button">
                        Undo
                      </button>
                      <button
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/30 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!canRedoSections}
                        onClick={handleRedoSections}
                        type="button">
                        Redo
                      </button>
                      <StatusPill>{draftSections.length} draft</StatusPill>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <div className="grid gap-2">
                      {draftSections.length ? (
                        draftSections.map((section, index) => {
                          const componentId = section.styles?.component || "";
                          const component = componentLibrary.find(
                            (item) => item.id === componentId,
                          );
                          const isActive = activeDraftSection?.id === section.id;
                          const isDragged = draggedSectionId === section.id;

                          return (
                            <article
                              className={`rounded-lg border p-3 transition ${
                                isActive
                                  ? "border-amber-300/35 bg-amber-300/10"
                                  : "border-white/10 bg-black/20"
                              } ${isDragged ? "opacity-50" : ""}`}
                              key={section.id}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleDropSection(section.id)}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <button
                                    aria-label={`Drag ${section.props?.title || section.type || "section"}`}
                                    className="mt-0.5 inline-flex shrink-0 cursor-grab items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-zinc-300 active:cursor-grabbing"
                                    draggable
                                    onDragEnd={handleDragEndSection}
                                    onDragStart={(event) =>
                                      handleDragStartSection(section.id, event)
                                    }
                                    title="Drag to reorder"
                                    type="button">
                                    <GripVertical size={15} />
                                  </button>
                                  <button
                                    className="min-w-0 text-left"
                                    onClick={() => setActiveSectionId(section.id)}
                                    type="button">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                                      {component?.label || section.type}
                                    </p>
                                    <h4 className="mt-1 truncate text-sm font-black text-white">
                                      {section.props?.title || "Untitled section"}
                                    </h4>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                      {section.props?.body ||
                                        section.props?.content ||
                                        "No body copy yet."}
                                    </p>
                                  </button>
                                </div>

                                <div className="flex shrink-0 gap-1">
                                  <button
                                    className="orbit-icon-button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveSection(section.id, -1)}
                                    title="Move section up"
                                    type="button">
                                    <ArrowUp size={15} />
                                  </button>
                                  <button
                                    className="orbit-icon-button"
                                    disabled={index === draftSections.length - 1}
                                    onClick={() => handleMoveSection(section.id, 1)}
                                    title="Move section down"
                                    type="button">
                                    <ArrowDown size={15} />
                                  </button>
                                  <button
                                    className="orbit-icon-button text-rose-200"
                                    onClick={() => handleDeleteSection(section.id)}
                                    title="Delete section"
                                    type="button">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <WebBuilderEmptyState title="Belum ada section">
                          Tambahkan section dari Component Library untuk mulai
                          membangun halaman.
                        </WebBuilderEmptyState>
                      )}
                      {draftSections.length ? (
                        <button
                          className="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2 text-left text-xs font-semibold text-zinc-500 transition hover:border-amber-300/35 hover:bg-amber-300/5 hover:text-zinc-300"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handleDropSectionToEnd}
                          type="button">
                          Drop here to append the dragged section to the end.
                        </button>
                      ) : null}
                    </div>

                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:col-start-1">
                  <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="orbit-kicker">Pages</p>
                        <h3 className="mt-1 text-lg font-black text-white">
                          Project Pages
                        </h3>
                      </div>
                      {isLoadingDetail && (
                        <Loader2 className="animate-spin text-amber-300" size={18} />
                      )}
                    </div>

                    {isLoadingDetail ? (
                      <WebBuilderLoading />
                    ) : pages.length ? (
                      <div className="grid gap-3">
                        {pages.map((page) => (
                          <button
                            className={`rounded-lg border p-4 text-left transition ${
                              page.id === selectedPageId
                                ? "border-amber-300/35 bg-amber-300/10"
                                : "border-white/10 bg-black/20 hover:border-white/20"
                            }`}
                            onClick={() => setSelectedPageId(page.id)}
                            key={page.id}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-black text-white">
                                  {page.title}
                                </h4>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {page.path} - {page.sections?.length || 0} sections
                                </p>
                              </div>
                              <span className="text-xs font-bold text-zinc-500">
                                #{page.sortOrder ?? 0}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <WebBuilderEmptyState title="Belum ada halaman">
                        Tambahkan halaman pertama untuk project terpilih.
                      </WebBuilderEmptyState>
                    )}
                  </article>

                  <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="orbit-kicker">Create Page</p>
                    <form className="mt-4 grid gap-3" onSubmit={handleCreatePage}>
                      <FieldInput
                        label="Title"
                        maxLength={160}
                        onChange={(value) =>
                          setPageForm((current) => ({ ...current, title: value }))
                        }
                        placeholder="Home"
                        value={pageForm.title}
                      />
                      <FieldInput
                        label="Path"
                        maxLength={120}
                        onChange={(value) =>
                          setPageForm((current) => ({
                            ...current,
                            path: value.toLowerCase(),
                          }))
                        }
                        placeholder="/"
                        value={pageForm.path}
                      />
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedProjectId || isCreatingPage}
                        type="submit">
                        {isCreatingPage ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                        Create Page
                      </button>
                    </form>
                  </article>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Theme Builder</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Visual identity
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Ubah warna utama, latar, radius, dan spacing. Preview
                        serta export HTML akan ikut memakai theme ini.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                        Radius {webTheme.radius}px
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                        Spacing {webTheme.spacing}px
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      {
                        key: "primary",
                        label: "Primary",
                        description: "Warna aksi utama dan highlight.",
                      },
                      {
                        key: "accent",
                        label: "Accent",
                        description: "Warna pendukung untuk overlay dan depth.",
                      },
                      {
                        key: "background",
                        label: "Background",
                        description: "Latar utama halaman preview.",
                      },
                      {
                        key: "text",
                        label: "Text",
                        description: "Warna teks utama.",
                      },
                    ].map((field) => (
                      <label
                        className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3"
                        key={field.key}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                              {field.label}
                            </span>
                            <span className="mt-1 block text-xs text-zinc-500">
                              {field.description}
                            </span>
                          </div>
                          <span
                            className="h-9 w-9 rounded-md border border-white/10 shadow-inner shadow-black/30"
                            style={{ backgroundColor: webTheme[field.key] }}
                          />
                        </div>
                        <input
                          aria-label={field.label}
                          className="h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-black/30 p-1"
                          onChange={(event) =>
                            updateWebTheme({ [field.key]: event.target.value })
                          }
                          type="color"
                          value={webTheme[field.key]}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                          Radius
                        </span>
                        <span className="text-xs font-bold text-white">
                          {webTheme.radius}px
                        </span>
                      </div>
                      <input
                        aria-label="Radius"
                        className="w-full accent-amber-300"
                        min="8"
                        max="28"
                        onChange={(event) =>
                          updateWebTheme({ radius: Number(event.target.value) })
                        }
                        type="range"
                        value={webTheme.radius}
                      />
                    </label>

                    <label className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                          Spacing
                        </span>
                        <span className="text-xs font-bold text-white">
                          {webTheme.spacing}px
                        </span>
                      </div>
                      <input
                        aria-label="Spacing"
                        className="w-full accent-amber-300"
                        min="12"
                        max="40"
                        onChange={(event) =>
                          updateWebTheme({ spacing: Number(event.target.value) })
                        }
                        type="range"
                        value={webTheme.spacing}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Asset Manager</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Image library
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Simpan URL gambar lokal di workspace ini, lalu pakai ke
                        Hero, Gallery, atau Card section aktif.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                      <ImageIcon size={15} />
                      {assetLibrary.length} assets
                    </div>
                  </div>

                  <form
                    className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    onSubmit={handleAddAsset}>
                    <input
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadAssetChange}
                      ref={assetUploadInputRef}
                      type="file"
                    />
                    <div className="md:col-span-3">
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-amber-300/35 hover:bg-amber-300/10"
                        onClick={handleUploadAssetClick}
                        type="button">
                        <ImageIcon size={16} />
                        Upload Image
                      </button>
                      <p className="mt-2 text-[11px] font-medium text-zinc-500">
                        Hanya menerima file gambar. Preview memakai object URL
                        lokal.
                      </p>
                    </div>
                    <FieldInput
                      label="Name"
                      maxLength={120}
                      onChange={(value) =>
                        setAssetForm((current) => ({ ...current, name: value }))
                      }
                      placeholder="Hero cover"
                      value={assetForm.name}
                    />
                    <FieldInput
                      label="URL"
                      maxLength={1000}
                      onChange={(value) =>
                        setAssetForm((current) => ({ ...current, url: value }))
                      }
                      placeholder="https://example.com/image.jpg"
                      value={assetForm.url}
                    />
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      type="submit">
                      <Plus size={16} />
                      Add Asset
                    </button>
                  </form>

                  <div className="mt-4 grid gap-3">
                    {assetLibrary.length ? (
                      assetLibrary.map((asset) => (
                        <article
                          className="rounded-lg border border-white/10 bg-black/20 p-3"
                          key={asset.id}>
                          <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
                            <div className="overflow-hidden rounded-md border border-white/10 bg-black/30">
                              <img
                                alt={asset.name}
                                className="h-24 w-full object-cover"
                                src={asset.url}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="truncate text-sm font-black text-white">
                                  {asset.name}
                                </h4>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                  {asset.type}
                                </span>
                              </div>
                              <p className="mt-1 break-all text-xs text-zinc-500">
                                {asset.url}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white transition hover:border-amber-300/35 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                  !activeDraftSection ||
                                  !sectionSupportsImage(activeDraftSection)
                                }
                                onClick={() =>
                                  handleApplyAssetToActiveSection(asset.url)
                                }
                                type="button">
                                Use in section
                              </button>
                              <button
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-rose-300/35 hover:bg-rose-300/10 hover:text-rose-100"
                                onClick={() => handleDeleteAsset(asset.id)}
                                type="button">
                                <Trash2 size={14} />
                                Remove
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <WebBuilderEmptyState title="Belum ada asset">
                        Tambahkan URL gambar pertama untuk dipakai di section
                        aktif.
                      </WebBuilderEmptyState>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5 xl:col-start-2">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="orbit-kicker">Live Preview</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Realtime render
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Preview berubah saat state project/page berubah dan ikut
                        refresh otomatis setiap {AUTO_REFRESH_MS / 1000} detik.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewViewports).map(([key, item]) => {
                        const Icon = item.icon;
                        const isActive = previewMode === key;

                        return (
                          <button
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition ${
                              isActive
                                ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                                : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                            }`}
                            key={key}
                            onClick={() => setPreviewMode(key)}
                            type="button">
                            <Icon size={15} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="overflow-auto rounded-md border border-white/10 bg-[#0a0a0b] p-3">
                      <div
                        className="mx-auto overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl shadow-black/40"
                        style={{
                          maxWidth: "100%",
                          transition: "width 180ms ease",
                          width: previewFrame.frameWidth,
                        }}>
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                          <span>{previewFrame.label}</span>
                          <span>{previewFrame.sizeLabel}</span>
                        </div>
                        <iframe
                          className="block min-h-[640px] w-full bg-black"
                          key={`${selectedProjectId || "draft"}-${previewMode}-${previewRevision}`}
                          sandbox=""
                          srcDoc={previewHtml}
                          title="Web Builder Live Preview"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function FieldInput({ label, maxLength, onChange, placeholder, value }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <input
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-700 focus:border-amber-300/40"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function FieldTextarea({ label, maxLength, onChange, placeholder, value }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <textarea
        className="min-h-24 resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-700 focus:border-amber-300/40"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function StatusLine({ label, value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      <strong className="truncate text-right text-xs font-black text-zinc-100">
        {value}
      </strong>
    </div>
  );
}
