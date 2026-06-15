import { NextResponse } from "next/server";

export type BulkPatientRow = {
  name: string;
  phone: string;
  channel: string;
};

export type BulkUploadResult = {
  imported: number;
  failed: Array<{ row: number; name: string; reason: string }>;
  patients: BulkPatientRow[];
};

export async function POST(request: Request) {
  let rows: BulkPatientRow[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: "rows array required" }, { status: 400 });
    }
    rows = body.rows;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const failed: BulkUploadResult["failed"] = [];
  const imported: BulkPatientRow[] = [];
  const VALID_CHANNELS = ["Campaign", "Referral", "Walk-in", "Call", "WhatsApp", "Web", "Other"];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // 1-indexed, +1 for header
    const name = row.name?.trim();
    const phone = row.phone?.toString().trim();
    const channel = row.channel?.trim() || "Other";

    if (!name) {
      failed.push({ row: rowNum, name: name || "(blank)", reason: "Name is required" });
      return;
    }
    if (!phone || !/^[+\d\s\-()]{7,15}$/.test(phone)) {
      failed.push({ row: rowNum, name, reason: `Invalid phone number: "${phone}"` });
      return;
    }
    if (channel && !VALID_CHANNELS.includes(channel)) {
      failed.push({ row: rowNum, name, reason: `Unknown channel "${channel}". Use: ${VALID_CHANNELS.join(", ")}` });
      return;
    }

    imported.push({ name, phone, channel });
  });

  // When core-api is available (NEXT_PUBLIC_CORE_API_URL is set), forward there.
  // For now, return the validated rows to the client to apply to the in-memory store.
  return NextResponse.json({
    imported: imported.length,
    failed,
    patients: imported
  } satisfies BulkUploadResult);
}
