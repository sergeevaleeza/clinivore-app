"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import { computeEnrollmentStatus, formatDate, daysLabel, daysFromNow, type TreatmentStatus } from "@/lib/status";

interface TreatmentEvent {
  id: string;
  eventType: string;
  eventDate: string;
  note: string | null;
  enrollment: { protocol: { name: string } };
}

interface OutreachTask {
  id: string;
  reason: string;
  status: string;
  priority: string;
  dueDate: string | null;
  lastAttemptAt: string | null;
  outcomeNote: string | null;
  createdAt: string;
  enrollment: { protocol: { name: string } };
}

interface Enrollment {
  id: string;
  status: string;
  startDate: string;
  lastTreatmentDate: string | null;
  nextDueDate: string | null;
  notes: string | null;
  protocol: {
    id: string;
    name: string;
    category: string;
    defaultIntervalDays: number;
    overdueAfterDays: number;
    escalationAfterDays: number;
    dueSoonDays: number;
  };
  outreachTasks: { status: string }[];
}

interface Patient {
  id: string;
  displayName: string;
  internalId: string;
  providerName: string;
  phoneOptional: string | null;
  emailOptional: string | null;
  isActive: boolean;
  legalFirstName: string | null;
  legalLastName: string | null;
  enrollments: Enrollment[];
  treatmentEvents: TreatmentEvent[];
  outreachTasks: OutreachTask[];
}

const EVENT_ICONS: Record<string, string> = {
  COMPLETED: "✅",
  MISSED: "❌",
  RESCHEDULED: "🔄",
  SCHEDULED: "📅",
  CANCELLED: "🚫",
};

const EVENT_COLORS: Record<string, string> = {
  COMPLETED: "border-l-green-400",
  MISSED: "border-l-red-400",
  RESCHEDULED: "border-l-blue-400",
  SCHEDULED: "border-l-gray-300",
  CANCELLED: "border-l-gray-400",
};

