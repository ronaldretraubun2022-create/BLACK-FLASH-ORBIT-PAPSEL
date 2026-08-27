import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Layers3,
  Pencil,
  Play,
  RefreshCcw,
  Rocket,
  Save,
  ShieldCheck,
  TimerReset,
  Trash2,
  Workflow,
} from "lucide-react";
import { api } from "../services/api";

const workflowTemplates = [
  {
    action: "Approval-gated AI Router check",
    definitionId: "ai_operational_check",
    description:
      "Validate workflow persistence, require human approval, then call the existing AI Router.",
    id: "ai_operational_check",
    name: "AI Operational Check",
    stepCount: 4,
    trigger: "Manual approval gate",
  },
  {
    action: "Persist telemetry checkpoint",
    definitionId: "telemetry_sync",
    description: "Record a safe workflow telemetry checkpoint.",
    id: "telemetry_sync",
    name: "Telemetry Sync",
    stepCount: 2,
    trigger: "Manual safe run",
  },
];

const pipelineSteps = [
  {
    id: "validate_request",
    name: "Validate request",
    requiresApproval: false,
    status: "Ready",
    tool: "internal.validate",
  },
  {
    id: "persist_result",
    name: "Persist result",
    requiresApproval: false,
    status: "Ready",
    tool: "internal.persist",
  },
];

const schedulerOptions = [
  { label: "Manual", value: "Manual" },
  { label: "Every 15m", value: "Every 15m" },
  { label: "Hourly", value: "Hourly" },
  { label: "Daily", value: "Daily" },
];

const fallbackHistory = [
  {
    detail: "Durable workflow history will appear after the first signed-in run.",
    result: "Ready",
    time: "Live",
    id: "telemetry-sync",
    name: "Telemetry Sync",
    title: "Telemetry Sync",
  },
];

function getRunStatus(run) {
  return run?.status || run?.state || "";
}

function getRunDefinitionId(run) {
  return run?.definitionId || run?.workflowId || "";
}

function getTemplateRunId(template) {
  return template?.definitionId || template?.id || "";
}

function mapWorkflowDefinition(definition) {
  const definitionId = definition.definitionId || definition.id;
  const steps = Array.isArray(definition.steps) ? definition.steps : [];
  const requiresApproval =
    definition.requiresApproval ||
    definition.sensitive ||
    steps.some((step) => step?.requiresApproval);

  return {
    action: requiresApproval ? "Requires approval" : "Safe execution",
    definitionId,
    description: definition.description,
    id: definition.id || definitionId,
    name: definition.name || definitionId,
    steps,
    stepCount: steps.length || definition.stepCount || 0,
    trigger: "Manual",
  };
}

function mergeWorkflowDefinitions(durableDefinitions, legacyDefinitions) {
  return [
    ...durableDefinitions,
    ...legacyDefinitions.filter(
      (legacy) =>
        !durableDefinitions.some(
          (durable) => durable.definitionId === legacy.definitionId || durable.id === legacy.id,
        ),
    ),
  ];
}

function visibleTemplateSource(workflowDefinitions, savedTemplates) {
  return [...workflowDefinitions, ...savedTemplates];
}

function getSelectedSteps(template, workflowDefinitions) {
  if (Array.isArray(template?.steps) && template.steps.length) return template.steps;

  const definition = workflowDefinitions.find(
    (item) => item.definitionId === template?.definitionId || item.id === template?.definitionId,
  );

  if (Array.isArray(definition?.steps) && definition.steps.length) return definition.steps;

  return pipelineSteps;
}

function formatRunOutput(run, template) {
  const status = getRunStatus(run) || "created";
  const timestamp = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (status === "waiting_approval") {
    return `[${timestamp}] ${template.name} waiting_approval. Human approval required before AI Router execution.`;
  }

  return `[${timestamp}] ${template.name} ${status}. Durable workflow history persisted.`;
}

