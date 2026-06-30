import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parsePfAppointmentRow, matchPatientByName } from "@/lib/csvImport";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, filename } = body as { rows: Record<string, string>[]; filename: string };

    if (!rows?.length) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const parsed = rows.map((r, i) => parsePfAppointmentRow(r, i + 1));
    const validRows = parsed.filter((r) => r._valid);

    const patients = await prisma.patient.findMany({
      where: { isActive: true },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: { protocol: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const candidatePool = patients.map((p) => ({ id: p.id, displayName: p.displayName }));

    type NormalizedStatus = "completed" | "no_show" | "cancelled" | "rescheduled" | "unknown";
    type SuggestedAction = "mark_completed" | "mark_missed" | "ignore";

    interface CandidateEvent {
      rowIndex: number;
      patientId: string;
      patientName: string;
      enrollmentId: string;
      protocolName: string;
      apptDate: string;
      apptType: string;
      apptStatus: string;
      normalizedStatus: NormalizedStatus;
      suggestedAction: SuggestedAction;
      defaultChecked: boolean;
      matchConfidence: "exact" | "fuzzy";
    }

    const candidateEvents: CandidateEvent[] = [];
    const matchedNoProtocol = new Map<string, { patientId: string; patientName: string; count: number }>();
    const unmatched: Array<{ patientName: string; dob: string; apptDate: string; rowIndex: number }> = [];

    // Track all appts per enrollment so we can pick the most-recent completed one
    const enrollmentApptMap = new Map<string, { rowIndex: number; date: Date }[]>();

    for (const row of validRows) {
      if (row.normalizedStatus === "cancelled" || row.normalizedStatus === "unknown") {
        continue;
      }

      const match = matchPatientByName(row.patientName, candidatePool);

      if (!match.patient) {
        unmatched.push({
          patientName: row.patientName,
          dob: row.dob,
          apptDate: row.parsedDate?.toISOString() ?? row.dateTime,
          rowIndex: row._rowIndex,
        });
        continue;
      }

      const patient = patients.find((p) => p.id === match.patient!.id)!;
      const activeEnrollments = patient.enrollments;

      if (!activeEnrollments.length) {
        const existing = matchedNoProtocol.get(patient.id);
        if (existing) existing.count++;
        else matchedNoProtocol.set(patient.id, { patientId: patient.id, patientName: patient.displayName, count: 1 });
        continue;
      }

      const enrollment = activeEnrollments[0];
      const suggestedAction: SuggestedAction =
        row.normalizedStatus === "completed" ? "mark_completed" :
        row.normalizedStatus === "no_show" ? "mark_missed" : "ignore";

      if (suggestedAction === "ignore") continue;

      if (row.normalizedStatus === "completed") {
        const existing = enrollmentApptMap.get(enrollment.id) ?? [];
        existing.push({ rowIndex: row._rowIndex, date: row.parsedDate ?? new Date(0) });
        enrollmentApptMap.set(enrollment.id, existing);
      }

      candidateEvents.push({
        rowIndex: row._rowIndex,
        patientId: patient.id,
        patientName: patient.displayName,
        enrollmentId: enrollment.id,
        protocolName: enrollment.protocol.name,
        apptDate: row.parsedDate?.toISOString() ?? row.dateTime,
        apptType: row.apptType,
        apptStatus: row.apptStatus,
        normalizedStatus: row.normalizedStatus as NormalizedStatus,
        suggestedAction,
        defaultChecked: false,
        matchConfidence: match.confidence as "exact" | "fuzzy",
      });
    }

    // Pre-check only the most recent completed appointment per enrollment
    for (const [enrollmentId, appts] of enrollmentApptMap.entries()) {
      if (!appts.length) continue;
      const mostRecent = appts.reduce((best, a) => (a.date > best.date ? a : best));
      const event = candidateEvents.find(
        (e) => e.enrollmentId === enrollmentId && e.rowIndex === mostRecent.rowIndex
      );
      if (event) event.defaultChecked = true;
    }

    await logAudit({
      actorName: "Staff",
      action: "PF_APPOINTMENT_PREVIEW",
      entityType: "ImportBatch",
      entityId: `pf-preview-${Date.now()}`,
      metadata: { filename, rowCount: rows.length },
    });

    return NextResponse.json({
      summary: {
        totalRows: rows.length,
        matchedWithProtocol: candidateEvents.length,
        matchedNoProtocol: matchedNoProtocol.size,
        unmatched: unmatched.length,
        candidateCompletedEvents: candidateEvents.filter((e) => e.suggestedAction === "mark_completed").length,
        candidateMissedEvents: candidateEvents.filter((e) => e.suggestedAction === "mark_missed").length,
      },
      candidateEvents,
      matchedNoProtocol: Array.from(matchedNoProtocol.values()).map((v) => ({
        patientId: v.patientId,
        patientName: v.patientName,
        apptCount: v.count,
      })),
      unmatched,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}
