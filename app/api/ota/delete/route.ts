import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import {
  deleteGithubFile,
  firmwareRepoPath,
  getGithubFileSha,
  readManifest,
  writeManifest,
} from "@/lib/ota-github";

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let currentStep = "Khởi tạo";

  try {
    currentStep = "Đọc dữ liệu xóa";
    const body = (await request.json()) as { version?: string };
    const version = body.version?.trim() ?? "";

    if (!version) {
      return NextResponse.json({ message: "Thiếu phiên bản" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9._\-]+$/.test(version)) {
      return NextResponse.json(
        { message: "Phiên bản không hợp lệ" },
        { status: 400 },
      );
    }

    currentStep = "Đọc releases/manifest.json";
    const manifest = await readManifest();
    const exists = manifest.firmwares.some((f) => f.version === version);

    if (!exists) {
      return NextResponse.json({ message: "Không tìm thấy phiên bản" }, { status: 404 });
    }

    if (manifest.active_version === version) {
      return NextResponse.json(
        { message: "Không thể xóa phiên bản đang được dùng" },
        { status: 409 },
      );
    }

    // Delete the firmware file from GitHub
    currentStep = `Xóa releases/v${version}/firmware.bin`;
    const repoPath = firmwareRepoPath(version);
    const sha = await getGithubFileSha(repoPath);
    if (sha) {
      await deleteGithubFile(repoPath, sha, `chore: delete firmware v${version}`);
    }

    currentStep = "Cập nhật releases/manifest.json";
    manifest.firmwares = manifest.firmwares.filter((f) => f.version !== version);
    await writeManifest(manifest);

    return NextResponse.json({ message: `Đã xóa firmware v${version}` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Xóa thất bại";
    return NextResponse.json(
      { message: `Thất bại tại bước "${currentStep}": ${detail}` },
      { status: 500 },
    );
  }
}