export function WorkflowAutomation() {
  const [automation, setAutomation] = useState({});
  const [automationStatus, setAutomationStatus] = useState(null);
  const [automationJobs, setAutomationJobs] = useState([]);
  const [automationHistory, setAutomationHistory] = useState(fallbackHistory);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState(workflowTemplates);
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(workflowTemplates[0]);
  const [selectedScheduler, setSelectedScheduler] = useState("Hourly");
  const [runOutput, setRunOutput] = useState(
    "Workflow output will appear here after a signed-in run.",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("-");

  const automationEntries = useMemo(() => Object.entries(automation), [automation]);
  const selectedRun = useMemo(
    () =>
      workflowRuns.find((run) => {
        if (selectedTemplate.id && run?.templateId === selectedTemplate.id) return true;

        const runDefinitionId = getRunDefinitionId(run);

        return (
          runDefinitionId === getTemplateRunId(selectedTemplate) ||
          runDefinitionId === selectedTemplate.id
        );
      }),
    [selectedTemplate, workflowRuns],
  );
  const pendingApprovalRun = useMemo(
    () => workflowRuns.find((run) => getRunStatus(run) === "waiting_approval"),
    [workflowRuns],
  );
  const nextRunLabel = useMemo(() => {
    if (selectedScheduler === "Manual") return "Manual trigger only";
    if (selectedScheduler === "Every 15m") return "Next run in 15m";
    if (selectedScheduler === "Hourly") return "Next run in 1h";
    return "Next run tomorrow";
  }, [selectedScheduler]);
  const selectedSteps = useMemo(
    () => getSelectedSteps(selectedTemplate, workflowDefinitions),
    [selectedTemplate, workflowDefinitions],
  );
  const triggerCards = useMemo(
    () =>
      visibleTemplateSource(workflowDefinitions, savedTemplates).map((template) => ({
        detail: template.description || "Reusable workflow template.",
        icon: template.schedule && template.schedule !== "Manual" ? TimerReset : Rocket,
        label: template.trigger || template.schedule || "Manual",
      })),
    [savedTemplates, workflowDefinitions],
  );
  const actionCards = useMemo(
    () =>
      selectedSteps.map((step) => ({
        detail: step.tool || "workflow.step",
        icon: step.requiresApproval ? ShieldCheck : Play,
        label: step.name || step.id || "Workflow step",
      })),
    [selectedSteps],
  );

  function isSavedTemplate(template) {
    return Boolean(template?.id && savedTemplates.some((item) => item.id === template.id));
  }

  function selectTemplate(template) {
    setSelectedTemplate(template);
    setSelectedScheduler(template.schedule || "Manual");
  }

  function openTemplateEditor(template = selectedTemplate) {
    setError("");
    setTemplateEditor({
      description: template.description || "",
      definitionId: template.definitionId || "telemetry_sync",
      id: isSavedTemplate(template) ? template.id : null,
      name: template.name || "",
    });
  }

  function closeTemplateEditor() {
    if (!isSavingTemplate) setTemplateEditor(null);
  }

  async function loadWorkflowData(preferredTemplate = selectedTemplate) {
    setIsLoading(true);
    setError("");

    try {
      const [
        automationResult,
        statusResult,
        jobsResult,
        historyResult,
        automationDefinitionsResult,
        workflowDefinitionsResult,
        templatesResult,
        automationRunsResult,
        workflowRunsResult,
      ] = await Promise.allSettled([
        api.getAutomation(),
        api.getAutomationStatus(),
        api.getAutomationJobs(),
        api.getAutomationHistory(),
        api.getAutomationDefinitions(),
        api.getWorkflowDefinitions(),
        api.getWorkflowTemplates(),
        api.getAutomationRuns(),
        api.getWorkflowRuns(),
      ]);

      if (automationResult.status === "fulfilled") {
        setAutomation(automationResult.value || {});
      }

      if (statusResult.status === "fulfilled") {
        setAutomationStatus(statusResult.value?.data || statusResult.value || null);
      }

      if (jobsResult.status === "fulfilled") {
        setAutomationJobs(Array.isArray(jobsResult.value?.data) ? jobsResult.value.data : []);
      }

      if (historyResult.status === "fulfilled") {
        const records = Array.isArray(historyResult.value?.data)
          ? historyResult.value.data
          : [];
        setAutomationHistory(
          records.length
            ? records.map((item, index) => ({
                detail: item?.detail || item?.message || "Automation history event.",
                result: item?.result || item?.status || "Recorded",
                time: item?.time || item?.createdAt || `Event ${index + 1}`,
                title: item?.title || item?.name || "Automation Event",
              }))
            : fallbackHistory,
        );
      }

      const durableDefinitions =
        workflowDefinitionsResult.status === "fulfilled" &&
        Array.isArray(workflowDefinitionsResult.value?.data)
          ? workflowDefinitionsResult.value.data.map(mapWorkflowDefinition)
          : [];
      const legacyDefinitions =
        automationDefinitionsResult.status === "fulfilled" &&
        Array.isArray(automationDefinitionsResult.value?.data)
          ? automationDefinitionsResult.value.data.map(mapWorkflowDefinition)
          : [];
      const mergedDefinitions = mergeWorkflowDefinitions(durableDefinitions, legacyDefinitions);
      const nextSavedTemplates =
        templatesResult.status === "fulfilled" && Array.isArray(templatesResult.value?.data)
          ? templatesResult.value.data
          : [];

      if (mergedDefinitions.length) {
        setWorkflowDefinitions(mergedDefinitions);
        const nextTemplate =
          nextSavedTemplates.find((item) => item.id === preferredTemplate.id) ||
          mergedDefinitions.find((item) => item.id === preferredTemplate.id) ||
          mergedDefinitions.find(
            (item) => item.definitionId === preferredTemplate.definitionId,
          ) ||
          nextSavedTemplates[0] ||
          mergedDefinitions[0];

        setSelectedTemplate(nextTemplate);
      }

      if (templatesResult.status === "fulfilled") {
        setSavedTemplates(nextSavedTemplates);
      }

      const durableRuns =
        workflowRunsResult.status === "fulfilled" &&
        Array.isArray(workflowRunsResult.value?.data)
          ? workflowRunsResult.value.data
          : [];
      const legacyRuns =
        automationRunsResult.status === "fulfilled" &&
        Array.isArray(automationRunsResult.value?.data)
          ? automationRunsResult.value.data
          : [];
      setWorkflowRuns([
        ...durableRuns,
        ...legacyRuns.filter(
          (legacyRun) => !durableRuns.some((durableRun) => durableRun.id === legacyRun.id),
        ),
      ]);

      setLastSync(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setAutomation({});
      setAutomationStatus(null);
      setAutomationJobs([]);
      setAutomationHistory(fallbackHistory);
      setSavedTemplates([]);
      setWorkflowRuns([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWorkflowData();
  }, []);

  async function handleRunTemplate(template) {
    setIsRunning(true);
    setError("");

    try {
      const response = await api.createWorkflowRun({
        definitionId: template.definitionId || "telemetry_sync",
        input: {
          label: template.name,
        },
        templateId: isSavedTemplate(template) ? template.id : undefined,
      });
      const run = response?.data || response;
      const runStatus = getRunStatus(run) || "created";
      const timestamp = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      selectTemplate(template);
      setRunOutput(formatRunOutput(run, template));
      setWorkflowRuns((current) => [run, ...current.filter((item) => item?.id !== run?.id)].filter(Boolean));
      setAutomationHistory((current) => [
        {
          detail: template.description,
          result: runStatus,
          time: timestamp,
          title: template.name,
        },
        ...current,
      ]);
      await loadWorkflowData(template);
    } catch (runError) {
      setError(getErrorMessage(runError));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleApproveRun(run) {
    if (!run?.id) return;

    setIsRunning(true);
    setError("");

    try {
      const response =
        run.definitionId || run.status
          ? await api.approveWorkflowRun(run.id)
          : await api.approveAutomationRun(run.id);
      const approvedRun = response?.data || response;
      const approvedStatus = getRunStatus(approvedRun) || "approved";
      const timestamp = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setRunOutput(
        `[${timestamp}] Workflow ${approvedStatus}. Provider reached: ${
          approvedRun?.metadata?.providerReached ? "yes" : "no"
        }.`,
      );
      setWorkflowRuns((current) => [
        approvedRun,
        ...current.filter((item) => item?.id !== approvedRun?.id),
      ].filter(Boolean));
      await loadWorkflowData();
    } catch (approvalError) {
      setError(getErrorMessage(approvalError));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCancelRun(run) {
    if (!run?.id) return;

    setIsRunning(true);
    setError("");

    try {
      const response =
        run.definitionId || run.status
          ? await api.cancelWorkflowRun(run.id)
          : await api.cancelAutomationRun(run.id);
      const cancelledRun = response?.data || response;
      const cancelledStatus = getRunStatus(cancelledRun) || "cancelled";

      setRunOutput(`Run ${cancelledStatus}.`);
      setWorkflowRuns((current) => [
        cancelledRun,
        ...current.filter((item) => item?.id !== cancelledRun?.id),
      ].filter(Boolean));
      await loadWorkflowData();
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSaveTemplate() {
    const name = templateEditor?.name?.trim() || "";

    if (!name) {
      setError("Template name is required.");
      return;
    }

    setIsSavingTemplate(true);
    setError("");

    try {
      const payload = {
        action: selectedTemplate.action,
        definitionId: templateEditor.definitionId || selectedTemplate.definitionId || "telemetry_sync",
        description: templateEditor.description.trim(),
        name,
        schedule: selectedScheduler,
        trigger: selectedTemplate.trigger,
      };
      const response = templateEditor.id
        ? await api.updateWorkflowTemplate(templateEditor.id, payload)
        : await api.createWorkflowTemplate(payload);
      const saved = response?.data || response;

      selectTemplate(saved);
      setRunOutput(`Template saved: ${saved.name}. Loading it will not execute a run.`);
      setTemplateEditor(null);
      await loadWorkflowData(saved);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSavingTemplate(false);
    }
  }

  function handleLoadSavedTemplate(template) {
    setTemplateEditor(null);
    selectTemplate(template);
    setRunOutput(`Template loaded: ${template.name}. No workflow run was executed.`);
  }

  function handleEditSavedTemplate(template) {
    selectTemplate(template);
    openTemplateEditor(template);
  }

  async function handleDeleteTemplate(template) {
    setError("");

    try {
      await api.deleteWorkflowTemplate(template.id);
      setSavedTemplates((current) =>
        current.filter((item) => item.id !== template.id),
      );

      const nextTemplate =
        selectedTemplate.id === template.id
          ? workflowDefinitions[0] || workflowTemplates[0]
          : selectedTemplate;

      if (selectedTemplate.id === template.id) {
        setTemplateEditor(null);
        selectTemplate(nextTemplate);
      }
      await loadWorkflowData(nextTemplate);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  const automationScore = automationStatus?.automationScore || automationStatus?.score || 0;
  const visibleTemplates = visibleTemplateSource(workflowDefinitions, savedTemplates);

  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
              WORKFLOW AUTOMATION
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Workflow Automation v1.1
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
              Dashboard automation visual untuk reusable templates, trigger/action,
              pipeline step, scheduler, execution history, dan safe run output.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              onClick={loadWorkflowData}
              type="button">
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunning}
              onClick={() => handleRunTemplate(selectedTemplate)}
              type="button">
              <Play size={16} />
              {isRunning ? "Running..." : "Run Workflow"}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f1c36f]/30 bg-[#f1c36f]/15 px-4 py-3 text-sm font-black text-[#f1c36f] hover:bg-[#f1c36f]/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunning || !pendingApprovalRun}
              onClick={() => handleApproveRun(pendingApprovalRun)}
              type="button">
              <ShieldCheck size={16} />
              Approve
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1">
            {lastSync === "-" ? "Live sync pending" : `Last sync ${lastSync}`}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            {automationEntries.length} automation nodes
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            Score {automationScore || "n/a"}
          </span>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm font-bold text-rose-200">
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Templates" value={visibleTemplates.length} icon={Workflow} />
        <MetricCard label="Triggers" value={triggerCards.length} icon={TimerReset} />
        <MetricCard label="Actions" value={actionCards.length} icon={Play} />
        <MetricCard label="Jobs" value={automationJobs.length || automationHistory.length} icon={Layers3} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(280px,0.88fr)_minmax(0,1fr)_minmax(320px,0.92fr)]">
        <aside className="grid gap-4">
          <Panel title="Workflow Templates" kicker="Templates Library" icon={Workflow}>
            <div className="grid gap-3">
              {visibleTemplates.map((template, index) => {
                const isActive = template.id
                  ? template.id === selectedTemplate.id
                  : template.name === selectedTemplate.name && !selectedTemplate.id;

                return (
                  <button
                    key={`${template.id || template.name}-${template.definitionId || ""}-${index}`}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    onClick={() => selectTemplate(template)}
                    type="button">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{template.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                          {template.trigger || template.schedule || "Manual"}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {isActive ? "Selected" : "Use"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {template.description}
                    </p>
                    <p className="mt-3 text-xs font-bold text-slate-300">
                      Action: {template.action}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Saved Templates" kicker="Reusable" icon={Save}>
            <div className="grid gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 text-sm font-black text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSavingTemplate}
                onClick={() => openTemplateEditor(selectedTemplate)}
                type="button">
                <Save size={16} />
                {isSavedTemplate(selectedTemplate) ? "Update template" : "Save as template"}
              </button>

              {templateEditor && (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                  <div className="grid gap-3">
                    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Template Name
                      <input
                        autoFocus
                        className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                        disabled={isSavingTemplate}
                        maxLength={120}
                        onChange={(event) =>
                          setTemplateEditor((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Reusable workflow name"
                        value={templateEditor.name}
                      />
                    </label>
                    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Description
                      <textarea
                        className="min-h-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                        disabled={isSavingTemplate}
                        maxLength={500}
                        onChange={(event) =>
                          setTemplateEditor((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Optional description"
                        value={templateEditor.description}
                      />
                    </label>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Workflow Definition
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {workflowDefinitions.find(
                          (definition) => definition.definitionId === templateEditor.definitionId,
                        )?.name || templateEditor.definitionId}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-black text-slate-300 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSavingTemplate}
                        onClick={closeTemplateEditor}
                        type="button">
                        Cancel
                      </button>
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSavingTemplate || !templateEditor.name.trim()}
                        onClick={handleSaveTemplate}
                        type="button">
                        <Save size={15} />
                        {isSavingTemplate ? "Saving..." : "Save Template"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoading ? (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm font-bold text-slate-400">
                  Loading saved templates...
                </p>
              ) : savedTemplates.length ? (
                savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-white/10 bg-black/15 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{template.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                          {template.schedule || "Manual"}
                        </p>
                      </div>
                      <button
                        className="grid size-9 shrink-0 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
                        onClick={() => handleDeleteTemplate(template)}
                        title="Delete template"
                        type="button">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {template.description || "Reusable workflow template."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs font-black text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                        onClick={() => handleLoadSavedTemplate(template)}
                        type="button">
                        Load
                      </button>
                      <button
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 text-xs font-black text-emerald-100 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isRunning}
                        onClick={() => handleRunTemplate(template)}
                        type="button">
                        <Play size={13} />
                        Run
                      </button>
                      <button
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 text-xs font-black text-cyan-100 hover:bg-cyan-300/15"
                        onClick={() => handleEditSavedTemplate(template)}
                        type="button">
                        <Pencil size={13} />
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm font-bold text-slate-400">
                  No saved templates yet.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Trigger / Action" kicker="Automation Control" icon={Rocket}>
            <div className="grid gap-3">
              <CardList title="Triggers" items={triggerCards} />
              <CardList title="Actions" items={actionCards} />
            </div>
          </Panel>
        </aside>

        <section className="grid gap-4">
          <Panel title="Pipeline Steps" kicker="Execution Pipeline" icon={Layers3}>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedSteps.map((step, index) => (
                <div
                  key={step.id || step.name}
                  className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-white">{step.name}</p>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                      Step {index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-300">
                    {step.status || (step.requiresApproval ? "Approval required" : "Ready")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {step.tool || step.detail || "Workflow engine step"}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Run Output" kicker="Safe Execution Result" icon={CheckCircle2}>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                {selectedTemplate.name}
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-white">
                {runOutput}
              </p>
            </div>

            {getRunStatus(selectedRun) === "waiting_approval" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/15 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRunning}
                  onClick={() => handleApproveRun(selectedRun)}
                  type="button">
                  <CheckCircle2 size={16} />
                  Approve
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRunning}
                  onClick={() => handleCancelRun(selectedRun)}
                  type="button">
                  Cancel
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Trigger
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {selectedTemplate.trigger || selectedTemplate.schedule || "Manual"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Action
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {selectedTemplate.action}
                </p>
              </div>
            </div>
          </Panel>
        </section>

        <aside className="grid gap-4">
          <Panel title="Scheduler Panel" kicker="Run Cadence" icon={Clock3}>
            <div className="grid gap-2">
              {schedulerOptions.map((item) => {
                const isActive = item.value === selectedScheduler;

                return (
                  <button
                    key={item.value}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    onClick={() => setSelectedScheduler(item.value)}
                    type="button">
                    <span className="text-sm font-bold text-white">{item.label}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {isActive ? "Active" : "Set"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                Next Run
              </p>
              <p className="mt-2 text-sm font-bold text-white">{nextRunLabel}</p>
            </div>
          </Panel>

          <Panel title="Execution History" kicker="Pipeline Log" icon={TimerReset}>
            <div className="grid gap-3">
              {(automationHistory.length ? automationHistory : fallbackHistory).map((item) => (
                <div
                  key={`${item.title}-${item.time}`}
                  className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                      {item.result}
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {item.time}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="text-cyan-300" size={18} />
      <p className="mt-4 text-[10px] font-black tracking-[0.18em] text-slate-500">
        {label.toUpperCase()}
      </p>
      <h3 className="mt-2 text-lg font-black text-white">{value}</h3>
    </article>
  );
}

function Panel({ title, kicker, icon: Icon, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
            {kicker}
          </p>
          <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-300">
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function CardList({ title, items }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const Icon = item.icon || Workflow;

          return (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") {
    const details = [error.code, error.status].filter(Boolean).join(" ");
    return details && !error.message.includes(error.code)
      ? `${error.message} (${details})`
      : error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal memuat workflow automation.";
  }
}
