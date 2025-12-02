import { NextResponse } from "next/server";
import { getLibraryItems } from "@/lib/library/catalog";

/**
 * GET /api/library
 *
 * Returns the current Library catalog as a JSON array of items.
 * Backed by data/library/catalog.v1.json via lib/library/catalog.ts.
 */
export async function GET() {
  try {
    const items = getLibraryItems();
    return NextResponse.json(items);
  } catch (error) {
    console.error("[/api/library] Failed to load Library catalog", error);
    return NextResponse.json(
      { error: { message: "Failed to load Library catalog" } },
      { status: 500 }
    );
  }
}
