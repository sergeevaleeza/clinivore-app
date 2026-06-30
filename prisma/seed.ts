import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TODAY = new Date();
TODAY.setHours(9, 0, 0, 0);

function daysAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("🌱 Seeding Clinivore database...");

  // ── Clean up ──────────────────────────────────────────────
  await prisma.auditLog.deleteMany();
  await prisma.aiDraft.deleteMany();
  await prisma.outreachTask.deleteMany();
  await prisma.treatmentEvent.deleteMany();
  await prisma.treatmentEnrollment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.treatmentProtocol.deleteMany();
  await prisma.user.deleteMany();
  await prisma.importBatch.deleteMany();

  // ── Users ─────────────────────────────────────────────────
  // Dev-only credentials: password123 for all test accounts
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.createMany({
    data: [
      { name: "Admin User", email: "admin@clinivore.local", role: "ADMIN", passwordHash },
      { name: "Dr. Levinson", email: "levinson@clinivore.local", role: "PROVIDER", passwordHash },
      { name: "Dr. Patel", email: "patel@clinivore.local", role: "PROVIDER", passwordHash },
      { name: "Office Staff", email: "demo@clinivore.com", role: "STAFF", passwordHash },
    ],
  });

  // ── Treatment Protocols ───────────────────────────────────
  const vivitrol = await prisma.treatmentProtocol.create({
    data: {
      name: "Vivitrol",
      category: "Addiction Medicine",
      defaultIntervalDays: 28,
      dueSoonDays: 7,
      overdueAfterDays: 3,
      escalationAfterDays: 7,
      description: "Monthly naltrexone injection for opioid or alcohol use disorder.",
      isBuiltIn: true,
    },
  });

  const sublocade = await prisma.treatmentProtocol.create({
    data: {
      name: "Sublocade",
      category: "Addiction Medicine",
      defaultIntervalDays: 30,
      dueSoonDays: 7,
      overdueAfterDays: 3,
      escalationAfterDays: 7,
      description: "Monthly buprenorphine extended-release SQ injection.",
      isBuiltIn: true,
    },
  });

  const invegaSustenna = await prisma.treatmentProtocol.create({
    data: {
      name: "Invega Sustenna",
      category: "Schizophrenia",
      defaultIntervalDays: 30,
      dueSoonDays: 10,
      overdueAfterDays: 7,
      escalationAfterDays: 14,
      description: "Monthly paliperidone palmitate LAI for schizophrenia or schizoaffective disorder.",
      isBuiltIn: true,
    },
  });

  const invegaTrinza = await prisma.treatmentProtocol.create({
    data: {
      name: "Invega Trinza",
      category: "Schizophrenia",
      defaultIntervalDays: 90,
      dueSoonDays: 14,
      overdueAfterDays: 7,
      escalationAfterDays: 14,
      description: "Every-3-months paliperidone palmitate LAI.",
      isBuiltIn: true,
    },
  });

  const abilifyMaintena = await prisma.treatmentProtocol.create({
    data: {
      name: "Abilify Maintena",
      category: "Schizophrenia",
      defaultIntervalDays: 30,
      dueSoonDays: 10,
      overdueAfterDays: 7,
      escalationAfterDays: 14,
      description: "Monthly aripiprazole LAI for schizophrenia or bipolar I disorder.",
      isBuiltIn: true,
    },
  });

  const aristada = await prisma.treatmentProtocol.create({
    data: {
      name: "Aristada",
      category: "Schizophrenia",
      defaultIntervalDays: 30,
      dueSoonDays: 10,
      overdueAfterDays: 7,
      escalationAfterDays: 14,
      description: "Monthly aripiprazole lauroxil LAI (also available as 6-week or 2-month dosing).",
      isBuiltIn: true,
    },
  });

  const ketamineInduction = await prisma.treatmentProtocol.create({
    data: {
      name: "Ketamine Induction",
      category: "Ketamine",
      defaultIntervalDays: 3,
      dueSoonDays: 1,
      overdueAfterDays: 1,
      escalationAfterDays: 3,
      description: "Ketamine induction series (typically 6 infusions, 2–3× per week).",
      isBuiltIn: true,
    },
  });

  const ketamineMaintenance = await prisma.treatmentProtocol.create({
    data: {
      name: "Ketamine Maintenance",
      category: "Ketamine",
      defaultIntervalDays: 28,
      dueSoonDays: 7,
      overdueAfterDays: 7,
      escalationAfterDays: 14,
      description: "Ketamine maintenance infusions (typically monthly after induction).",
      isBuiltIn: true,
    },
  });

  const spravato = await prisma.treatmentProtocol.create({
    data: {
      name: "Spravato",
      category: "Spravato",
      defaultIntervalDays: 7,
      dueSoonDays: 2,
      overdueAfterDays: 1,
      escalationAfterDays: 3,
      description: "Esketamine nasal spray (REMS program); in-office administration required.",
      isBuiltIn: true,
    },
  });

  // ── Patients + Enrollments ────────────────────────────────

  // 1. HIGH PRIORITY — Vivitrol, 10+ days overdue
  const p1 = await prisma.patient.create({
    data: { displayName: "J. Doe", internalId: "PF-10294", providerName: "Dr. Levinson", phoneOptional: "555-0110", emailOptional: "jdoe@example.com" },
  });
  const e1 = await prisma.treatmentEnrollment.create({
    data: { patientId: p1.id, protocolId: vivitrol.id, startDate: daysAgo(120), lastTreatmentDate: daysAgo(40), nextDueDate: daysAgo(12), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p1.id, enrollmentId: e1.id, eventType: "COMPLETED", eventDate: daysAgo(68), note: "Vivitrol injection given. Tolerated well." },
    { patientId: p1.id, enrollmentId: e1.id, eventType: "COMPLETED", eventDate: daysAgo(40), note: "Monthly injection completed." },
    { patientId: p1.id, enrollmentId: e1.id, eventType: "MISSED", eventDate: daysAgo(12), note: "Patient did not arrive for scheduled appointment." },
    { patientId: p1.id, enrollmentId: e1.id, eventType: "RESCHEDULED", eventDate: daysAgo(11), note: "Voicemail left. No callback." },
  ]});
  await prisma.outreachTask.create({
    data: { patientId: p1.id, enrollmentId: e1.id, reason: "Missed Vivitrol injection — 12 days overdue", status: "VOICEMAIL_LEFT", priority: "URGENT", dueDate: daysAgo(11), lastAttemptAt: daysAgo(9), outcomeNote: "Voicemail left twice, no response" },
  });

  // 2. HIGH PRIORITY — Sublocade, 9 days overdue
  const p2 = await prisma.patient.create({
    data: { displayName: "A. Kim", internalId: "PF-10388", providerName: "Dr. Patel", phoneOptional: "555-0122" },
  });
  const e2 = await prisma.treatmentEnrollment.create({
    data: { patientId: p2.id, protocolId: sublocade.id, startDate: daysAgo(100), lastTreatmentDate: daysAgo(39), nextDueDate: daysAgo(9), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p2.id, enrollmentId: e2.id, eventType: "COMPLETED", eventDate: daysAgo(70), note: "Sublocade 300mg administered." },
    { patientId: p2.id, enrollmentId: e2.id, eventType: "COMPLETED", eventDate: daysAgo(39), note: "Monthly injection. Patient stable." },
    { patientId: p2.id, enrollmentId: e2.id, eventType: "MISSED", eventDate: daysAgo(9), note: "No-show." },
  ]});
  await prisma.outreachTask.create({
    data: { patientId: p2.id, enrollmentId: e2.id, reason: "Missed Sublocade injection", status: "OPEN", priority: "URGENT", dueDate: daysAgo(8) },
  });

  // 3. OVERDUE — Invega Sustenna, 4 days overdue
  const p3 = await prisma.patient.create({
    data: { displayName: "M. Reyes", internalId: "PF-10318", providerName: "Dr. Levinson", phoneOptional: "555-0131" },
  });
  const e3 = await prisma.treatmentEnrollment.create({
    data: { patientId: p3.id, protocolId: invegaSustenna.id, startDate: daysAgo(90), lastTreatmentDate: daysAgo(34), nextDueDate: daysAgo(4), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p3.id, enrollmentId: e3.id, eventType: "COMPLETED", eventDate: daysAgo(64), note: "Invega Sustenna 156mg IM." },
    { patientId: p3.id, enrollmentId: e3.id, eventType: "COMPLETED", eventDate: daysAgo(34), note: "Monthly injection administered." },
    { patientId: p3.id, enrollmentId: e3.id, eventType: "MISSED", eventDate: daysAgo(4), note: "Did not show." },
  ]});
  await prisma.outreachTask.create({
    data: { patientId: p3.id, enrollmentId: e3.id, reason: "Overdue Invega Sustenna injection", status: "OPEN", priority: "HIGH", dueDate: daysAgo(3) },
  });

  // 4. OVERDUE — Abilify Maintena, 5 days overdue
  const p4 = await prisma.patient.create({
    data: { displayName: "T. Park", internalId: "PF-10421", providerName: "Dr. Patel", phoneOptional: "555-0143", emailOptional: "tpark@example.com" },
  });
  const e4 = await prisma.treatmentEnrollment.create({
    data: { patientId: p4.id, protocolId: abilifyMaintena.id, startDate: daysAgo(95), lastTreatmentDate: daysAgo(35), nextDueDate: daysAgo(5), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p4.id, enrollmentId: e4.id, eventType: "COMPLETED", eventDate: daysAgo(65), note: "Abilify Maintena 400mg IM given." },
    { patientId: p4.id, enrollmentId: e4.id, eventType: "COMPLETED", eventDate: daysAgo(35), note: "Injection administered without incident." },
    { patientId: p4.id, enrollmentId: e4.id, eventType: "MISSED", eventDate: daysAgo(5), note: "Patient called to cancel." },
    { patientId: p4.id, enrollmentId: e4.id, eventType: "RESCHEDULED", eventDate: daysAgo(4), note: "Staff reached out. Patient said they would come in." },
  ]});
  await prisma.outreachTask.create({
    data: { patientId: p4.id, enrollmentId: e4.id, reason: "Missed Abilify Maintena", status: "CONTACTED", priority: "HIGH", lastAttemptAt: daysAgo(4), outcomeNote: "Patient said will reschedule" },
  });

  // 5. DUE TODAY — Invega Trinza
  const p5 = await prisma.patient.create({
    data: { displayName: "R. Morales", internalId: "PF-10377", providerName: "Dr. Levinson", phoneOptional: "555-0155" },
  });
  const e5 = await prisma.treatmentEnrollment.create({
    data: { patientId: p5.id, protocolId: invegaTrinza.id, startDate: daysAgo(180), lastTreatmentDate: daysAgo(90), nextDueDate: TODAY, status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p5.id, enrollmentId: e5.id, eventType: "COMPLETED", eventDate: daysAgo(180), note: "Invega Trinza initiation injection." },
    { patientId: p5.id, enrollmentId: e5.id, eventType: "COMPLETED", eventDate: daysAgo(90), note: "Quarterly injection completed." },
  ]});

  // 6. DUE TODAY — Spravato
  const p6 = await prisma.patient.create({
    data: { displayName: "L. Chen", internalId: "PF-10512", providerName: "Dr. Patel", phoneOptional: "555-0166", emailOptional: "lchen@example.com" },
  });
  const e6 = await prisma.treatmentEnrollment.create({
    data: { patientId: p6.id, protocolId: spravato.id, startDate: daysAgo(56), lastTreatmentDate: daysAgo(7), nextDueDate: TODAY, status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p6.id, enrollmentId: e6.id, eventType: "COMPLETED", eventDate: daysAgo(28), note: "Spravato 56mg — monitoring completed." },
    { patientId: p6.id, enrollmentId: e6.id, eventType: "COMPLETED", eventDate: daysAgo(14), note: "Spravato 84mg — tolerating well." },
    { patientId: p6.id, enrollmentId: e6.id, eventType: "COMPLETED", eventDate: daysAgo(7), note: "Spravato 84mg. Patient reported mood improvement." },
  ]});

  // 7. DUE SOON — Ketamine Induction (in 2 days)
  const p7 = await prisma.patient.create({
    data: { displayName: "S. Pham", internalId: "PF-10301", providerName: "Dr. Patel", phoneOptional: "555-0177" },
  });
  const e7 = await prisma.treatmentEnrollment.create({
    data: { patientId: p7.id, protocolId: ketamineInduction.id, startDate: daysAgo(10), lastTreatmentDate: daysAgo(3), nextDueDate: daysFromNow(0), status: "ACTIVE", notes: "Induction series — session 4 of 6" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p7.id, enrollmentId: e7.id, eventType: "COMPLETED", eventDate: daysAgo(10), note: "Session 1 of 6. No adverse events." },
    { patientId: p7.id, enrollmentId: e7.id, eventType: "COMPLETED", eventDate: daysAgo(7), note: "Session 2 of 6. Mild dissociation, resolved." },
    { patientId: p7.id, enrollmentId: e7.id, eventType: "COMPLETED", eventDate: daysAgo(3), note: "Session 3 of 6. Patient on track." },
  ]});

  // 8. DUE SOON — Vivitrol in 4 days
  const p8 = await prisma.patient.create({
    data: { displayName: "T. Walsh", internalId: "PF-10355", providerName: "Dr. Levinson", phoneOptional: "555-0188" },
  });
  const e8 = await prisma.treatmentEnrollment.create({
    data: { patientId: p8.id, protocolId: vivitrol.id, startDate: daysAgo(84), lastTreatmentDate: daysAgo(24), nextDueDate: daysFromNow(4), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p8.id, enrollmentId: e8.id, eventType: "COMPLETED", eventDate: daysAgo(80), note: "Vivitrol injection. Reports 30 days sobriety." },
    { patientId: p8.id, enrollmentId: e8.id, eventType: "COMPLETED", eventDate: daysAgo(52), note: "Monthly injection. Reports 60 days sobriety." },
    { patientId: p8.id, enrollmentId: e8.id, eventType: "COMPLETED", eventDate: daysAgo(24), note: "Patient continues to do well." },
  ]});

  // 9. DUE SOON — Sublocade in 6 days
  const p9 = await prisma.patient.create({
    data: { displayName: "D. Okafor", internalId: "PF-10466", providerName: "Dr. Patel", emailOptional: "dokafor@example.com" },
  });
  const e9 = await prisma.treatmentEnrollment.create({
    data: { patientId: p9.id, protocolId: sublocade.id, startDate: daysAgo(90), lastTreatmentDate: daysAgo(24), nextDueDate: daysFromNow(6), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p9.id, enrollmentId: e9.id, eventType: "COMPLETED", eventDate: daysAgo(54), note: "Sublocade injection administered." },
    { patientId: p9.id, enrollmentId: e9.id, eventType: "COMPLETED", eventDate: daysAgo(24), note: "Monthly. Patient stable and compliant." },
  ]});

  // 10. DUE SOON — Aristada in 5 days
  const p10 = await prisma.patient.create({
    data: { displayName: "C. Mbanaso", internalId: "PF-10533", providerName: "Dr. Levinson", phoneOptional: "555-0199" },
  });
  const e10 = await prisma.treatmentEnrollment.create({
    data: { patientId: p10.id, protocolId: aristada.id, startDate: daysAgo(65), lastTreatmentDate: daysAgo(25), nextDueDate: daysFromNow(5), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p10.id, enrollmentId: e10.id, eventType: "COMPLETED", eventDate: daysAgo(55), note: "Aristada 441mg given." },
    { patientId: p10.id, enrollmentId: e10.id, eventType: "COMPLETED", eventDate: daysAgo(25), note: "Monthly LAI administered." },
  ]});

  // 11. ON TRACK — Invega Sustenna
  const p11 = await prisma.patient.create({
    data: { displayName: "E. Vasquez", internalId: "PF-10601", providerName: "Dr. Levinson", phoneOptional: "555-0210" },
  });
  const e11 = await prisma.treatmentEnrollment.create({
    data: { patientId: p11.id, protocolId: invegaSustenna.id, startDate: daysAgo(150), lastTreatmentDate: daysAgo(15), nextDueDate: daysFromNow(15), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p11.id, enrollmentId: e11.id, eventType: "COMPLETED", eventDate: daysAgo(75), note: "Invega Sustenna injection. Provider visit completed." },
    { patientId: p11.id, enrollmentId: e11.id, eventType: "COMPLETED", eventDate: daysAgo(45), note: "Injection administered." },
    { patientId: p11.id, enrollmentId: e11.id, eventType: "COMPLETED", eventDate: daysAgo(15), note: "Monthly injection. Patient stable, no side effects." },
  ]});

  // 12. ON TRACK — Abilify Maintena
  const p12 = await prisma.patient.create({
    data: { displayName: "N. Adeyemi", internalId: "PF-10645", providerName: "Dr. Patel", phoneOptional: "555-0221", emailOptional: "nadeyemi@example.com" },
  });
  const e12 = await prisma.treatmentEnrollment.create({
    data: { patientId: p12.id, protocolId: abilifyMaintena.id, startDate: daysAgo(120), lastTreatmentDate: daysAgo(14), nextDueDate: daysFromNow(16), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p12.id, enrollmentId: e12.id, eventType: "COMPLETED", eventDate: daysAgo(74), note: "Abilify Maintena 300mg initiation." },
    { patientId: p12.id, enrollmentId: e12.id, eventType: "COMPLETED", eventDate: daysAgo(44), note: "Maintenance dose. Patient reports improved sleep." },
    { patientId: p12.id, enrollmentId: e12.id, eventType: "COMPLETED", eventDate: daysAgo(14), note: "Injection given. Patient doing well." },
  ]});

  // 13. ON TRACK — Ketamine Maintenance
  const p13 = await prisma.patient.create({
    data: { displayName: "B. Osei", internalId: "PF-10677", providerName: "Dr. Patel", emailOptional: "bosei@example.com" },
  });
  const e13 = await prisma.treatmentEnrollment.create({
    data: { patientId: p13.id, protocolId: ketamineMaintenance.id, startDate: daysAgo(84), lastTreatmentDate: daysAgo(7), nextDueDate: daysFromNow(21), status: "ACTIVE", notes: "Maintenance phase post induction." },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p13.id, enrollmentId: e13.id, eventType: "COMPLETED", eventDate: daysAgo(63), note: "Maintenance infusion #1." },
    { patientId: p13.id, enrollmentId: e13.id, eventType: "COMPLETED", eventDate: daysAgo(35), note: "Maintenance infusion. Patient reports sustained mood improvement." },
    { patientId: p13.id, enrollmentId: e13.id, eventType: "COMPLETED", eventDate: daysAgo(7), note: "Maintenance infusion. Tolerating well." },
  ]});

  // 14. COMPLETED THIS WEEK — Vivitrol
  const p14 = await prisma.patient.create({
    data: { displayName: "H. Nguyen", internalId: "PF-10711", providerName: "Dr. Levinson", phoneOptional: "555-0240" },
  });
  const e14 = await prisma.treatmentEnrollment.create({
    data: { patientId: p14.id, protocolId: vivitrol.id, startDate: daysAgo(112), lastTreatmentDate: daysAgo(2), nextDueDate: daysFromNow(26), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p14.id, enrollmentId: e14.id, eventType: "COMPLETED", eventDate: daysAgo(84), note: "Vivitrol injection. Initial dose." },
    { patientId: p14.id, enrollmentId: e14.id, eventType: "COMPLETED", eventDate: daysAgo(56), note: "Monthly injection." },
    { patientId: p14.id, enrollmentId: e14.id, eventType: "COMPLETED", eventDate: daysAgo(28), note: "Injection administered." },
    { patientId: p14.id, enrollmentId: e14.id, eventType: "COMPLETED", eventDate: daysAgo(2), note: "Monthly Vivitrol. Patient reports 90+ days sobriety." },
  ]});

  // 15. COMPLETED THIS WEEK — Spravato
  const p15 = await prisma.patient.create({
    data: { displayName: "G. Tanaka", internalId: "PF-10745", providerName: "Dr. Patel", phoneOptional: "555-0251", emailOptional: "gtanaka@example.com" },
  });
  const e15 = await prisma.treatmentEnrollment.create({
    data: { patientId: p15.id, protocolId: spravato.id, startDate: daysAgo(42), lastTreatmentDate: daysAgo(3), nextDueDate: daysFromNow(4), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p15.id, enrollmentId: e15.id, eventType: "COMPLETED", eventDate: daysAgo(21), note: "Spravato 56mg. First dose monitoring completed." },
    { patientId: p15.id, enrollmentId: e15.id, eventType: "COMPLETED", eventDate: daysAgo(10), note: "Spravato 84mg." },
    { patientId: p15.id, enrollmentId: e15.id, eventType: "COMPLETED", eventDate: daysAgo(3), note: "Spravato 84mg. Patient tolerated well." },
  ]});

  // 16. PAUSED — Invega Trinza
  const p16 = await prisma.patient.create({
    data: { displayName: "F. Romero", internalId: "PF-10780", providerName: "Dr. Levinson", phoneOptional: "555-0262" },
  });
  const e16 = await prisma.treatmentEnrollment.create({
    data: { patientId: p16.id, protocolId: invegaTrinza.id, startDate: daysAgo(200), lastTreatmentDate: daysAgo(60), nextDueDate: daysFromNow(30), status: "PAUSED", notes: "Paused pending insurance prior auth renewal." },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p16.id, enrollmentId: e16.id, eventType: "COMPLETED", eventDate: daysAgo(180), note: "Invega Trinza quarterly injection." },
    { patientId: p16.id, enrollmentId: e16.id, eventType: "COMPLETED", eventDate: daysAgo(90), note: "Quarterly injection." },
    { patientId: p16.id, enrollmentId: e16.id, eventType: "CANCELLED", eventDate: daysAgo(60), note: "Insurance authorization expired. Treatment on hold." },
  ]});

  // 17. ON TRACK — Aristada
  const p17 = await prisma.patient.create({
    data: { displayName: "K. Abara", internalId: "PF-10815", providerName: "Dr. Patel", emailOptional: "kabara@example.com" },
  });
  const e17 = await prisma.treatmentEnrollment.create({
    data: { patientId: p17.id, protocolId: aristada.id, startDate: daysAgo(90), lastTreatmentDate: daysAgo(20), nextDueDate: daysFromNow(10), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p17.id, enrollmentId: e17.id, eventType: "COMPLETED", eventDate: daysAgo(80), note: "Aristada 441mg." },
    { patientId: p17.id, enrollmentId: e17.id, eventType: "COMPLETED", eventDate: daysAgo(50), note: "Monthly injection." },
    { patientId: p17.id, enrollmentId: e17.id, eventType: "COMPLETED", eventDate: daysAgo(20), note: "Injection given. Patient stable." },
  ]});

  // 18. OVERDUE — Abilify Maintena, 8 days overdue (borderline escalation)
  const p18 = await prisma.patient.create({
    data: { displayName: "P. Singh", internalId: "PF-10849", providerName: "Dr. Levinson", phoneOptional: "555-0283" },
  });
  const e18 = await prisma.treatmentEnrollment.create({
    data: { patientId: p18.id, protocolId: abilifyMaintena.id, startDate: daysAgo(120), lastTreatmentDate: daysAgo(38), nextDueDate: daysAgo(8), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p18.id, enrollmentId: e18.id, eventType: "COMPLETED", eventDate: daysAgo(68), note: "Abilify Maintena injection." },
    { patientId: p18.id, enrollmentId: e18.id, eventType: "COMPLETED", eventDate: daysAgo(38), note: "Monthly dose given." },
    { patientId: p18.id, enrollmentId: e18.id, eventType: "MISSED", eventDate: daysAgo(8), note: "Patient called to reschedule, no new date set." },
  ]});
  await prisma.outreachTask.create({
    data: { patientId: p18.id, enrollmentId: e18.id, reason: "Missed Abilify Maintena — 8 days past due", status: "OPEN", priority: "HIGH", dueDate: daysAgo(7) },
  });

  // 19. NEEDS OUTREACH — Invega Sustenna (open outreach task)
  const p19 = await prisma.patient.create({
    data: { displayName: "W. Mensah", internalId: "PF-10883", providerName: "Dr. Patel", phoneOptional: "555-0294", emailOptional: "wmensah@example.com" },
  });
  const e19 = await prisma.treatmentEnrollment.create({
    data: { patientId: p19.id, protocolId: invegaSustenna.id, startDate: daysAgo(180), lastTreatmentDate: daysAgo(28), nextDueDate: daysFromNow(2), status: "ACTIVE" },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p19.id, enrollmentId: e19.id, eventType: "COMPLETED", eventDate: daysAgo(88), note: "Invega Sustenna administered." },
    { patientId: p19.id, enrollmentId: e19.id, eventType: "COMPLETED", eventDate: daysAgo(58), note: "Monthly injection." },
    { patientId: p19.id, enrollmentId: e19.id, eventType: "COMPLETED", eventDate: daysAgo(28), note: "Injection given." },
  ]});
  await prisma.outreachTask.create({
    data: { patientId: p19.id, enrollmentId: e19.id, reason: "Appointment reminder — Invega Sustenna due soon", status: "OPEN", priority: "NORMAL", dueDate: daysFromNow(1) },
  });

  // 20. ON TRACK — Ketamine Maintenance
  const p20 = await prisma.patient.create({
    data: { displayName: "I. Zhao", internalId: "PF-10917", providerName: "Dr. Patel", emailOptional: "izhao@example.com" },
  });
  const e20 = await prisma.treatmentEnrollment.create({
    data: { patientId: p20.id, protocolId: ketamineMaintenance.id, startDate: daysAgo(56), lastTreatmentDate: daysAgo(10), nextDueDate: daysFromNow(18), status: "ACTIVE", notes: "Post-induction maintenance — responding well." },
  });
  await prisma.treatmentEvent.createMany({ data: [
    { patientId: p20.id, enrollmentId: e20.id, eventType: "COMPLETED", eventDate: daysAgo(38), note: "Maintenance infusion. Great response." },
    { patientId: p20.id, enrollmentId: e20.id, eventType: "COMPLETED", eventDate: daysAgo(10), note: "Monthly infusion. Patient reports stable mood." },
  ]});

  // ── Audit log entries ─────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { actorName: "Office Staff", action: "CREATE_PATIENT", entityType: "Patient", entityId: p1.id, metadataJson: JSON.stringify({ internalId: "PF-10294", displayName: "J. Doe" }) },
      { actorName: "Office Staff", action: "CREATE_ENROLLMENT", entityType: "TreatmentEnrollment", entityId: e1.id, metadataJson: JSON.stringify({ protocol: "Vivitrol" }) },
      { actorName: "Dr. Levinson", action: "MARK_COMPLETED", entityType: "TreatmentEnrollment", entityId: e8.id, metadataJson: JSON.stringify({ protocol: "Vivitrol", date: daysAgo(24).toISOString() }) },
      { actorName: "Office Staff", action: "CREATE_OUTREACH_TASK", entityType: "OutreachTask", entityId: e1.id, metadataJson: JSON.stringify({ reason: "Missed injection" }) },
      { actorName: "Office Staff", action: "OUTREACH_VOICEMAIL_LEFT", entityType: "OutreachTask", entityId: e1.id, metadataJson: JSON.stringify({ patientId: p1.id }) },
      { actorName: "Dr. Patel", action: "MARK_COMPLETED", entityType: "TreatmentEnrollment", entityId: e14.id, metadataJson: JSON.stringify({ protocol: "Vivitrol", date: daysAgo(2).toISOString() }) },
      { actorName: "Office Staff", action: "GENERATE_AI_DRAFT", entityType: "AiDraft", entityId: "draft-seed-1", metadataJson: JSON.stringify({ draftType: "CALL_SCRIPT", provider: "mock" }) },
      { actorName: "Office Staff", action: "CSV_IMPORT", entityType: "ImportBatch", entityId: "batch-seed-1", metadataJson: JSON.stringify({ filename: "initial_import.csv", rowCount: 20, importedCount: 20 }) },
    ],
  });

  console.log("✅ Seed complete.");
  console.log(`   Protocols: ${await prisma.treatmentProtocol.count()}`);
  console.log(`   Patients: ${await prisma.patient.count()}`);
  console.log(`   Enrollments: ${await prisma.treatmentEnrollment.count()}`);
  console.log(`   Events: ${await prisma.treatmentEvent.count()}`);
  console.log(`   Outreach tasks: ${await prisma.outreachTask.count()}`);
  console.log(`   Audit logs: ${await prisma.auditLog.count()}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
