export const knowledgeReleaseState = [
  { label: "Module", value: "knowledge-base", tone: "text-amber-300" },
  { label: "Version", value: "v3.0", tone: "text-white" },
  { label: "Mode", value: "rag-api", tone: "text-emerald-300" },
];

export const knowledgeCollections = [
  { id: "all", label: "All Knowledge", countLabel: "0 docs" },
  { id: "papua-selatan", label: "Papua Selatan", countLabel: "0 docs" },
  { id: "interview", label: "Interview Bank", countLabel: "0 docs" },
  { id: "verification", label: "Fact Check", countLabel: "0 docs" },
  { id: "multimedia", label: "Multimedia", countLabel: "0 docs" },
  { id: "newsroom", label: "Newsroom SOP", countLabel: "0 docs" },
];

export const initialKnowledgeActivityLog = [
  {
    id: "act-1",
    action: "AI Knowledge Copilot prepared",
    detail: "Production RAG API route ready for authenticated requests.",
    time: "10:24 WIT",
    tone: "green",
  },
  {
    id: "act-2",
    action: "Citation review completed",
    detail: "High reliability sources pinned to fact check collection.",
    time: "09:58 WIT",
    tone: "gold",
  },
  {
    id: "act-3",
    action: "Upload queue staged",
    detail: "Upload panel targets the protected Knowledge RAG API.",
    time: "09:35 WIT",
    tone: "maroon",
  },
];

export const copilotQuickPrompts = [
  {
    id: "qp-summary",
    label: "Summarize active source",
    prompt:
      "Summarize the active newsroom document and list the strongest source context.",
  },
  {
    id: "qp-security",
    label: "Find risks",
    prompt:
      "Find security risks, verification gaps, and sensitive claims in the available knowledge sources.",
  },
  {
    id: "qp-actions",
    label: "Action items",
    prompt:
      "Generate action items for the editor based on the retrieved knowledge context.",
  },
  {
    id: "qp-compare",
    label: "Compare sources",
    prompt:
      "Compare the strongest knowledge sources and explain which one should lead the article.",
  },
];

export const knowledgeCommandActions = [
  {
    id: "summarize-document",
    label: "Summarize document",
    description: "Create a concise editorial summary from retrieved context.",
    prompt: "Summarize document",
    tone: "gold",
  },
  {
    id: "explain-selected-source",
    label: "Explain selected source",
    description: "Explain why the active source matters for newsroom use.",
    prompt: "Explain selected source",
    tone: "green",
  },
  {
    id: "generate-action-items",
    label: "Generate action items",
    description: "Turn retrieved context into editor-ready next steps.",
    prompt: "Generate action items",
    tone: "gold",
  },
  {
    id: "compare-sources",
    label: "Compare sources",
    description: "Compare matching documents and rank source strength.",
    prompt: "Compare sources",
    tone: "green",
  },
  {
    id: "find-security-risks",
    label: "Find security risks",
    description: "Surface verification, privacy, and publication risks.",
    prompt: "Find security risks",
    tone: "maroon",
  },
];
