import { NextResponse, type NextRequest } from "next/server";
import { searchConditions } from "@clinician/lib/data";

/**
 * Thin same-origin proxy for the ICD-10 condition typeahead. Keeps the bearer
 * token server-side (the client component only talks to this route).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const options = await searchConditions(q);
  return NextResponse.json({ options });
}
