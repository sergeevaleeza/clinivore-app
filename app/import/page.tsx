"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Papa from "papaparse";
import PageHeader from "@/components/PageHeader";
import { validateCsvRow, CSV_TEMPLATE_EXAMPLE, type ParsedRow } from "@/lib/csvImport";

interface ImportResult {
  batchId: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  errors: { row: number; errors: string[] }[];
}

interface PfCandidateEvent {
  rowIndex: number;
  patientId: string;
  patientName: string;
  enrollmentId: string;
  protocolName: string;
  apptDate: string;
  apptType: string;
  apptStatus: string;
  normalizedStatus: "completed" | "no_show" | "cancelled" | "rescheduled" | "unknown";
  suggestedAction: "mark_completed" | "mark_missed" | "ignore";
  defaultChecked: boolean;
  matchConfidence: "exact" | "fuzzy";
}

interface PfPreviewResponse {
  summary: {
    totalRows: number;
    matchedWithProtocol: number;
    matchedNoProtocol: number;
    unmatched: number;
    candidateCompletedEvents: number;
    candidateMissedEvents: number;
  };
  candidateEvents: PfCandidateEvent[];
  matchedNoProtocol: Array<{ patientId: string; patientName: string; apptCount: number }>;
  unmatched: Array<{ patientName: string; dob: string; apptDate: string; rowIndex: number }>;
}

function fmtApptDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

