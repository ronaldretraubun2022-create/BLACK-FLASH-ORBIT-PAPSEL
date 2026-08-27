import { supabase } from "../lib/supabase";

const BACKUP_FILENAME_PREFIX = "black-flash-orbit-backup";

async function getAccessToken() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return accessToken;
}

async function requestBackup(path, options = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Backup request gagal dengan status ${response.status}.`,
    );
  }

  return payload;
}

export async function exportWorkspaceBackup() {
  const payload = await requestBackup("/api/backup/export");
  const backup = payload.data;

  if (!backup?.metadata) {
    throw new Error("Response backup tidak valid.");
  }

  downloadJson({
    data: backup,
    filename: createBackupFilename(backup.metadata.exportedAt),
  });

  return backup;
}

export async function importWorkspaceBackup(file) {
  if (!file) {
    throw new Error("Pilih file backup JSON terlebih dahulu.");
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    throw new Error("File backup harus berformat JSON.");
  }

  const text = await file.text();
  let backup;

  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("File backup bukan JSON valid.");
  }

  const payload = await requestBackup("/api/backup/import", {
    method: "POST",
    body: JSON.stringify(backup),
  });

  return payload.data;
}

function downloadJson({ data, filename }) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createBackupFilename(exportedAt) {
  const timestamp = exportedAt
    ? new Date(exportedAt).toISOString()
    : new Date().toISOString();

  return `${BACKUP_FILENAME_PREFIX}-${timestamp
    .slice(0, 19)
    .replace(/[:T]/g, "-")}.json`;
}
