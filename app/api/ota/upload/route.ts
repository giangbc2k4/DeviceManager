import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import {
  firmwareRepoPath,
  getGithubFileSha,
  putGithubFile,
  readManifest,
  writeManifest,
} from "@/lib/ota-github";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const version = (formData.get("version") as string | null)?.trim() ?? "";

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
    const contentBase64 = Buffer.from(bytes).toString("base64");

    const repoPath = firmwareRepoPath(version);
    const existingSha = await getGithubFileSha(repoPath);
    await putGithubFile(
      repoPath,
      contentBase64,
      existingSha,
      `chore: upload firmware v${version}`,
    );

    const manifest = await readManifest();
    manifest.firmwares = manifest.firmwares.filter((f) => f.version !== version);
    manifest.firmwares.unshift({
      version,
      size: bytes.byteLength,
      uploaded_at: new Date().toISOString(),
    });
    await writeManifest(manifest);

    return NextResponse.json({ message: "Upload thành công", version });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Upload thất bại" },
      { status: 500 },
    );
  }
}