type DraftType = "CALL_SCRIPT" | "SMS_MESSAGE" | "CHART_NOTE" | "WEEKLY_SUMMARY";

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<DraftType | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [note, setNote] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const fetchPatient = async () => {
    try {
      const res = await fetch(`/api/patients/${id}`);
      const data = await res.json();
      setPatient(data.patient);
    } catch { console.error("Failed to fetch patient"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPatient(); }, [id]);

  const activeEnrollment = patient?.enrollments.find((e) => e.status === "ACTIVE") ?? patient?.enrollments[0];
  const enrollmentStatus = activeEnrollment
    ? computeEnrollmentStatus(activeEnrollment as Parameters<typeof computeEnrollmentStatus>[0])
    : null;

  const handleAction = async (action: string, extra?: Record<string, string>) => {
    if (!activeEnrollment) return;
    setActionLoading(true);
    try {
      await fetch(`/api/enrollments/${activeEnrollment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      await fetchPatient();
    } finally { setActionLoading(false); }
  };

  const handleStatusChange = async (status: string, reason?: string) => {
    if (!activeEnrollment) return;
    setActionLoading(true);
    try {
      await fetch(`/api/enrollments/${activeEnrollment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_STATUS", status, note: reason }),
      });
      await fetchPatient();
    } finally { setActionLoading(false); }
  };

  const handleCreateOutreach = async () => {
    if (!activeEnrollment) return;
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: patient!.id,
        enrollmentId: activeEnrollment.id,
        reason: `Follow-up for ${activeEnrollment.protocol.name}`,
        priority: enrollmentStatus === "HIGH_PRIORITY" ? "URGENT" : enrollmentStatus === "OVERDUE" ? "HIGH" : "NORMAL",
        dueDate: new Date().toISOString(),
      }),
    });
    await fetchPatient();
  };

  const handleGenerateDraft = async (type: DraftType) => {
    if (!activeEnrollment) return;
    setDraftLoading(true);
    setDraftType(type);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: activeEnrollment.id, draftType: type }),
      });
      const data = await res.json();
      setDraftContent(data.draft?.content ?? "Failed to generate draft.");
    } finally { setDraftLoading(false); }
  };

  const saveNameEdit = async () => {
    setNameLoading(true);
    try {
      await fetch(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalFirstName: editFirst, legalLastName: editLast }),
      });
      await fetchPatient();
      setEditingName(false);
    } finally {
      setNameLoading(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading patient..." />;
  if (!patient) return <div className="text-red-600 py-8">Patient not found</div>;

  const days = daysFromNow(activeEnrollment?.nextDueDate);

  return (
    <div>
      <div className="mb-4">
        <Link href="/patients" className="text-sm text-gray-500 hover:text-gray-700">← Back to Patients</Link>
      </div>

      <PageHeader
        title={patient.displayName}
        subtitle={`${patient.internalId} · ${patient.providerName}`}
        action={
          enrollmentStatus && (
            <StatusBadge status={enrollmentStatus} />
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Patient info + actions */}
        <div className="space-y-4">
          {/* Patient card */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient Info</h3>
              {!editingName && (
                <button
                  onClick={() => { setEditFirst(patient.legalFirstName ?? ""); setEditLast(patient.legalLastName ?? ""); setEditingName(true); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit legal name
                </button>
              )}
            </div>
            {editingName ? (
              <div className="space-y-2 text-sm">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Legal First Name</label>
                  <input
                    type="text"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Legal Last Name</label>
                  <input
                    type="text"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveNameEdit} disabled={nameLoading} className="btn btn-primary flex-1 text-xs">
                    {nameLoading ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditingName(false)} className="btn btn-secondary flex-1 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {(patient.legalFirstName || patient.legalLastName) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Legal name</span>
                    <span className="text-gray-800">{[patient.legalFirstName, patient.legalLastName].filter(Boolean).join(" ")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Internal ID</span>
                  <span className="font-mono text-gray-800">{patient.internalId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Provider</span>
                  <span className="text-gray-800">{patient.providerName}</span>
                </div>
                {patient.phoneOptional && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-800">{patient.phoneOptional}</span>
                  </div>
                )}
                {patient.emailOptional && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-800 truncate max-w-32">{patient.emailOptional}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs font-medium ${patient.isActive ? "text-green-600" : "text-gray-400"}`}>
                    {patient.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Enrollment card */}
          {activeEnrollment && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Treatment</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-gray-900">{activeEnrollment.protocol.name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      activeEnrollment.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-300" :
                      activeEnrollment.status === "PAUSED" ? "bg-gray-100 text-gray-600 border-gray-300" :
                      "bg-red-100 text-red-700 border-red-300"
                    }`}>{activeEnrollment.status}</span>
                  </div>
                  <div className="text-xs text-gray-400">{activeEnrollment.protocol.category}</div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Treatment</span>
                  <span className="text-gray-800">{formatDate(activeEnrollment.lastTreatmentDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Next Due</span>
                  <div className="text-right">
                    <div className="text-gray-800">{formatDate(activeEnrollment.nextDueDate)}</div>
                    {days !== null && <div className="text-xs text-gray-400">{daysLabel(days)}</div>}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interval</span>
                  <span className="text-gray-800">Every {activeEnrollment.protocol.defaultIntervalDays} days</span>
                </div>
                {activeEnrollment.notes && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-2">{activeEnrollment.notes}</div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {activeEnrollment && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleAction("COMPLETED")}
                  disabled={actionLoading}
                  className="btn btn-primary w-full justify-center text-xs"
                >
                  ✅ Mark Treatment Completed
                </button>
                <button
                  onClick={() => handleAction("MISSED")}
                  disabled={actionLoading}
                  className="btn btn-secondary w-full justify-center text-xs"
                >
                  ❌ Mark as Missed
                </button>
                <button
                  onClick={() => setShowRescheduleModal(true)}
                  disabled={actionLoading}
                  className="btn btn-secondary w-full justify-center text-xs"
                >
                  🔄 Reschedule
                </button>
                <button
                  onClick={handleCreateOutreach}
                  disabled={actionLoading}
                  className="btn btn-secondary w-full justify-center text-xs"
                >
                  📞 Create Outreach Task
                </button>
                <hr className="border-gray-200" />
                {activeEnrollment.status !== "PAUSED" && (
                  <button
                    onClick={() => { setShowPauseModal(true); setPauseReason(""); }}
                    disabled={actionLoading}
                    className="btn btn-secondary w-full justify-center text-xs text-gray-500"
                  >
                    ⏸ Pause Treatment
                  </button>
                )}
                {activeEnrollment.status === "PAUSED" && (
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={actionLoading}
                    className="btn btn-secondary w-full justify-center text-xs text-green-700"
                  >
                    ▶ Resume Treatment
                  </button>
                )}
                {activeEnrollment.status !== "DISCONTINUED" && (
                  <button
                    onClick={() => {
                      if (confirm("Mark this treatment as Discontinued? This cannot be easily undone.")) {
                        handleStatusChange("DISCONTINUED");
                      }
                    }}
                    disabled={actionLoading}
                    className="btn btn-secondary w-full justify-center text-xs text-red-600"
                  >
                    ✕ Discontinue Treatment
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Generate drafts */}
          {activeEnrollment && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Generate Draft</h3>
              <div className="space-y-2">
                {([
                  ["CALL_SCRIPT", "📞 Call Script"],
                  ["SMS_MESSAGE", "💬 SMS Message"],
                  ["CHART_NOTE", "📄 Chart Note"],
                  ["WEEKLY_SUMMARY", "📊 Weekly Summary"],
                ] as [DraftType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => handleGenerateDraft(type)}
                    disabled={draftLoading}
                    className="btn btn-secondary w-full justify-center text-xs"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Timeline + draft */}
        <div className="lg:col-span-2 space-y-4">
          {/* Draft output */}
          {(draftLoading || draftContent) && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {draftType?.replace(/_/g, " ")} (AI Mock Draft)
                </h3>
                <button onClick={() => { setDraftContent(null); setDraftType(null); }} className="text-xs text-gray-400 hover:text-gray-600">
                  ✕ Close
                </button>
              </div>
              {draftLoading ? (
                <LoadingSpinner label="Generating draft..." />
              ) : (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-md p-3 font-mono leading-relaxed overflow-auto max-h-80">
                  {draftContent}
                </pre>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Activity Timeline</h3>

            {patient.treatmentEvents.length === 0 && patient.outreachTasks.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No activity recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {[
                  ...patient.treatmentEvents.map((e) => ({
                    id: e.id,
                    type: "event" as const,
                    date: e.eventDate,
                    label: `${EVENT_ICONS[e.eventType] ?? "·"} ${e.eventType} — ${e.enrollment?.protocol?.name ?? ""}`,
                    note: e.note,
                    style: EVENT_COLORS[e.eventType] ?? "border-l-gray-200",
                  })),
                  ...patient.outreachTasks.map((t) => ({
                    id: t.id,
                    type: "outreach" as const,
                    date: t.createdAt,
                    label: `📞 Outreach: ${t.reason}`,
                    note: t.outcomeNote ?? `Status: ${t.status} · Priority: ${t.priority}`,
                    style: "border-l-orange-300",
                  })),
                ]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 25)
                  .map((item) => (
                    <div key={item.id} className={`border-l-2 ${item.style} pl-3 py-1.5`}>
                      <div className="text-xs font-medium text-gray-800">{item.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {item.note && ` · ${item.note}`}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Open outreach tasks */}
          {patient.outreachTasks.filter((t) => t.status !== "CLOSED").length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Open Outreach Tasks</h3>
              <div className="space-y-2">
                {patient.outreachTasks
                  .filter((t) => t.status !== "CLOSED")
                  .map((task) => (
                    <div key={task.id} className="flex items-start justify-between bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-gray-800">{task.reason}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {task.status} · {task.priority} priority
                          {task.outcomeNote && ` · ${task.outcomeNote}`}
                        </div>
                      </div>
                      <Link href="/outreach" className="text-xs text-blue-600 hover:underline shrink-0 ml-2">
                        Manage →
                      </Link>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPauseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Pause Treatment</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g. Insurance hold, patient request…"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowPauseModal(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => {
                  await handleStatusChange("PAUSED", pauseReason || undefined);
                  setShowPauseModal(false);
                }}
                disabled={actionLoading}
                className="btn btn-primary flex-1"
              >
                Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Reschedule Treatment</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for reschedule..."
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowRescheduleModal(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => {
                  if (!rescheduleDate) return;
                  await handleAction("RESCHEDULE", { newDate: rescheduleDate, note });
                  setShowRescheduleModal(false);
                  setRescheduleDate("");
                  setNote("");
                }}
                disabled={!rescheduleDate || actionLoading}
                className="btn btn-primary flex-1"
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
