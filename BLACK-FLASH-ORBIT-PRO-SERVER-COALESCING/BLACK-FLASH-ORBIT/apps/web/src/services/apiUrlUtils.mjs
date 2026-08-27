export function normalizeApiPath(value) {
  return String(value || "").replace(/\/api(?:\/api)+(?=\/|$)/gi, "/api");
}

function isLocalhostHostname(hostname) {
  const cleanHostname = String(hostname || "").toLowerCase();

  return cleanHostname === "localhost" || cleanHostname === "127.0.0.1";
}

export function normalizeApiBaseUrl(value) {
  const cleanValue = String(value || "/api")
    .trim()
    .replace(/\/+$/, "");

  if (!cleanValue) return "/api";

  if (/^https?:\/\//i.test(cleanValue)) {
    const url = new URL(cleanValue);
    const pathname = url.pathname.replace(/\/+$/, "");

    if (isLocalhostHostname(url.hostname)) {
      url.hostname = "127.0.0.1";
    }

    url.pathname = normalizeApiPath(
      pathname && pathname !== "/" ? pathname : "/api",
    );

    return url.toString().replace(/\/+$/, "");
  }

  return normalizeApiPath(cleanValue);
}

export function getApiPathSuffix(cleanPath) {
  const normalizedPath = normalizeApiPath(cleanPath);

  if (normalizedPath === "/api") return "";
  if (normalizedPath.startsWith("/api/")) return normalizedPath.slice(4);

  return normalizedPath;
}

export function joinApiUrl(baseUrl, pathSuffix) {
  const cleanBaseUrl =
    normalizeApiPath(String(baseUrl || "/api").replace(/\/+$/, "")) || "/api";
  const cleanPathSuffix = String(pathSuffix || "");

  if (!cleanPathSuffix) return cleanBaseUrl;

  return normalizeApiPath(
    `${cleanBaseUrl}${
      cleanPathSuffix.startsWith("/") ? cleanPathSuffix : `/${cleanPathSuffix}`
    }`,
  );
}
