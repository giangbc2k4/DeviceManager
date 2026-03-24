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

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rollbackBy = await getAuthenticatedAdminEmail();
  if (!rollbackBy) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let currentStep = "Khởi tạo";

  try {
    currentStep = "Đọc dữ liệu rollback";
    const body = (await request.json()) as { version?: string };
    const version = body.version?.trim() ?? "";

    if (!version) {
      return NextResponse.json({ message: "Thiếu phiên bản" }, { status: 400 });
    }

    currentStep = "Đọc trạng thái hiện tại";
    const [manifest, currentVersionJson, latestBinary] = await Promise.all([
      readManifest(),
      readVersionJson(),
      getGithubFileBinary(LATEST_FIRMWARE_PATH),
    ]);
    const entry = manifest.firmwares.find((f) => f.version === version);

    if (!entry) {
      return NextResponse.json({ message: "Không tìm thấy phiên bản" }, { status: 404 });
    }

    // Save the current active latest binary before overwriting, so we can rollback back to it later.
    const currentVersion = currentVersionJson?.version?.trim() ?? manifest.active_version?.trim() ?? "";
    if (currentVersion && currentVersion !== version && latestBinary) {
      const currentArchivePath = firmwareRepoPath(currentVersion);
      currentStep = `Kiểm tra releases/v${currentVersion}/firmware.bin`;
      const currentArchiveSha = await getGithubFileSha(currentArchivePath);

      if (!currentArchiveSha) {
        currentStep = `Lưu phiên bản đang active → releases/v${currentVersion}/firmware.bin`;
        await putGithubFile(
          currentArchivePath,
          latestBinary.contentBase64,
          null,
          `archive: save current active firmware v${currentVersion} before rollback`,
        );

        if (!manifest.firmwares.find((f) => f.version === currentVersion)) {
          manifest.firmwares.push({
            version: currentVersion,
            size: 0,
            uploaded_at: new Date().toISOString(),
            ...(currentVersionJson?.note && { note: currentVersionJson.note }),
            ...(currentVersionJson?.uploaded_by && { uploaded_by: currentVersionJson.uploaded_by }),
          });
        }
      }
    }

    // Read the archived binary for this version
    currentStep = `Đọc releases/v${version}/firmware.bin`;
    const oldBinary = await getGithubFileBinary(firmwareRepoPath(version));
    if (!oldBinary) {
      return NextResponse.json(
        { message: "Không tìm thấy file .bin cho phiên bản này" },
        { status: 404 },
      );
    }

    // Overwrite releases/latest/ with the rolled-back binary
    currentStep = "Ghi releases/latest/firmware.bin";
    const latestSha = await getGithubFileSha(LATEST_FIRMWARE_PATH);
    await putGithubFile(
      LATEST_FIRMWARE_PATH,
      oldBinary.contentBase64,
      latestSha,
      `chore: rollback firmware to v${version}`,
    );

    // Update manifest + version.json in parallel
    currentStep = "Cập nhật version.json và releases/manifest.json";
    const rolledBackAt = new Date().toISOString();
    manifest.active_version = version;
    const targetEntry = manifest.firmwares.find((f) => f.version === version);
    if (targetEntry) {
      targetEntry.rolled_back_by = rollbackBy;
      targetEntry.rolled_back_at = rolledBackAt;
    }

    await Promise.all([
      writeManifest(manifest),
      writeVersionJson(version, entry.note ?? "", entry.uploaded_by ?? "", rollbackBy, rolledBackAt),
    ]);

    return NextResponse.json({
      message: `Đã rollback về phiên bản v${version}`,
      rollback_by: rollbackBy,
      rollback_at: rolledBackAt,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Rollback thất bại";
    return NextResponse.json(
      { message: `Thất bại tại bước "${currentStep}": ${detail}` },
      { status: 500 },
    );
  }
}
