"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { computeEnrollmentStatus, formatDate, daysLabel, daysFromNow, type TreatmentStatus } from "@/lib/status";

interface Enrollment {
  id: string;
  status: string;
  lastTreatmentDate: string | null;
  nextDueDate: string | null;
  protocol: {
    name: string;
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
  isActive: boolean;
  enrollments: Enrollment[];
}

const STATUS_OPTIONS = ["", "HIGH_PRIORITY", "OVERDUE", "NEEDS_OUTREACH", "DUE_TODAY", "DUE_SOON", "ON_TRACK", "NO_DATE"];

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/patients?${params}`);
      const data = await res.json();
      setPatients(data.patients ?? []);
    } catch {
      console.error("Failed to fetch patients");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchPatients, 300);
    return () => clearTimeout(timer);
  }, [fetchPatients]);

  const getPatientStatus = (patient: Patient): TreatmentStatus => {
    if (!patient.enrollments.length) return "NO_DATE";
    const activeEnrollment = patient.enrollments.find((e) => e.status === "ACTIVE");
    if (!activeEnrollment) return patient.enrollments[0].status as TreatmentStatus;
    return computeEnrollmentStatus(activeEnrollment as Parameters<typeof computeEnrollmentStatus>[0]);
  };

  const filteredPatients = patients.filter((p) => {
    if (!statusFilter) return true;
    return getPatientStatus(p) === statusFilter;
  });

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={`${filteredPatients.length} patient${filteredPatients.length !== 1 ? "s" : ""} shown`}
        action={
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            + Add Patient
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, ID, provider..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--input-text)" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--input-text)" }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon="👤"
            title="No patients found"
            description="Try adjusting your search or filters, or add a new patient."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Protocol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Treatment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Next Due</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPatients.map((patient) => {
                  const activeEnrollment = patient.enrollments.find((e) => e.status === "ACTIVE") ?? patient.enrollments[0];
                  const status = getPatientStatus(patient);
                  const days = daysFromNow(activeEnrollment?.nextDueDate);

                  return (
                    <tr key={patient.id} className="table-row-hover">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{patient.displayName}</div>
                        <div className="text-xs text-gray-400 font-mono">{patient.internalId}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {activeEnrollment?.protocol?.name ?? (
                          <span className="text-gray-400">No protocol</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(activeEnrollment?.lastTreatmentDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800">{formatDate(activeEnrollment?.nextDueDate)}</div>
                        {days !== null && (
                          <div className="text-xs text-gray-400">{daysLabel(days)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{patient.providerName}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPatientModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchPatients(); }}
        />
      )}
    </div>
  );
}

function AddPatientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ displayName: "", internalId: "", providerName: "", phoneOptional: "", emailOptional: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create patient"); return; }
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add New Patient</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: "displayName", label: "Display Name *", placeholder: "e.g. J. Smith" },
            { key: "internalId", label: "Internal ID *", placeholder: "e.g. PF-10001" },
            { key: "providerName", label: "Provider *", placeholder: "e.g. Dr. Patel" },
            { key: "phoneOptional", label: "Phone (optional)", placeholder: "555-0100" },
            { key: "emailOptional", label: "Email (optional)", placeholder: "patient@example.com" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type="text"
                placeholder={field.placeholder}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Adding..." : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