const PF_COLUMNS = [
  "AppointmentTime", "Patient", "DOB",
  "MobilePhone", "HomePhone", "OfficePhone",
  "AppointmentType", "AppointmentStatus", "SeenBy",
  "Copay", "Eligibility", "Facility",
];

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<"roster" | "pf">("roster");

  // --- Roster tab ---
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // --- PF tab ---
  const [pfFilename, setPfFilename] = useState("");
  const [pfPreviewing, setPfPreviewing] = useState(false);
  const [pfPreview, setPfPreview] = useState<PfPreviewResponse | null>(null);
  const [pfChecked, setPfChecked] = useState<Set<number>>(new Set());
  const [pfConfirming, setPfConfirming] = useState(false);
  const [pfResult, setPfResult] = useState<{ eventsCreated: number; outreachTasksCreated: number } | null>(null);
  const [pfDragOver, setPfDragOver] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);

  // --- Roster handlers ---
  const handleFile = useCallback((file: File) => {
    setFilename(file.name);
    setResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const validated = (res.data as Record<string, string>[]).map((row, i) => validateCsvRow(row, i + 1));
        setParsedRows(validated);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith(".csv")) handleFile(file);
    },
    [handleFile]
  );

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r._valid);
    if (!validRows.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows, filename }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      alert("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_EXAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clinivore_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- PF handlers ---
  const handlePfFile = useCallback((file: File) => {
    setPfFilename(file.name);
    setPfPreview(null);
    setPfResult(null);
    setPfChecked(new Set());
    setPfError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows = res.data as Record<string, string>[];
        setPfPreviewing(true);
        try {
          const response = await fetch("/api/import/pf-appointments/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows, filename: file.name }),
          });
          if (!response.ok) throw new Error("Preview failed");
          const data: PfPreviewResponse = await response.json();
          setPfPreview(data);
          const defaults = new Set(
            data.candidateEvents.filter((e) => e.defaultChecked).map((e) => e.rowIndex)
          );
          setPfChecked(defaults);
        } catch {
          setPfError(
            "Failed to preview appointments. Check that this is a Practice Fusion appointment export with the expected columns."
          );
        } finally {
          setPfPreviewing(false);
        }
      },
    });
  }, []);

  const handlePfDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setPfDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith(".csv")) handlePfFile(file);
    },
    [handlePfFile]
  );

  const togglePfCheck = (rowIndex: number) => {
    const next = new Set(pfChecked);
    if (next.has(rowIndex)) next.delete(rowIndex);
    else next.add(rowIndex);
    setPfChecked(next);
  };

  const checkedCount = pfPreview
    ? pfPreview.candidateEvents.filter(
        (e) => pfChecked.has(e.rowIndex) && e.suggestedAction !== "ignore"
      ).length
    : 0;

  const handlePfConfirm = async () => {
    if (!pfPreview) return;
    const confirmedEvents = pfPreview.candidateEvents
      .filter(
        (e) =>
          pfChecked.has(e.rowIndex) &&
          (e.normalizedStatus === "completed" || e.normalizedStatus === "no_show")
      )
      .map((e) => ({
        enrollmentId: e.enrollmentId,
        apptDate: e.apptDate,
        normalizedStatus: e.normalizedStatus as "completed" | "no_show",
      }));
    if (!confirmedEvents.length) return;
    setPfConfirming(true);
    try {
      const res = await fetch("/api/import/pf-appointments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: pfFilename, confirmedEvents }),
      });
      const data = await res.json();
      setPfResult(data);
    } catch {
      alert("Confirm failed. Please try again.");
    } finally {
      setPfConfirming(false);
    }
  };

  const validCount = parsedRows.filter((r) => r._valid).length;
  const invalidCount = parsedRows.filter((r) => !r._valid).length;

  return (
    <div>
      <PageHeader
        title="Import"
        subtitle="Import patient rosters or Practice Fusion appointment exports"
        action={
          activeTab === "roster" ? (
            <button onClick={downloadTemplate} className="btn btn-secondary">
              ↓ Download Template
            </button>
          ) : undefined
        }
      />

      {/* Tab navigation */}
      <div className="flex mb-6 border-b border-gray-200">
        {(["roster", "pf"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "roster" ? "Patient Roster CSV" : "Practice Fusion Appointments"}
          </button>
        ))}
      </div>

      {/* ===== ROSTER TAB ===== */}
      {activeTab === "roster" && (
        <div>
          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors mb-6 ${
              dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="text-3xl mb-2">📂</div>
            <div className="text-sm font-medium text-gray-700 mb-1">
              Drop a CSV file here, or click to browse
            </div>
            <div className="text-xs text-gray-400 mb-4">
              Supports .csv files · Required columns: internal_id, display_name, treatment_name, provider_name
            </div>
            <label className="btn btn-secondary cursor-pointer">
              Choose File
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
          </div>

          {parsedRows.length > 0 && (
            <div className="card mb-6">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-800">Preview: {filename}</span>
                  <span className="ml-2 text-xs text-gray-500">{parsedRows.length} rows</span>
                </div>
                <div className="flex items-center gap-3">
                  {validCount > 0 && <span className="text-xs text-green-600 font-medium">✓ {validCount} valid</span>}
                  {invalidCount > 0 && <span className="text-xs text-red-600 font-medium">✗ {invalidCount} invalid</span>}
                </div>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                      <th className="text-left px-3 py-2 text-gray-500">#</th>
                      <th className="text-left px-3 py-2 text-gray-500">Status</th>
                      <th className="text-left px-3 py-2 text-gray-500">Internal ID</th>
                      <th className="text-left px-3 py-2 text-gray-500">Display Name</th>
                      <th className="text-left px-3 py-2 text-gray-500">Treatment</th>
                      <th className="text-left px-3 py-2 text-gray-500">Provider</th>
                      <th className="text-left px-3 py-2 text-gray-500">Last Date</th>
                      <th className="text-left px-3 py-2 text-gray-500">Next Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map((row) => (
                      <tr key={row._rowIndex} className={row._valid ? "" : "bg-red-50"}>
                        <td className="px-3 py-2 text-gray-400">{row._rowIndex}</td>
                        <td className="px-3 py-2">
                          {row._valid ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600 cursor-help" title={row._errors.join("; ")}>
                              ✗ {row._errors[0]}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{row.internal_id}</td>
                        <td className="px-3 py-2">{row.display_name}</td>
                        <td className="px-3 py-2">{row.treatment_name}</td>
                        <td className="px-3 py-2">{row.provider_name}</td>
                        <td className="px-3 py-2">{row.last_treatment_date}</td>
                        <td className="px-3 py-2">{row.next_due_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => { setParsedRows([]); setFilename(""); setResult(null); }}
                  className="btn btn-secondary btn-sm"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                  className="btn btn-primary"
                >
                  {importing ? "Importing..." : `Import ${validCount} Valid Row${validCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className={`card p-5 ${result.skippedCount === 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
              <div className="text-sm font-semibold text-gray-800 mb-2">Import Complete</div>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Total rows:</span>{" "}
                  <span className="font-medium">{result.rowCount}</span>
                </div>
                <div>
                  <span className="text-green-600">Imported:</span>{" "}
                  <span className="font-medium text-green-700">{result.importedCount}</span>
                </div>
                <div>
                  <span className="text-red-500">Skipped:</span>{" "}
                  <span className="font-medium text-red-600">{result.skippedCount}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-red-600 mb-1">Errors:</div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} className="text-xs text-red-500">Row {e.row}: {e.errors.join(", ")}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {parsedRows.length === 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Expected CSV Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {[
                  { col: "internal_id", req: true, desc: "Unique patient identifier (e.g. PF-10001)" },
                  { col: "display_name", req: true, desc: "Patient display name (e.g. J. Smith)" },
                  { col: "treatment_name", req: true, desc: "Must match a protocol name (e.g. Vivitrol)" },
                  { col: "provider_name", req: true, desc: "Provider name (e.g. Dr. Patel)" },
                  { col: "last_treatment_date", req: false, desc: "YYYY-MM-DD format" },
                  { col: "next_due_date", req: false, desc: "YYYY-MM-DD format" },
                  { col: "phone_optional", req: false, desc: "Contact phone number" },
                  { col: "email_optional", req: false, desc: "Contact email address" },
                  { col: "notes", req: false, desc: "Free text notes" },
                ].map((f) => (
                  <div key={f.col} className="flex gap-2">
                    <code className={`font-mono shrink-0 ${f.req ? "text-blue-600" : "text-gray-500"}`}>
                      {f.col}
                    </code>
                    <span className="text-gray-500">
                      {f.req && <span className="text-red-400 mr-1">*</span>}
                      {f.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== PRACTICE FUSION TAB ===== */}
      {activeTab === "pf" && (
        <div>
          {!pfPreview && !pfPreviewing && !pfResult && (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors mb-6 ${
                  pfDragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setPfDragOver(true); }}
                onDragLeave={() => setPfDragOver(false)}
                onDrop={handlePfDrop}
              >
                <div className="text-3xl mb-2">📅</div>
                <div className="text-sm font-medium text-gray-700 mb-1">
                  Drop a Practice Fusion appointment export here, or click to browse
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  Export from Practice Fusion: Reports → Appointments → Export to CSV
                </div>
                <div className="text-xs text-gray-400 mb-4">
                  No manual editing required — upload the file exactly as exported
                </div>
                <label className="btn btn-secondary cursor-pointer">
                  Choose File
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePfFile(f); }}
                  />
                </label>
              </div>

              {pfError && (
                <div className="card p-4 mb-4 text-sm text-red-700" style={{ background: "#FFF1F1", borderColor: "#FECACA" }}>
                  {pfError}
                </div>
              )}

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Expected Columns (Practice Fusion Appointment Export)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3">
                  {PF_COLUMNS.map((col) => (
                    <div key={col} className="font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                      {col}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  <strong>Note:</strong> Appointment type is shown for staff context only.
                  Clinivore matches patients by name — staff confirms which visits are treatment events.
                </p>
              </div>
            </>
          )}

          {pfPreviewing && (
            <div className="text-center py-16 text-sm text-gray-500">
              <div className="text-2xl mb-3">🔍</div>
              Matching appointments to enrolled patients…
            </div>
          )}

          {pfPreview && !pfResult && (
            <>
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full">
                  {pfPreview.summary.totalRows} total rows
                </span>
                {pfPreview.summary.candidateCompletedEvents > 0 && (
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full">
                    {pfPreview.summary.candidateCompletedEvents} completed appointments matched
                  </span>
                )}
                {pfPreview.summary.candidateMissedEvents > 0 && (
                  <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full">
                    {pfPreview.summary.candidateMissedEvents} no-show appointments matched
                  </span>
                )}
                {pfPreview.summary.unmatched > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full">
                    {pfPreview.summary.unmatched} unmatched
                  </span>
                )}
              </div>

              {/* Section 1: Candidate events */}
              <div className="card mb-4" style={{ padding: 0 }}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-800">
                    ⚠ Candidate Treatment Events — Review Before Import
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    These appointments matched patients on active protocols. Confirm which ones to record.
                  </div>
                </div>
                {pfPreview.candidateEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    No candidate treatment events found in this file.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pfPreview.candidateEvents.map((event) => {
                      const hasMultipleCompleted =
                        pfPreview.candidateEvents.filter(
                          (e) => e.enrollmentId === event.enrollmentId && e.normalizedStatus === "completed"
                        ).length > 1;
                      return (
                        <div key={event.rowIndex} className="px-4 py-3 flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={pfChecked.has(event.rowIndex)}
                            onChange={() => togglePfCheck(event.rowIndex)}
                            className="mt-1 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">{event.patientName}</span>
                              <span className="text-gray-300 text-sm">·</span>
                              <span className="text-sm text-gray-600">{event.protocolName}</span>
                              <span className="text-gray-300 text-sm">·</span>
                              <span className="text-sm text-gray-600">{fmtApptDate(event.apptDate)}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                                  event.normalizedStatus === "completed"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : event.normalizedStatus === "no_show"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                                }`}
                              >
                                {event.apptStatus}
                              </span>
                              {event.matchConfidence === "fuzzy" && (
                                <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded">
                                  ~ fuzzy match
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              Appt type: &ldquo;{event.apptType}&rdquo;{" "}
                              <span className="text-gray-300">(for reference only)</span>
                            </div>
                            {event.normalizedStatus === "no_show" && (
                              <div className="text-xs text-red-600 mt-0.5">
                                → Will create: Missed event + HIGH priority outreach task
                              </div>
                            )}
                            {!event.defaultChecked &&
                              event.normalizedStatus === "completed" &&
                              hasMultipleCompleted && (
                                <div className="text-xs text-yellow-600 mt-0.5">
                                  ⚠ Not the most recent visit for this patient — review carefully
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Matched, no protocol */}
              {pfPreview.matchedNoProtocol.length > 0 && (
                <div className="card mb-4 p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-1">
                    Matched — No Protocol Assigned ({pfPreview.matchedNoProtocol.length}{" "}
                    patient{pfPreview.matchedNoProtocol.length !== 1 ? "s" : ""})
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    These patients were found in Clinivore but have no active treatment protocol.
                    Assign a protocol from the Patient page first.
                  </div>
                  <div className="space-y-1.5">
                    {pfPreview.matchedNoProtocol.map((p) => (
                      <div key={p.patientId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.patientName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {p.apptCount} appt{p.apptCount !== 1 ? "s" : ""}
                          </span>
                          <Link
                            href={`/patients/${p.patientId}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View Patient →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Unmatched */}
              {pfPreview.unmatched.length > 0 && (
                <div className="card mb-4 p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-1">
                    Unmatched ({pfPreview.unmatched.length} row{pfPreview.unmatched.length !== 1 ? "s" : ""})
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    No patient found by name. Use the Patient Roster CSV tab to add new patients first.
                  </div>
                  <div className="space-y-1">
                    {pfPreview.unmatched.map((u) => (
                      <div key={u.rowIndex} className="text-xs text-gray-600">
                        {u.patientName}
                        {u.dob && <span className="text-gray-400 ml-2">DOB: {u.dob}</span>}
                        <span className="text-gray-400 ml-2">{fmtApptDate(u.apptDate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm bar */}
              <div className="flex items-center justify-between gap-4 pt-4 mt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setPfPreview(null);
                    setPfFilename("");
                    setPfChecked(new Set());
                    setPfError(null);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  ← Start Over
                </button>
                <button
                  onClick={handlePfConfirm}
                  disabled={checkedCount === 0 || pfConfirming}
                  className="btn btn-primary"
                >
                  {pfConfirming
                    ? "Importing…"
                    : checkedCount === 0
                    ? "Select events to import"
                    : `Import ${checkedCount} Confirmed Event${checkedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          )}

          {pfResult && (
            <div className="card p-8 text-center" style={{ background: "#F0FFF4", borderColor: "#BBF7D0" }}>
              <div className="text-3xl mb-3">✅</div>
              <div className="text-base font-semibold text-gray-800 mb-4">Import Complete</div>
              <div className="flex justify-center gap-10 text-sm">
                <div>
                  <div className="text-3xl font-bold text-green-600">{pfResult.eventsCreated}</div>
                  <div className="text-xs text-gray-500 mt-1">treatment events recorded</div>
                </div>
                {pfResult.outreachTasksCreated > 0 && (
                  <div>
                    <div className="text-3xl font-bold text-orange-500">{pfResult.outreachTasksCreated}</div>
                    <div className="text-xs text-gray-500 mt-1">outreach tasks created</div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => {
                    setPfPreview(null);
                    setPfResult(null);
                    setPfFilename("");
                    setPfChecked(new Set());
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Import Another File
                </button>
                <Link href="/" className="btn btn-primary btn-sm">
                  View Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
