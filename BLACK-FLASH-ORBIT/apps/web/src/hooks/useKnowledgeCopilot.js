import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  copilotQuickPrompts,
  knowledgeCommandActions,
} from "../data/knowledgeUiConfig.js";
import {
  askKnowledge,
  createKnowledgeMockFallbackResult,
  isKnowledgeMockFallbackEnabled,
} from "../services/knowledgeService.js";

function createMessage(role, content, meta = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jayapura",
    }),
    ...meta,
  };
}

function getScopedDocuments(documents, activeDocument, actionId) {
  if (!activeDocument?.id) return documents;
  if (actionId === "compare-sources" || actionId === "find-security-risks") {
    return [
      activeDocument,
      ...documents.filter((item) => item.id !== activeDocument.id),
    ];
  }

  return [activeDocument];
}

function getActiveDocumentId(activeDocument, actionId) {
  if (!activeDocument?.id) return "";
  if (actionId === "compare-sources" || actionId === "find-security-risks") {
    return "";
  }

  return activeDocument.id;
}

export function useKnowledgeCopilot({
  activeDocument,
  documents = [],
  onActivity,
} = {}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState([]);
  const [citations, setCitations] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const abortRef = useRef(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const quickPrompts = useMemo(() => copilotQuickPrompts, []);
  const commandActions = useMemo(() => knowledgeCommandActions, []);

  useEffect(() => {
    if (!activeDocument?.id) {
      setSelectedContext([]);
      setCitations([]);
      setConfidence(0);
      return;
    }

    const nextCitations = Array.isArray(activeDocument.citations)
      ? activeDocument.citations
      : [];

    setSelectedContext(
      activeDocument.contextChunks?.length
        ? [
            {
              chunks: activeDocument.contextChunks,
              id: activeDocument.id,
              score: activeDocument.confidence || 0,
              source: activeDocument.source,
              title: activeDocument.title,
            },
          ]
        : [],
    );
    setCitations(nextCitations);
    setConfidence(activeDocument.confidence || 0);
  }, [activeDocument]);

  const executeQuery = useCallback(
    async (rawQuery, options = {}) => {
      const query = String(rawQuery || "").trim();
      if (!query || isLoading) return;

      const scopedDocuments = options.documents || documents;
      const userLabel = options.userLabel || query;
      const documentId =
        options.documentId ??
        getActiveDocumentId(activeDocument, options.actionId);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("user", userLabel, {
          actionId: options.actionId || null,
        }),
      ]);

      try {
        let result;

        try {
          result = await askKnowledge({
            documentId,
            question: query,
            signal: abortRef.current.signal,
          });
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          if (!isKnowledgeMockFallbackEnabled()) throw error;

          result = await createKnowledgeMockFallbackResult(
            query,
            scopedDocuments,
          );
        }

        setSelectedContext(result.context);
        setCitations(result.citations);
        setConfidence(result.confidence);
        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", result.answer, {
            actionId: options.actionId || null,
            citationCount: result.citations.length,
            confidence: result.confidence,
            mode: result.mode,
            verificationRequired: result.verificationRequired,
          }),
        ]);

        onActivity?.(
          options.activityTitle || "AI question asked",
          result.context.length
            ? `${userLabel} returned ${result.context.length} RAG context match(es).`
            : `${userLabel} requires additional verification.`,
          options.tone || (result.context.length ? "green" : "maroon"),
        );
      } catch (error) {
        if (error?.name === "AbortError") return;

        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage(
            "assistant",
            error?.message ||
              "Knowledge RAG request failed. Verification required.",
            {
              actionId: options.actionId || null,
              confidence: 0,
              verificationRequired: true,
            },
          ),
        ]);
        onActivity?.(
          "AI question failed",
          error?.message || "Knowledge RAG API unavailable.",
          "maroon",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeDocument, documents, isLoading, onActivity],
  );

  const submitQuestion = useCallback(
    (question) => {
      executeQuery(question, {
        activityTitle: "AI question asked",
        tone: "green",
      });
    },
    [executeQuery],
  );

  const runCommandAction = useCallback(
    (action) => {
      if (!action) return;

      const scopedDocuments = getScopedDocuments(
        documents,
        activeDocument,
        action.id,
      );
      const activeTitle = activeDocument?.title || "all knowledge sources";
      const query = `${action.prompt}: ${activeTitle}`;

      executeQuery(query, {
        actionId: action.id,
        activityTitle: `AI action: ${action.label}`,
        documents: scopedDocuments,
        tone: action.tone || "gold",
        userLabel: action.label,
      });
    },
    [activeDocument, documents, executeQuery],
  );

  return {
    citations,
    commandActions,
    confidence,
    isLoading,
    messages,
    quickPrompts,
    runCommandAction,
    selectedContext,
    submitQuestion,
  };
}
