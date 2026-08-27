const fs = require("fs/promises");
const path = require("path");
const fg = require("fast-glob");

const ROOT = process.cwd();

async function exists(filePath) {
  try {
    await fs.access(path.join(ROOT, filePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(path.join(ROOT, filePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function finding(id, severity, message, target) {
  return { id, severity, message, target };
}

async function runWorkspaceAudit() {
  const findings = [];

  const packageJson = await readJson("package.json");

  if (!packageJson) {
    findings.push(
      finding(
        "AUD-001",
        "high",
        "package.json tidak ditemukan atau rusak.",
        "package.json",
      ),
    );
  }

  if (!(await exists("src"))) {
    findings.push(
      finding("AUD-002", "medium", "Folder src tidak ditemukan.", "src/"),
    );
  }

  if (!(await exists("server"))) {
    findings.push(
      finding("AUD-003", "medium", "Folder server tidak ditemukan.", "server/"),
    );
  }

  if (!(await exists(".env.example"))) {
    findings.push(
      finding(
        "AUD-004",
        "low",
        ".env.example belum tersedia untuk dokumentasi environment.",
        ".env.example",
      ),
    );
  }

  if (!(await exists("supabase"))) {
    findings.push(
      finding(
        "AUD-005",
        "low",
        "Folder supabase belum tersedia untuk migrasi/database config.",
        "supabase/",
      ),
    );
  }

  if (packageJson) {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (!deps.express) {
      findings.push(
        finding(
          "AUD-006",
          "medium",
          "Dependency express belum terdeteksi.",
          "package.json",
        ),
      );
    }

    if (!deps["@supabase/supabase-js"]) {
      findings.push(
        finding(
          "AUD-007",
          "medium",
          "Dependency @supabase/supabase-js belum terdeteksi.",
          "package.json",
        ),
      );
    }

    if (!deps.helmet) {
      findings.push(
        finding(
          "AUD-008",
          "low",
          "Helmet belum terdeteksi untuk secure headers.",
          "package.json",
        ),
      );
    }

    if (!deps["express-rate-limit"]) {
      findings.push(
        finding(
          "AUD-009",
          "low",
          "express-rate-limit belum terdeteksi untuk abuse protection.",
          "package.json",
        ),
      );
    }
  }

  const sourceFiles = await fg(
    ["src/**/*.{js,jsx,ts,tsx}", "server/**/*.{js,ts}"],
    {
      cwd: ROOT,
      ignore: ["node_modules/**", "dist/**", "build/**"],
    },
  );

  if (sourceFiles.length === 0) {
    findings.push(
      finding(
        "AUD-010",
        "medium",
        "Tidak ada source file terdeteksi.",
        "src/ server/",
      ),
    );
  }

  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;

  const penalty = high * 18 + medium * 8 + low * 3;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const status = score >= 90 ? "READY" : score >= 75 ? "SYNCED" : "ACTIVE";

  return {
    reportCode: `RPT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    type: "workspace-audit",
    score,
    status,
    findings,
    summary: {
      scannedFiles: sourceFiles.length,
      high,
      medium,
      low,
      totalFindings: findings.length,
      checkedAt: new Date().toISOString(),
    },
  };
}

module.exports = { runWorkspaceAudit };
