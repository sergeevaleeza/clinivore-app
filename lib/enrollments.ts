import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function completeTreatment(
  enrollmentId: string,
  date: Date,
  note = "Treatment completed."
): Promise<void> {
  const enrollment = await prisma.treatmentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { protocol: true },
  });
  if (!enrollment) throw new Error(`Enrollment not found: ${enrollmentId}`);

  const nextDue = new Date(date);
  nextDue.setDate(nextDue.getDate() + enrollment.protocol.defaultIntervalDays);

  await prisma.treatmentEnrollment.update({
    where: { id: enrollmentId },
    data: { lastTreatmentDate: date, nextDueDate: nextDue },
  });
  await prisma.treatmentEvent.create({
    data: {
      patientId: enrollment.patientId,
      enrollmentId,
      eventType: "COMPLETED",
      eventDate: date,
      note,
    },
  });
  await logAudit({
    actorName: "Staff",
    action: "MARK_COMPLETED",
    entityType: "TreatmentEnrollment",
    entityId: enrollmentId,
    metadata: { patientId: enrollment.patientId, protocol: enrollment.protocol.name, date },
  });
}

export async function markMissedTreatment(
  enrollmentId: string,
  date: Date,
  note = "Treatment missed."
): Promise<void> {
  const enrollment = await prisma.treatmentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { protocol: true },
  });
  if (!enrollment) throw new Error(`Enrollment not found: ${enrollmentId}`);

  await prisma.treatmentEvent.create({
    data: {
      patientId: enrollment.patientId,
      enrollmentId,
      eventType: "MISSED",
      eventDate: date,
      note,
    },
  });
  await prisma.outreachTask.create({
    data: {
      patientId: enrollment.patientId,
      enrollmentId,
      reason: `Missed ${enrollment.protocol.name} treatment`,
      status: "OPEN",
      priority: "HIGH",
      dueDate: new Date(),
    },
  });
  await logAudit({
    actorName: "Staff",
    action: "MARK_MISSED",
    entityType: "TreatmentEnrollment",
    entityId: enrollmentId,
    metadata: { patientId: enrollment.patientId, protocol: enrollment.protocol.name },
  });
}
