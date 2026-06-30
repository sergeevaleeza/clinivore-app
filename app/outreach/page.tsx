"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatDate } from "@/lib/status";

interface OutreachTask {
  id: string;
  reason: string;
  status: string;
  priority: string;
  dueDate: string | null;
  lastAttemptAt: string | null;
  outcomeNote: string | null;
  createdAt: string;
  patient: { id: string; displayName: string; internalId: string; providerName: string; phoneOptional: string | null };
  enrollment: { id: string; protocol: { name: string } };
}

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 border-red-300",
  HIGH: "bg-orange-100 text-orange-700 border-orange-300",
  NORMAL: "bg-blue-100 text-blue-700 border-blue-300",
  LOW: "bg-gray-100 text-gray-600 border-gray-300",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  CONTACTED: "Contacted",
  VOICEMAIL_LEFT: "Voicemail Left",
  RESCHEDULED: "Rescheduled",
  PROVIDER_NOTIFIED: "Provider Notified",
  CLOSED: "Closed",
};

type DraftType = "CALL_SCRIPT" | "SMS_MESSAGE" | "CHART_NOTE";

export default function OutreachQueuePage() {
  const [tasks, setTasks] = useState<OutreachTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [draftTask, setDraftTask] = useState<OutreachTask | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [noteModal, setNoteModal] = useState<{ taskId: string; action: string } | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res = await fetch(`/api/outreach?${params}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } finally { setLoading(false); }
  }, [statusFilter, priorityFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (taskId: string, status: string, note?: string) => {
    setActionTaskId(taskId);
    try {
      await fetch(`/api/outreach/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, outcomeNote: note }),
      });
      await fetchTasks();
      if (status === "CONTACTED") showToast("Marked as Contacted");
      else if (status === "VOICEMAIL_LEFT") showToast("Voicemail recorded");
    } finally { setActionTaskId(null); }
  };

  const handleGenerateDraft = async (task: OutreachTask, type: DraftType) => {
    setDraftTask(task);
    setDraftLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: task.enrollment.id, draftType: type }),
      });
      const data = await res.json();
      setDraftContent(data.draft?.content ?? "Failed to generate.");
    } finally { setDraftLoading(false); }
  };

  const urgentCount = tasks.filter((t) => t.priority === "URGENT").length;
  const highCount = tasks.filter((t) => t.priority === "HIGH").length;

  return (
    <div>
      <PageHeader
        title="Outreach Queue"
        subtitle={`${tasks.length} open task${tasks.length !== 1 ? "s" : ""}${urgentCount > 0 ? ` · ${urgentCount} urgent` : ""}${highCount > 0 ? ` · ${highCount} high priority` : ""}`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--input-text)" }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--input-text)" }}
        >
          <option value="">All Priorities</option>
          {["URGENT", "HIGH", "NORMAL", "LOW"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading outreach queue..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="📞"
          title="No open outreach tasks"
          description="All patients are on track, or no outreach tasks match the current filters."
        />
      ) : (
        <div className="space-y-3">
          {tasks
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
            .map((task) => (
              <div key={task.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/patients/${task.patient.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {task.patient.displayName}
                      </Link>
                      <span className="text-xs text-gray-400 font-mono">{task.patient.internalId}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.NORMAL}`}>
                        {task.priority}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">{task.reason}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>Protocol: {task.enrollment.protocol.name}</span>
                      <span>Provider: {task.patient.providerName}</span>
                      {task.patient.phoneOptional && <span>📞 {task.patient.phoneOptional}</span>}
                      {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
                      {task.lastAttemptAt && <span>Last attempt: {formatDate(task.lastAttemptAt)}</span>}
                    </div>
                    {task.outcomeNote && (
                      <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{task.outcomeNote}</div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0 min-w-36">
                    {task.status !== "CONTACTED" && (
                      <button
                        onClick={() => handleAction(task.id, "CONTACTED")}
                        disabled={actionTaskId === task.id}
                        className="btn btn-secondary btn-sm text-xs"
                      >
                        ✓ Mark Contacted
                      </button>
                    )}
                    {task.status !== "VOICEMAIL_LEFT" && (
                      <button
                        onClick={() => handleAction(task.id, "VOICEMAIL_LEFT")}
                        disabled={actionTaskId === task.id}
                        className="btn btn-secondary btn-sm text-xs"
                      >
                        📨 Voicemail Left
                      </button>
                    )}
                    <button
                      onClick={() => { setNoteModal({ taskId: task.id, action: "RESCHEDULED" }); setOutcomeNote(""); }}
                      disabled={actionTaskId === task.id}
                      className="btn btn-secondary btn-sm text-xs"
                    >
                      🔄 Rescheduled
                    </button>
                    <button
                      onClick={() => handleAction(task.id, "PROVIDER_NOTIFIED")}
                      disabled={actionTaskId === task.id}
                      className="btn btn-secondary btn-sm text-xs"
                    >
                      🩺 Notify Provider
                    </button>
                    <button
                      onClick={() => handleGenerateDraft(task, "CALL_SCRIPT")}
                      className="btn btn-secondary btn-sm text-xs"
                    >
                      📞 Call Script
                    </button>
                    <button
                      onClick={() => handleGenerateDraft(task, "CHART_NOTE")}
                      className="btn btn-secondary btn-sm text-xs"
                    >
                      📄 Chart Note
                    </button>
                    <button
                      onClick={() => { setNoteModal({ taskId: task.id, action: "CLOSED" }); setOutcomeNote(""); }}
                      disabled={actionTaskId === task.id}
                      className="btn btn-danger btn-sm text-xs"
                    >
                      ✕ Close Task
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Draft modal */}
      {draftTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Generated Draft — {draftTask.patient.displayName}
              </h2>
              <button onClick={() => { setDraftTask(null); setDraftContent(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {draftLoading ? (
              <LoadingSpinner label="Generating..." />
            ) : (
              <div
                style={{
                  background: "#EDE9FE",
                  border: "1px solid #DDD6FE",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#6D28D9",
                    fontWeight: 600,
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  ✦ AI Draft — review before pasting into EHR
                </div>
                <pre
                  style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    margin: 0,
                    maxHeight: 384,
                    overflowY: "auto",
                  }}
                >
                  {draftContent}
                </pre>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => handleGenerateDraft(draftTask, "CALL_SCRIPT")} className="btn btn-secondary btn-sm">📞 Call Script</button>
              <button onClick={() => handleGenerateDraft(draftTask, "SMS_MESSAGE")} className="btn btn-secondary btn-sm">💬 SMS</button>
              <button onClick={() => handleGenerateDraft(draftTask, "CHART_NOTE")} className="btn btn-secondary btn-sm">📄 Chart Note</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
          ✓ {toast}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              {noteModal.action === "CLOSED" ? "Close Task" : "Mark Rescheduled"}
            </h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Outcome Note</label>
              <textarea
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="What happened? (optional)"
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setNoteModal(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => {
                  await handleAction(noteModal.taskId, noteModal.action, outcomeNote);
                  setNoteModal(null);
                }}
                className={`flex-1 ${noteModal.action === "CLOSED" ? "btn btn-danger" : "btn btn-primary"}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
