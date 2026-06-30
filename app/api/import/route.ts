import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateCsvRow, type CsvRow } from "@/lib/csvImport";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, filename } = body as { rows: Partial<CsvRow>[]; filename: string };

    if (!rows?.length) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const validated = rows.map((r, i) => validateCsvRow(r, i));
    const validRows = validated.filter((r) => r._valid);
    const invalidRows = validated.filter((r) => !r._valid);

    const batch = await prisma.importBatch.create({
      data: {
        filename: filename ?? "import.csv",
        rowCount: rows.length,
        status: "PENDING",
      },
    });

    let importedCount = 0;
    const errors: { row: number; errors: string[] }[] = invalidRows.map((r) => ({
      row: r._rowIndex,
      errors: r._errors,
    }));
    const missingLegalName: string[] = [];

    for (const row of validRows) {
      try {
        // Find protocol by name (case-insensitive)
        const protocol = await prisma.treatmentProtocol.findFirst({
          where: { name: { contains: row.treatment_name } },
        });

        // Upsert patient
        const patient = await prisma.patient.upsert({
          where: { internalId: row.internal_id },
          update: {
            displayName: row.display_name,
            providerName: row.provider_name,
            phoneOptional: row.phone_optional || null,
            emailOptional: row.email_optional || null,
            // Only update legal name if the CSV row provides it; don't overwrite existing value with null
            legalFirstName: row.legal_first_name?.trim() || undefined,
            legalLastName: row.legal_last_name?.trim() || undefined,
          },
          create: {
            displayName: row.display_name,
            internalId: row.internal_id,
            providerName: row.provider_name,
            phoneOptional: row.phone_optional || null,
            emailOptional: row.email_optional || null,
            legalFirstName: row.legal_first_name?.trim() || null,
            legalLastName: row.legal_last_name?.trim() || null,
          },
        });

        if (!row.legal_first_name?.trim() || !row.legal_last_name?.trim()) {
          missingLegalName.push(row.internal_id);
        }

        if (protocol) {
          // Check for existing active enrollment in this protocol
          const existingEnrollment = await prisma.treatmentEnrollment.findFirst({
            where: { patientId: patient.id, protocolId: protocol.id, status: "ACTIVE" },
          });

          if (!existingEnrollment) {
            await prisma.treatmentEnrollment.create({
              data: {
                patientId: patient.id,
                protocolId: protocol.id,
                startDate: row.last_treatment_date ? new Date(row.last_treatment_date) : new Date(),
                lastTreatmentDate: row.last_treatment_date ? new Date(row.last_treatment_date) : null,
                nextDueDate: row.next_due_date ? new Date(row.next_due_date) : null,
                notes: row.notes || null,
              },
            });
          } else {
            await prisma.treatmentEnrollment.update({
              where: { id: existingEnrollment.id },
              data: {
                lastTreatmentDate: row.last_treatment_date ? new Date(row.last_treatment_date) : existingEnrollment.lastTreatmentDate,
                nextDueDate: row.next_due_date ? new Date(row.next_due_date) : existingEnrollment.nextDueDate,
              },
            });
          }
        }

        importedCount++;
      } catch (rowErr) {
        console.error(`Row ${row._rowIndex} import error:`, rowErr);
        errors.push({ row: row._rowIndex, errors: ["Database error during import"] });
      }
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        importedCount,
        skippedCount: rows.length - importedCount,
        status: "COMPLETED",
      },
    });

    await logAudit({
      actorName: "Staff",
      action: "CSV_IMPORT",
      entityType: "ImportBatch",
      entityId: batch.id,
      metadata: { filename, rowCount: rows.length, importedCount },
    });

    return NextResponse.json({
      batchId: batch.id,
      rowCount: rows.length,
      importedCount,
      skippedCount: rows.length - importedCount,
      errors,
      warnings: missingLegalName.length > 0 ? [
        `${missingLegalName.length} patient(s) imported without legal name — Practice Fusion import matching will not work until corrected: ${missingLegalName.join(", ")}`,
      ] : [],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
