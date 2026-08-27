const supabase = require("../lib/supabase");
const {
  normalizePageInput,
  normalizeProjectInput,
  normalizeText,
} = require("../lib/webBuilderSchema");

const PROJECT_COLUMNS =
  "id, user_id, user_email, title, slug, description, status, theme, settings, metadata, last_exported_at, created_at, updated_at";
const PAGE_COLUMNS =
  "id, project_id, user_id, title, path, sort_order, seo, sections, metadata, created_at, updated_at";
const ASSET_COLUMNS =
  "id, project_id, user_id, asset_type, storage_path, source_url, alt_text, metadata, created_at, updated_at";
const MAX_RENDER_TEXT_LENGTH = 5000;

function createHttpError(message, statusCode = 500, code = "web_builder_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireSupabase() {
  if (!supabase) {
    throw createHttpError(
      "Supabase belum dikonfigurasi.",
      500,
      "web_builder_supabase_missing",
    );
  }

  return supabase;
}

function requireUserId(userId) {
  const cleanUserId = normalizeText(userId, 80);

  if (!cleanUserId) {
    throw createHttpError(
      "User login wajib tersedia.",
      401,
      "web_builder_auth_required",
    );
  }

  return cleanUserId;
}

function normalizeEmail(value) {
  return normalizeText(value, 320).toLowerCase() || null;
}

