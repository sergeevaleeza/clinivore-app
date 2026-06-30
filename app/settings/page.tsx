import PageHeader from "@/components/PageHeader";

function getDatabaseLabel(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("neon.tech")) return "PostgreSQL (Neon)";
  if (url.startsWith("postgres") || url.startsWith("postgresql")) return "PostgreSQL";
  if (url.startsWith("file:")) return "SQLite (local)";
  return "Unknown";
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings & Compliance"
        subtitle="Configuration and HIPAA compliance information"
      />

      {/* HIPAA Disclaimer */}
      <div className="mb-6 border border-red-200 bg-red-50 rounded-lg p-5">
        <div className="flex gap-3">
          <div className="text-2xl shrink-0">⚠️</div>
          <div>
            <h3 className="text-sm font-semibold text-red-800 mb-2">HIPAA Compliance Notice — Read Before Clinical Use</h3>
            <div className="text-xs text-red-700 space-y-1">
              <p>This is a <strong>Phase 1 prototype</strong> using mock/de-identified data. It is <strong>not yet certified HIPAA-compliant</strong> for production use with real patient health information.</p>
              <p>Before using with real PHI, your practice must:</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>Deploy on BAA-covered HIPAA-compliant hosting (AWS HIPAA, Azure, etc.)</li>
                <li>Implement proper access controls, role-based authentication, and session management</li>
                <li>Enable encryption at rest and in transit (TLS 1.2+)</li>
                <li>Establish audit logging and retention policies per HIPAA requirements</li>
                <li>Sign a Business Associate Agreement (BAA) with all vendors</li>
                <li>If using AI features: only use BAA-covered AI providers (Azure OpenAI HIPAA, etc.)</li>
                <li>Conduct a formal Security Risk Analysis</li>
                <li>Consult with a healthcare compliance attorney</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current config */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Current Configuration</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">AI Provider</span>
              <span className="font-mono text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded">
                {process.env.NEXT_PUBLIC_APP_NAME ? "mock" : "mock"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">PHI to AI</span>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                DISABLED (ALLOW_PHI_TO_AI=false)
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Database</span>
              <span className="font-mono text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded">{getDatabaseLabel()}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Audit Logging</span>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                ENABLED
              </span>
            </div>
          </div>
        </div>

        {/* Phase roadmap */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Phase Roadmap</h3>
          <div className="space-y-3">
            {[
              {
                phase: "Phase 1 (Current)",
                status: "current",
                items: ["Core dashboard", "Patient & enrollment tracking", "Outreach queue", "CSV import", "Mock AI drafts", "Audit logging"],
              },
              {
                phase: "Phase 2",
                status: "planned",
                items: ["Real authentication & roles", "Practice Fusion EHR integration", "Twilio SMS outreach", "Real AI (BAA-covered)", "Hosted deployment"],
              },
              {
                phase: "Phase 3",
                status: "future",
                items: ["Provider mobile view", "Automated reminders", "Billing code suggestions", "Analytics & reporting", "Multi-practice support"],
              },
            ].map((phase) => (
              <div key={phase.phase} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  phase.status === "current" ? "bg-green-500" :
                  phase.status === "planned" ? "bg-blue-400" : "bg-gray-300"
                }`} />
                <div>
                  <div className={`text-xs font-semibold ${
                    phase.status === "current" ? "text-green-700" :
                    phase.status === "planned" ? "text-blue-700" : "text-gray-500"
                  }`}>
                    {phase.phase}
                    {phase.status === "current" && " ✓"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{phase.items.join(", ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Future integrations */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Future Integrations</h3>
          <div className="space-y-4 text-xs">
            <div>
              <div className="font-medium text-gray-700 mb-1">Practice Fusion EHR</div>
              <p className="text-gray-500">Import Practice Fusion appointment exports directly — no manual reformatting required. Clinivore matches patients by name, then staff confirms which visits are treatment events. Missed appointments are detected automatically from appointment status. Full FHIR API integration is in active development for Phase 2.</p>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">Twilio SMS / Voice</div>
              <p className="text-gray-500">Phase 2 will add Twilio integration for outbound SMS reminders and automated call scripts. Requires HIPAA-compliant Twilio configuration, opt-in tracking, and TCPA compliance.</p>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">AI (Azure OpenAI / BAA)</div>
              <p className="text-gray-500">Set <code className="bg-gray-100 px-1 rounded">AI_PROVIDER=openai</code> with your API key to enable real AI drafts. For PHI, use Azure OpenAI with a BAA and set <code className="bg-gray-100 px-1 rounded">ALLOW_PHI_TO_AI=true</code> only in a compliant environment.</p>
            </div>
          </div>
        </div>

        {/* How to configure AI */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">AI Configuration (.env)</h3>
          <pre className="bg-gray-50 rounded-md p-3 text-xs font-mono text-gray-700 overflow-x-auto">
{`# Use mock AI (default, safe, no PHI risk)
AI_PROVIDER=mock

# Use OpenAI (non-PHI only unless BAA)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Only enable with BAA-covered vendor
ALLOW_PHI_TO_AI=false`}
          </pre>
          <p className="text-xs text-gray-400 mt-2">
            When ALLOW_PHI_TO_AI=false, only displayName and internalId are sent to AI. Full PHI is never included.
          </p>
        </div>
      </div>
    </div>
  );
}
