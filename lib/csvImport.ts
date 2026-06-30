export interface CsvRow {
  internal_id: string;
  display_name: string;
  legal_first_name?: string;
  legal_last_name?: string;
  treatment_name: string;
  provider_name: string;
  last_treatment_date: string;
  next_due_date: string;
  phone_optional?: string;
  email_optional?: string;
  notes?: string;
}

export interface ParsedRow extends CsvRow {
  _valid: boolean;
  _errors: string[];
  _rowIndex: number;
}

export function validateCsvRow(row: Partial<CsvRow>, index: number): ParsedRow {
  const errors: string[] = [];

  if (!row.internal_id?.trim()) errors.push("internal_id is required");
  if (!row.display_name?.trim()) errors.push("display_name is required");
  if (!row.treatment_name?.trim()) errors.push("treatment_name is required");
  if (!row.provider_name?.trim()) errors.push("provider_name is required");

  if (row.last_treatment_date && isNaN(Date.parse(row.last_treatment_date))) {
    errors.push("last_treatment_date is not a valid date");
  }
  if (row.next_due_date && isNaN(Date.parse(row.next_due_date))) {
    errors.push("next_due_date is not a valid date");
  }

  return {
    internal_id: row.internal_id ?? "",
    display_name: row.display_name ?? "",
    legal_first_name: row.legal_first_name,
    legal_last_name: row.legal_last_name,
    treatment_name: row.treatment_name ?? "",
    provider_name: row.provider_name ?? "",
    last_treatment_date: row.last_treatment_date ?? "",
    next_due_date: row.next_due_date ?? "",
    phone_optional: row.phone_optional,
    email_optional: row.email_optional,
    notes: row.notes,
    _valid: errors.length === 0,
    _errors: errors,
    _rowIndex: index,
  };
}

export const CSV_TEMPLATE_HEADERS = [
  "internal_id",
  "display_name",
  "legal_first_name",
  "legal_last_name",
  "treatment_name",
  "provider_name",
  "last_treatment_date",
  "next_due_date",
  "phone_optional",
  "email_optional",
  "notes",
].join(",");

export const CSV_TEMPLATE_EXAMPLE = `${CSV_TEMPLATE_HEADERS}
PT-001,J. Smith,John,Smith,Vivitrol,Dr. Jones,2026-04-15,2026-05-15,555-0100,jsmith@example.com,Monthly injection
PT-002,M. Brown,Margaret,Brown,Ketamine Maintenance,Dr. Patel,2026-04-28,2026-05-26,,mbrowncare@example.com,Maintenance phase`;

// === Practice Fusion Appointment Import ===
// Handles both modern PF export headers (AppointmentTime, AppointmentStatus, etc.)
// and legacy space-separated headers (DATE/TIME, APPT. STATUS, etc.)

export interface ParsedPfAppointment {
  dateTime: string;
  patientName: string;
  dob: string;
  phone: string;
  apptType: string;
  apptStatus: string;
  provider: string;
  facility: string;
  _rowIndex: number;
  _valid: boolean;
  _errors: string[];
  parsedDate: Date | null;
  normalizedStatus: "completed" | "no_show" | "cancelled" | "rescheduled" | "unknown";
}

const PF_STATUS_MAP: Record<string, ParsedPfAppointment["normalizedStatus"]> = {
  "completed": "completed",
  "checked out": "completed",
  "seen": "completed",
  "arrived": "unknown",
  "no show": "no_show",
  "no-show": "no_show",
  "noshow": "no_show",
  "cancelled": "cancelled",
  "canceled": "cancelled",
  "rescheduled": "rescheduled",
  "booked": "unknown",
  "scheduled": "unknown",
  "confirmed": "unknown",
};

export function normalizeApptStatus(raw: string): ParsedPfAppointment["normalizedStatus"] {
  return PF_STATUS_MAP[raw.trim().toLowerCase()] ?? "unknown";
}

function pfCol(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined) return (row[k] ?? "").trim();
  }
  return "";
}

export function parsePfAppointmentRow(
  row: Record<string, string>,
  index: number
): ParsedPfAppointment {
  const errors: string[] = [];

  const dateTime = pfCol(row, "AppointmentTime", "DATE/TIME");
  const patientName = pfCol(row, "Patient", "PATIENT");
  const dob = pfCol(row, "DOB");
  const phone = pfCol(row, "MobilePhone", "HomePhone", "OfficePhone", "PHONE");
  const apptType = pfCol(row, "AppointmentType", "APPT. TYPE");
  const apptStatus = pfCol(row, "AppointmentStatus", "APPT. STATUS");
  const provider = pfCol(row, "SeenBy", "SEEN BY PROVIDER");
  const facility = pfCol(row, "Facility", "FACILITY");

  if (!patientName) errors.push("Missing patient name");
  if (!dateTime) errors.push("Missing appointment date/time");

  let parsedDate: Date | null = null;
  if (dateTime) {
    const d = new Date(dateTime);
    if (!isNaN(d.getTime())) parsedDate = d;
    else errors.push(`Could not parse date: "${dateTime}"`);
  }

  return {
    dateTime,
    patientName,
    dob,
    phone,
    apptType,
    apptStatus,
    provider,
    facility,
    _rowIndex: index,
    _valid: errors.length === 0,
    _errors: errors,
    parsedDate,
    normalizedStatus: normalizeApptStatus(apptStatus),
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function normalizeName(name: string): string {
  const parts = name.includes(",")
    ? name.split(",").reverse().map((s) => s.trim())
    : [name];
  return parts.join(" ").toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

export interface PatientMatchCandidate {
  id: string;
  displayName: string;
  legalFirstName?: string | null;
  legalLastName?: string | null;
}

export interface PatientMatchResult {
  patient: PatientMatchCandidate | null;
  confidence: "exact" | "fuzzy" | "none";
}

function legalFullName(c: PatientMatchCandidate): string {
  return [c.legalFirstName, c.legalLastName].filter(Boolean).join(" ");
}

export function matchPatientByName(
  patientName: string,
  candidates: PatientMatchCandidate[]
): PatientMatchResult {
  const target = normalizeName(patientName);

  // Exact match against legal full name (primary — full name from PF export)
  for (const c of candidates) {
    const legal = legalFullName(c);
    if (legal && normalizeName(legal) === target) {
      return { patient: c, confidence: "exact" };
    }
  }

  // Exact match against display name (fallback)
  for (const c of candidates) {
    if (normalizeName(c.displayName) === target) {
      return { patient: c, confidence: "exact" };
    }
  }

  // Fuzzy match against legal full name
  for (const c of candidates) {
    const legal = legalFullName(c);
    if (legal && levenshtein(normalizeName(legal), target) <= 2) {
      return { patient: c, confidence: "fuzzy" };
    }
  }

  // Fuzzy match against display name
  for (const c of candidates) {
    if (levenshtein(normalizeName(c.displayName), target) <= 2) {
      return { patient: c, confidence: "fuzzy" };
    }
  }

  return { patient: null, confidence: "none" };
}