function mapProject(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    theme: row.theme || {},
    settings: row.settings || {},
    metadata: row.metadata || {},
    lastExportedAt: row.last_exported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPage(row) {
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    title: row.title,
    path: row.path,
    sortOrder: row.sort_order,
    seo: row.seo || {},
    sections: Array.isArray(row.sections) ? row.sections : [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAsset(row) {
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    assetType: row.asset_type,
    storagePath: row.storage_path,
    sourceUrl: row.source_url,
    altText: row.alt_text,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireRecord(row, message, code) {
  if (!row) {
    throw createHttpError(message, 404, code);
  }

  return row;
}

async function getOwnedProjectRow(db, { projectId, userId }) {
  const cleanProjectId = normalizeText(projectId, 80);
  const ownerId = requireUserId(userId);

  if (!cleanProjectId) {
    throw createHttpError(
      "Project id wajib diisi.",
      400,
      "web_builder_project_id_required",
    );
  }

  const { data, error } = await db
    .from("orbit_web_projects")
    .select(PROJECT_COLUMNS)
    .eq("id", cleanProjectId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) throw error;

  return requireRecord(
    data,
    "Project tidak ditemukan atau bukan milik user login.",
    "web_builder_project_not_found",
  );
}

async function listProjects({ userId }) {
  const db = requireSupabase();
  const ownerId = requireUserId(userId);

  const { data, error } = await db
    .from("orbit_web_projects")
    .select(PROJECT_COLUMNS)
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data || []).map(mapProject);
}

async function getProject({ projectId, userId }) {
  const db = requireSupabase();
  const project = await getOwnedProjectRow(db, { projectId, userId });
  const [pages, assets] = await Promise.all([
    listPages({ projectId: project.id, userId }),
    listAssets({ projectId: project.id, userId }),
  ]);

  return {
    ...mapProject(project),
    assets,
    pages,
  };
}

async function createProject({ input, userEmail, userId }) {
  const db = requireSupabase();
  const ownerId = requireUserId(userId);
  const payload = {
    ...normalizeProjectInput(input),
    user_email: normalizeEmail(userEmail),
    user_id: ownerId,
  };

  const { data, error } = await db
    .from("orbit_web_projects")
    .insert([payload])
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw error;

  return mapProject(data);
}

async function updateProject({ input, projectId, userId }) {
  const db = requireSupabase();
  const ownerId = requireUserId(userId);
  const cleanProjectId = normalizeText(projectId, 80);
  const payload = normalizeProjectInput(input, { partial: true });

  const { data, error } = await db
    .from("orbit_web_projects")
    .update(payload)
    .eq("id", cleanProjectId)
    .eq("user_id", ownerId)
    .select(PROJECT_COLUMNS)
    .maybeSingle();

  if (error) throw error;

  return mapProject(
    requireRecord(
      data,
      "Project tidak ditemukan atau bukan milik user login.",
      "web_builder_project_not_found",
    ),
  );
}

async function deleteProject({ projectId, userId }) {
  const db = requireSupabase();
  const project = await getOwnedProjectRow(db, { projectId, userId });

  const { error } = await db
    .from("orbit_web_projects")
    .delete()
    .eq("id", project.id)
    .eq("user_id", project.user_id);

  if (error) throw error;

  return { id: project.id };
}

async function listPages({ projectId, userId }) {
  const db = requireSupabase();
  const project = await getOwnedProjectRow(db, { projectId, userId });

  const { data, error } = await db
    .from("orbit_web_pages")
    .select(PAGE_COLUMNS)
    .eq("project_id", project.id)
    .eq("user_id", project.user_id)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(mapPage);
}

async function createPage({ input, projectId, userId }) {
  const db = requireSupabase();
  const project = await getOwnedProjectRow(db, { projectId, userId });
  const payload = {
    ...normalizePageInput(input),
    project_id: project.id,
    user_id: project.user_id,
  };

  const { data, error } = await db
    .from("orbit_web_pages")
    .insert([payload])
    .select(PAGE_COLUMNS)
    .single();

  if (error) throw error;

  return mapPage(data);
}

async function getOwnedPageRow(db, { pageId, userId }) {
  const ownerId = requireUserId(userId);
  const cleanPageId = normalizeText(pageId, 80);

  if (!cleanPageId) {
    throw createHttpError(
      "Page id wajib diisi.",
      400,
      "web_builder_page_id_required",
    );
  }

  const { data, error } = await db
    .from("orbit_web_pages")
    .select(PAGE_COLUMNS)
    .eq("id", cleanPageId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) throw error;

  return requireRecord(
    data,
    "Halaman tidak ditemukan atau bukan milik user login.",
    "web_builder_page_not_found",
  );
}

async function getPage({ pageId, userId }) {
  const db = requireSupabase();
  const page = await getOwnedPageRow(db, { pageId, userId });

  return mapPage(page);
}

async function updatePage({ input, pageId, userId }) {
  const db = requireSupabase();
  const ownerId = requireUserId(userId);
  const cleanPageId = normalizeText(pageId, 80);
  const payload = normalizePageInput(input, { partial: true });

  const { data, error } = await db
    .from("orbit_web_pages")
    .update(payload)
    .eq("id", cleanPageId)
    .eq("user_id", ownerId)
    .select(PAGE_COLUMNS)
    .maybeSingle();

  if (error) throw error;

  return mapPage(
    requireRecord(
      data,
      "Halaman tidak ditemukan atau bukan milik user login.",
      "web_builder_page_not_found",
    ),
  );
}

async function deletePage({ pageId, userId }) {
  const db = requireSupabase();
  const page = await getOwnedPageRow(db, { pageId, userId });

  const { error } = await db
    .from("orbit_web_pages")
    .delete()
    .eq("id", page.id)
    .eq("user_id", page.user_id);

  if (error) throw error;

  return { id: page.id };
}

async function listAssets({ projectId, userId }) {
  const db = requireSupabase();
  const project = await getOwnedProjectRow(db, { projectId, userId });

  const { data, error } = await db
    .from("orbit_web_assets")
    .select(ASSET_COLUMNS)
    .eq("project_id", project.id)
    .eq("user_id", project.user_id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data || []).map(mapAsset);
}

async function exportProject({ projectId, userId }) {
  const db = requireSupabase();
  const project = await getOwnedProjectRow(db, { projectId, userId });
  const [pages, assets] = await Promise.all([
    listPages({ projectId: project.id, userId }),
    listAssets({ projectId: project.id, userId }),
  ]);
  const exportedAt = new Date().toISOString();
  const exportData = {
    assets,
    exportedAt,
    format: "orbit-web-builder-v1",
    pages,
    project: mapProject(project),
  };

  const { error } = await db
    .from("orbit_web_projects")
    .update({
      last_exported_at: exportedAt,
      status: "exported",
    })
    .eq("id", project.id)
    .eq("user_id", project.user_id);

  if (error) throw error;

  return {
    ...exportData,
    html: renderStaticHtml(exportData),
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

function renderText(value, fallback = "") {
  return escapeHtml(normalizeText(value, MAX_RENDER_TEXT_LENGTH) || fallback);
}

function getSectionText(section, keys, fallback = "") {
  const props = section?.props || {};
  const key = keys.find((item) => normalizeText(props[item], 500));

  return key ? props[key] : fallback;
}

function renderSection(section) {
  const type = section?.type || "text";
  const title = renderText(getSectionText(section, ["title", "heading", "label"]));
  const body = renderText(getSectionText(section, ["body", "content", "text"]));

  if (type === "image") {
    const src = renderText(getSectionText(section, ["src", "url", "imageUrl"]));
    const alt = renderText(getSectionText(section, ["alt", "altText"], title));

    return `<section data-section="${escapeHtml(type)}"><img src="${src}" alt="${alt}"><h2>${title}</h2><p>${body}</p></section>`;
  }

  if (type === "divider") {
    return '<hr data-section="divider">';
  }

  return `<section data-section="${escapeHtml(type)}"><h2>${title}</h2><p>${body}</p></section>`;
}

function renderPage(page) {
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const body = sections.map(renderSection).join("\n");

  return `<article data-page="${escapeHtml(page.path)}"><h1>${renderText(page.title)}</h1>${body}</article>`;
}

function renderStaticHtml({ pages, project }) {
  const pageTitle = renderText(project?.title, "ORBIT Web Builder Export");
  const description = renderText(project?.description, "");
  const body = (pages || []).map(renderPage).join("\n");

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <title>${pageTitle}</title>
</head>
<body>
${body}
</body>
</html>`;
}

module.exports = {
  createHttpError,
  createPage,
  createProject,
  deletePage,
  deleteProject,
  exportProject,
  getPage,
  getProject,
  listPages,
  listProjects,
  updatePage,
  updateProject,
};
