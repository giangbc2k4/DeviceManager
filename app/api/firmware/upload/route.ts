import { NextResponse } from "next/server";

import { getAuthenticatedAdminEmail, isAuthenticated } from "@/lib/auth";
import {
  firmwareRepoPath,
  getGithubFileBinary,
  getGithubFileSha,
  LATEST_FIRMWARE_PATH,
  putGithubFile,
  readManifest,
  readVersionJson,
  writeManifest,
  writeVersionJson,
} from "@/lib/ota-github";

export const maxDuration = 60;
export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const uploaderEmail = await getAuthenticatedAdminEmail();
  if (!uploaderEmail) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let currentStep = "Khởi tạo";

  try {
    currentStep = "Đọc form data";
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const version = (formData.get("version") as string | null)?.trim() ?? "";
    const note = (formData.get("note") as string | null)?.trim() ?? "";

    if (!file || !version) {
      return NextResponse.json({ message: "Thiếu file hoặc phiên bản" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9._\-]+$/.test(version)) {
      return NextResponse.json(
        { message: "Phiên bản chỉ được chứa chữ, số, dấu chấm, gạch ngang" },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".bin")) {
      return NextResponse.json({ message: "Chỉ chấp nhận file .bin" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const newContentBase64 = Buffer.from(bytes).toString("base64");

    // ── Bước 1: Đọc trạng thái hiện tại từ GitHub ────────────────────────────
    currentStep = "Đọc trạng thái từ GitHub (version.json, manifest, latest binary)";
    const [currentVersionJson, manifest, latestBinary] = await Promise.all([
      readVersionJson(),
      readManifest(),
      getGithubFileBinary(LATEST_FIRMWARE_PATH),
    ]);

    const oldVersion = currentVersionJson?.version?.trim() ?? "";
    const shouldArchiveOld = !!oldVersion && oldVersion !== version && !!latestBinary;

    // ── Bước 2: Lưu trữ phiên bản CŨ (tuần tự, trước khi đè latest) ─────────
    let didArchive = false;
    if (shouldArchiveOld) {
      const archivePath = firmwareRepoPath(oldVersion);
      currentStep = `Kiểm tra releases/v${oldVersion}/firmware.bin`;
      const archiveSha = await getGithubFileSha(archivePath);

      if (!archiveSha) {
        currentStep = `Lưu trữ phiên bản cũ → releases/v${oldVersion}/firmware.bin`;
        await putGithubFile(
          archivePath,
          latestBinary!.contentBase64,
          null,
          `archive: save firmware v${oldVersion}`,
        );
        didArchive = true;

        if (!manifest.firmwares.find((f) => f.version === oldVersion)) {
          manifest.firmwares.push({
            version: oldVersion,
            size: 0,
            uploaded_at: new Date().toISOString(),
            ...(currentVersionJson?.note && { note: currentVersionJson.note }),
            ...(currentVersionJson?.uploaded_by && { uploaded_by: currentVersionJson.uploaded_by }),
          });
        }
      }
    }

    // ── Bước 3: Ghi firmware MỚI lên releases/latest/ ────────────────────────
    currentStep = `Ghi firmware v${version} → releases/latest/firmware.bin`;
    await putGithubFile(
      LATEST_FIRMWARE_PATH,
      newContentBase64,
      latestBinary?.sha ?? null,
      `chore: release firmware v${version}`,
    );

    // ── Bước 4: Cập nhật manifest + version.json ─────────────────────────────
    manifest.active_version = version;
    manifest.firmwares = manifest.firmwares.filter((f) => f.version !== version);
    manifest.firmwares.unshift({
      version,
      size: bytes.byteLength,
      uploaded_at: new Date().toISOString(),
      ...(note && { note }),
      uploaded_by: uploaderEmail,
    });

    currentStep = "Cập nhật version.json và releases/manifest.json";
    await Promise.all([
      writeVersionJson(version, note, uploaderEmail),
      writeManifest(manifest),
    ]);

    const archivedMsg = didArchive ? ` (đã lưu bản cũ v${oldVersion})` : "";
    return NextResponse.json({
      message: `Release v${version} thành công!${archivedMsg}`,
      version,
      uploaded_by: uploaderEmail,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Lỗi không xác định";
    return NextResponse.json(
      { message: `Thất bại tại bước "${currentStep}": ${detail}` },
      { status: 500 },
    );
  }
}

