import { NextResponse } from "next/server";
import {
  getPolicyRates,
  updatePolicyRate,
  type PolicyRateId,
} from "@/lib/policy-rates";

export const dynamic = "force-dynamic";

function isPolicyRateId(value: unknown): value is PolicyRateId {
  return value === "us" || value === "korea";
}

export async function GET() {
  const rates = await getPolicyRates();

  return NextResponse.json({ rates });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;
    const value = typeof body?.value === "string" ? body.value : "";
    const reason = typeof body?.reason === "string" ? body.reason : "";

    if (!isPolicyRateId(id)) {
      return NextResponse.json(
        { error: "수정할 기준금리를 찾지 못했습니다." },
        { status: 400 },
      );
    }

    const rates = await updatePolicyRate(id, value, reason);

    return NextResponse.json({ rates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
    const status = message.includes("저장소") ? 503 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
