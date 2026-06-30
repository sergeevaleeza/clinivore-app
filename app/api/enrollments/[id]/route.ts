import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { completeTreatment, markMissedTreatment } from "@/lib/enrollments";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, eventDate, note, newDate } = body;

    const enrollment = await prisma.treatmentEnrollment.findUnique({
      where: { id },
      include: { protocol: true, patient: true },
    });
    if (!enrollment) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });

    const actDate = eventDate ? new Date(eventDate) : new Date();

    if (action === "COMPLETED") {
      await completeTreatment(id, actDate, note ?? "Treatment completed.");
    } else if (action === "MISSED") {
      await markMissedTreatment(id, actDate, note ?? "Treatment missed.");
    } else if (action === "RESCHEDULE") {
      if (!newDate) return NextResponse.json({ error: "newDate required" }, { status: 400 });
      const reschedDate = new Date(newDate);

      await prisma.treatmentEnrollment.update({
        where: { id },
        data: { nextDueDate: reschedDate },
      });
      await prisma.treatmentEvent.create({
        data: {
          patientId: enrollment.patientId,
          enrollmentId: id,
          eventType: "RESCHEDULED",
          eventDate: new Date(),
          note: note ?? `Rescheduled to ${reschedDate.toLocaleDateString()}`,
        },
      });
      await logAudit({
        actorName: "Staff",
        action: "RESCHEDULE",
        entityType: "TreatmentEnrollment",
        entityId: id,
        metadata: { newDate: reschedDate, patientId: enrollment.patientId },
      });
    } else if (action === "UPDATE_STATUS") {
      await prisma.treatmentEnrollment.update({
        where: { id },
        data: { status: body.status },
      });
      await logAudit({
        actorName: "Staff",
        action: "UPDATE_ENROLLMENT_STATUS",
        entityType: "TreatmentEnrollment",
        entityId: id,
        metadata: { newStatus: body.status },
      });
    }

    const updated = await prisma.treatmentEnrollment.findUnique({
      where: { id },
      include: { protocol: true },
    });
    return NextResponse.json({ enrollment: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update enrollment" }, { status: 500 });
  }
}
