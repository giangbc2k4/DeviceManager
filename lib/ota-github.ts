const OWNER = "giangbc2k4";
const REPO = "room-firmware";
const BRANCH = "master";
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
export const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/${BRANCH}`;
export const LATEST_FIRMWARE_PATH = "releases/latest/firmware.bin";

export type FirmwareEntry = {
  version: string;
  size: number;
  uploaded_at: string;
  note?: string;
  uploaded_by?: string;
  rolled_back_by?: string;
  rolled_back_at?: string;
};

export type OtaManifest = {
  active_version: string;
  firmwares: FirmwareEntry[];
};

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN environment variable");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

/** Returns { sha } for a file at `path` (works for binary/large files). Returns null if not found. */
export async function getGithubFileSha(path: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/contents/${encodeURI(path)}?ref=${BRANCH}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} on GET ${path}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

/** Reads a small text file from GitHub. Returns { sha, text } or null if not found. */
export async function getGithubFileText(path: string): Promise<{ sha: string; text: string } | null> {
  const res = await fetch(`${API_BASE}/contents/${encodeURI(path)}?ref=${BRANCH}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} on GET ${path}`);
  const data = (await res.json()) as { sha: string; content: string; encoding: string };
  const clean = (data.content ?? "").replace(/\s/g, "");
  const text = Buffer.from(clean, "base64").toString("utf-8");
  return { sha: data.sha, text };
}

/** Creates or updates a file on GitHub. Pass `sha` when updating an existing file. */
export async function putGithubFile(
  path: string,
  contentBase64: string,
  sha: string | null | undefined,
  message: string,
): Promise<void> {
  const body: Record<string, unknown> = { message, content: contentBase64, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_BASE}/contents/${encodeURI(path)}`, {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(`GitHub PUT ${path}: ${err.message ?? res.status}`);
  }
}

function isShaConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("expected") || msg.includes("is at") || msg.includes("does not match") || msg.includes("sha");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function putGithubFileWithShaRetry(
  path: string,
  contentBase64: string,
  message: string,
  maxRetries = 8,
): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const sha = await getGithubFileSha(path);
    try {
      await putGithubFile(path, contentBase64, sha, message);
      return;
    } catch (error) {
      const canRetry = isShaConflictError(error) && attempt < maxRetries;
      if (!canRetry) throw error;

      // Exponential-ish backoff to reduce collisions across concurrent requests.
      const backoffMs = Math.min(1200, 120 * (attempt + 1));
      await sleep(backoffMs);
    }
  }
}

/**
 * Gets the binary content of a GitHub file as base64.
 * Handles files > 1 MB via download_url fallback.
 * Returns null if not found.
 */
export async function getGithubFileBinary(
  path: string,
): Promise<{ sha: string; contentBase64: string } | null> {
  const res = await fetch(`${API_BASE}/contents/${encodeURI(path)}?ref=${BRANCH}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} on GET ${path}`);
  const data = (await res.json()) as {
    sha: string;
    content?: string;
    encoding?: string;
    download_url?: string;
  };
  if (data.content && data.encoding === "base64") {
    return { sha: data.sha, contentBase64: data.content.replace(/\s/g, "") };
  }
  if (data.download_url) {
    const binRes = await fetch(data.download_url);
    if (!binRes.ok) throw new Error(`Failed to download ${path}`);
    const bytes = await binRes.arrayBuffer();
    return { sha: data.sha, contentBase64: Buffer.from(bytes).toString("base64") };
  }
  throw new Error(`Cannot read binary content for ${path}`);
}

/** Deletes a file on GitHub. Requires the current SHA of the file. */
export async function deleteGithubFile(path: string, sha: string, message: string): Promise<void> {
  const res = await fetch(`${API_BASE}/contents/${encodeURI(path)}`, {
    method: "DELETE",
    headers: githubHeaders(),
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(`GitHub DELETE ${path}: ${err.message ?? res.status}`);
  }
}

// ─── Manifest helpers ────────────────────────────────────────────────────────

const MANIFEST_PATH = "releases/manifest.json";

export async function readManifest(): Promise<OtaManifest> {
  try {
    const file = await getGithubFileText(MANIFEST_PATH);
    if (!file) return { active_version: "", firmwares: [] };
    return JSON.parse(file.text) as OtaManifest;
  } catch {
    return { active_version: "", firmwares: [] };
  }
}

export async function writeManifest(manifest: OtaManifest): Promise<void> {
  const content = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8").toString("base64");
  await putGithubFileWithShaRetry(MANIFEST_PATH, content, "chore: update OTA manifest");
}

// ─── version.json helpers ─────────────────────────────────────────────────────

export type VersionJson = {
  version: string;
  url: string;
  mandatory: boolean;
  note: string;
  uploaded_by?: string;
  rolled_back_by?: string;
  rolled_back_at?: string;
};

export async function readVersionJson(): Promise<VersionJson | null> {
  const file = await getGithubFileText("version.json");
  if (!file) return null;
  try {
    return JSON.parse(file.text) as VersionJson;
  } catch {
    return null;
  }
}

export async function writeVersionJson(
  version: string,
  note = "",
  uploadedBy = "",
  rolledBackBy = "",
  rolledBackAt = "",
): Promise<void> {
  const data: VersionJson = {
    version,
    url: `${RAW_BASE}/${LATEST_FIRMWARE_PATH}`,
    mandatory: false,
    note,
    ...(uploadedBy && { uploaded_by: uploadedBy }),
    ...(rolledBackBy && { rolled_back_by: rolledBackBy }),
    ...(rolledBackAt && { rolled_back_at: rolledBackAt }),
  };
  const content = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString("base64");
  await putGithubFileWithShaRetry("version.json", content, `chore: activate firmware v${version}`);
}

/** Public raw download URL for a versioned firmware. */
export function firmwareRawUrl(version: string): string {
  return `${RAW_BASE}/releases/v${version}/firmware.bin`;
}

/** Path of the versioned firmware inside the repo. */
export function firmwareRepoPath(version: string): string {
  return `releases/v${version}/firmware.bin`;
}
