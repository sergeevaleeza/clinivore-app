import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { completeTreatment, markMissedTreatment } from "@/lib/enrollments";

export async function POST(req: NextRequest) {
  try {
    const { filename, confirmedEvents } = (await req.json()) as {
      filename: string;
      confirmedEvents: Array<{
        enrollmentId: string;
        apptDate: string;
        normalizedStatus: "completed" | "no_show";
      }>;
    };

    if (!confirmedEvents?.length) {
      return NextResponse.json({ error: "No events to confirm" }, { status: 400 });
    }

    let completedCount = 0;
    let missedCount = 0;

    for (const event of confirmedEvents) {
      const date = new Date(event.apptDate);
      if (event.normalizedStatus === "completed") {
        await completeTreatment(
          event.enrollmentId,
          date,
          "Treatment completed — recorded via Practice Fusion appointment import."
        );
        completedCount++;
      } else if (event.normalizedStatus === "no_show") {
        await markMissedTreatment(
          event.enrollmentId,
          date,
          "Missed appointment — flagged via Practice Fusion appointment import."
        );
        missedCount++;
      }
    }

    const batch = await prisma.importBatch.create({
      data: {
        filename,
        rowCount: confirmedEvents.length,
        importedCount: completedCount + missedCount,
        skippedCount: 0,
        status: "COMPLETED",
      },
    });

    await logAudit({
      actorName: "Staff",
      action: "PF_APPOINTMENT_IMPORT_CONFIRMED",
      entityType: "ImportBatch",
      entityId: batch.id,
      metadata: { filename, completedCount, missedCount },
    });

    return NextResponse.json({
      success: true,
      eventsCreated: completedCount + missedCount,
      outreachTasksCreated: missedCount,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Confirm failed" }, { status: 500 });
  }
}
