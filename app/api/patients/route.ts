import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const patients = await prisma.patient.findMany({
      where: {
        isActive: activeOnly ? true : undefined,
        OR: search
          ? [
              { displayName: { contains: search } },
              { internalId: { contains: search } },
              { providerName: { contains: search } },
            ]
          : undefined,
      },
      include: {
        enrollments: {
          where: { status: { not: "DISCONTINUED" } },
          include: {
            protocol: true,
            outreachTasks: { where: { status: { in: ["OPEN", "VOICEMAIL_LEFT"] } } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json({ patients });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { legalFirstName, legalLastName, displayName, internalId, providerName, phoneOptional, emailOptional } = body;

    if (!displayName?.trim() || !internalId?.trim() || !providerName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!legalFirstName?.trim() || !legalLastName?.trim()) {
      return NextResponse.json({ error: "Legal first and last name are required" }, { status: 400 });
    }

    const existing = await prisma.patient.findUnique({ where: { internalId } });
    if (existing) {
      return NextResponse.json({ error: "Patient with this internal ID already exists" }, { status: 409 });
    }

    const patient = await prisma.patient.create({
      data: {
        legalFirstName: legalFirstName.trim(),
        legalLastName: legalLastName.trim(),
        displayName: displayName.trim(),
        internalId: internalId.trim(),
        providerName: providerName.trim(),
        phoneOptional: phoneOptional || null,
        emailOptional: emailOptional || null,
      },
    });

    await logAudit({
      actorName: "Staff",
      action: "CREATE_PATIENT",
      entityType: "Patient",
      entityId: patient.id,
      metadata: { internalId: patient.internalId, displayName: patient.displayName },
    });

    return NextResponse.json({ patient }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
  }
}
