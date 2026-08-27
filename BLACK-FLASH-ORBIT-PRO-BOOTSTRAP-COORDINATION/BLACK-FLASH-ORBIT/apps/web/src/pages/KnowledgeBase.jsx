import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  Files,
  Folder,
  Gauge,
  Layers3,
  Link2,
  PanelRight,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { UserMenu } from "../components/auth/UserMenu.jsx";
import { CommandCenterSidebar } from "../components/CommandCenterSidebar.jsx";
import { AiKnowledgeCopilot } from "../components/knowledge/AiKnowledgeCopilot.jsx";
import {
  initialKnowledgeActivityLog,
  knowledgeCollections,
  knowledgeReleaseState,
} from "../data/knowledgeUiConfig.js";
import { useProfile } from "../hooks/useProfile.js";
import { useKnowledgeCopilot } from "../hooks/useKnowledgeCopilot.js";
import {
  deleteKnowledgeDocument,
  formatKnowledgeFileSize,
  getKnowledgeDocument,
  getKnowledgeDocuments,
  isKnowledgeMockFallbackEnabled,
  loadKnowledgeMockDocuments,
  searchKnowledgeDocuments,
  uploadKnowledgeDocument,
} from "../services/knowledgeService.js";

function getNowLabel() {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jayapura",
  });
}

const emptyKnowledgeDocument = {
  id: "",
  citations: [],
  collectionId: "all",
  confidence: 0,
  contextChunks: [],
  excerpt: "Upload dokumen untuk mulai memakai Knowledge RAG API.",
  favorite: false,
  owner: "Authenticated User",
  pages: "-",
  source: "Knowledge RAG API",
  status: "Awaiting Upload",
  summary:
    "Belum ada dokumen terindeks. Upload PDF, TXT, MD, atau DOCX untuk membuat chunk, embedding, dan citation source.",
  tags: ["rag-api"],
  title: "No Knowledge Document",
  tokens: "-",
  type: "DOCUMENT",
  updatedAt: "not synced",
};

function mergeKnowledgeDocuments(primaryDocuments, secondaryDocuments = []) {
  const documentsById = new Map();

  [...primaryDocuments, ...secondaryDocuments].forEach((document) => {
    if (document?.id && !documentsById.has(document.id)) {
      documentsById.set(document.id, document);
    }
  });

  return Array.from(documentsById.values());
}

function normalizeKnowledgeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKnowledgeSearchTokens(query) {
  return normalizeKnowledgeSearchText(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function getKnowledgeDocumentSearchText(document) {
  return normalizeKnowledgeSearchText(
    [
      document?.title,
      document?.source,
      document?.type,
      document?.status,
      document?.owner,
      document?.summary,
      document?.excerpt,
      ...(document?.tags || []),
      ...(document?.contextChunks || []),
    ].join(" "),
  );
}

function searchKnowledgeDocumentsLocally(query, documents = []) {
  const tokens = getKnowledgeSearchTokens(query);

  return documents
    .map((document, index) => {
      const searchText = getKnowledgeDocumentSearchText(document);
      const matchedTerms = tokens.filter((token) => searchText.includes(token));
      const score = tokens.length
        ? Math.min(99, Math.round((matchedTerms.length / tokens.length) * 80))
        : Math.max(
            72,
            Math.min(98, Number(document?.confidence || 82) - index),
          );

      return {
        document,
        matchedTerms,
        score,
        snippet:
          document?.summary || document?.excerpt || "No summary available.",
      };
    })
    .filter((result) => !tokens.length || result.matchedTerms.length > 0)
    .sort((first, second) => second.score - first.score);
}

export function KnowledgeBase() {
  const { profile } = useProfile();
  const userRole = profile?.role || "user";
  const [activeCollectionId, setActiveCollectionId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [activityLog, setActivityLog] = useState(initialKnowledgeActivityLog);
  const [uploadState, setUploadState] = useState({
    error: "",
    isUploading: false,
    lastUploaded: "",
    phase: "Ready",
    progress: 0,
    indexedCount: 0,
    queueCount: 0,
  });
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [isUsingMockFallback, setIsUsingMockFallback] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [remoteSearchDocuments, setRemoteSearchDocuments] = useState([]);
  const [deletingDocumentId, setDeletingDocumentId] = useState("");
  const uploadInputRef = useRef(null);
  const failedUploadFilesRef = useRef([]);
  const searchInputRef = useRef(null);
  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ||
    documents[0] ||
    emptyKnowledgeDocument;

  const loadKnowledgeDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    setLibraryError("");

    try {
      const nextDocuments = await getKnowledgeDocuments();

      setDocuments(nextDocuments);
      setIsUsingMockFallback(false);
      setFavoriteIds(
        new Set(
          nextDocuments
            .filter((document) => document.favorite)
            .map((document) => document.id),
        ),
      );
      setUploadState((currentState) => ({
        ...currentState,
        indexedCount: nextDocuments.length,
      }));
    } catch (error) {
      if (String(error?.message || "").includes("Session token missing")) {
        setDocuments([]);
        setIsUsingMockFallback(false);
        setLibraryError("Session token missing. Please login again.");
        return;
      }

      if (isKnowledgeMockFallbackEnabled()) {
        const mockDocuments = await loadKnowledgeMockDocuments();

        setDocuments(mockDocuments);
        setIsUsingMockFallback(true);
        setLibraryError(
          "Development fallback active. Knowledge RAG API belum tersedia.",
        );
        return;
      }

      setDocuments([]);
      setIsUsingMockFallback(false);
      setLibraryError(error?.message || "Knowledge RAG API unavailable.");
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKnowledgeDocuments();
  }, [loadKnowledgeDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sourceDocuments =
      query && remoteSearchDocuments.length ? remoteSearchDocuments : documents;

    return sourceDocuments.filter((document) => {
      const isInCollection =
        activeCollectionId === "all" ||
        document.collectionId === activeCollectionId;

      if (!isInCollection) return false;
      if (query && remoteSearchDocuments.length) return true;
      if (!query) return true;

      return [
        document.title,
        document.source,
        document.type,
        document.summary,
        document.excerpt,
        ...document.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeCollectionId, documents, remoteSearchDocuments, searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query || isUsingMockFallback) {
      setRemoteSearchDocuments([]);
      return undefined;
    }

    const controller = new AbortController();
    let isActive = true;

    searchKnowledgeDocuments(query, { signal: controller.signal })
      .then((nextDocuments) => {
        if (!isActive) return;

        setRemoteSearchDocuments(nextDocuments);
        setDocuments((currentDocuments) =>
          mergeKnowledgeDocuments(currentDocuments, nextDocuments),
        );
      })
      .catch((error) => {
        if (!isActive || error?.name === "AbortError") return;
        setRemoteSearchDocuments([]);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isUsingMockFallback, searchQuery]);

  const addActivity = useCallback((action, detail, tone = "gold") => {
    setActivityLog((currentLog) => [
      {
        id: `${Date.now()}-${action}`,
        action,
        detail,
        time: `${getNowLabel()} WIT`,
        tone,
      },
      ...currentLog.slice(0, 6),
    ]);
  }, []);

  // Keep these handlers above useKnowledgeKeyboardShortcuts.
  // The hook reads them during render; moving the hook above this block
  // reintroduces the TDZ crash that previously broke the page.
  const handleSelectDocument = useCallback(
    async (document) => {
      setSelectedDocumentId(document.id);
      addActivity(
        "Document preview opened",
        `${document.title} loaded in preview panel.`,
        "green",
      );

      if (!document?.id || isUsingMockFallback) return;

      try {
        const previewDocument = await getKnowledgeDocument(document.id);

        setDocuments((currentDocuments) =>
          mergeKnowledgeDocuments([previewDocument], currentDocuments),
        );
      } catch (error) {
        setLibraryError(
          error?.message || "Gagal mengambil preview knowledge document.",
        );
      }
    },
    [addActivity, isUsingMockFallback],
  );

  const toggleFavorite = useCallback(
    (document) => {
      if (!document?.id) return;

      const isFavorite = favoriteIds.has(document.id);

      setFavoriteIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (isFavorite) {
          nextIds.delete(document.id);
        } else {
          nextIds.add(document.id);
        }

        return nextIds;
      });
      addActivity(
        isFavorite ? "Favorite removed" : "Favorite pinned",
        document.title,
        isFavorite ? "maroon" : "gold",
      );
    },
    [addActivity, favoriteIds],
  );

  const openUploadPicker = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleKnowledgeUpload = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length || uploadState.isUploading) return;

      failedUploadFilesRef.current = files;
      setUploadState((currentState) => ({
        ...currentState,
        error: "",
        isUploading: true,
        phase: "Uploading",
        progress: 0,
        queueCount: files.length,
      }));

      try {
        for (const [index, file] of files.entries()) {
          failedUploadFilesRef.current = files.slice(index);
          const uploadedDocument = await uploadKnowledgeDocument({
            file,
            onProgress: (progress) => {
              setUploadState((currentState) => ({
                ...currentState,
                progress: Math.min(100, progress),
              }));
            },
            title: file.name.replace(/\.[^.]+$/, ""),
          });

          if (uploadedDocument?.id) {
            setDocuments((currentDocuments) =>
              mergeKnowledgeDocuments([uploadedDocument], currentDocuments),
            );
            setSelectedDocumentId(uploadedDocument.id);
          }

          addActivity(
            "Knowledge document indexed",
            `${file.name} uploaded to RAG API (${index + 1}/${files.length}).`,
            "green",
          );
          failedUploadFilesRef.current = files.slice(index + 1);
        }

        await loadKnowledgeDocuments();
        failedUploadFilesRef.current = [];
        setUploadState((currentState) => ({
          ...currentState,
          error: "",
          isUploading: false,
          lastUploaded: files[files.length - 1]?.name || "",
          phase: "Indexed",
          progress: 100,
          queueCount: 0,
        }));
      } catch (error) {
        if (String(error?.message || "").includes("Session token missing")) {
          setUploadState((currentState) => ({
            ...currentState,
            error: "Session token missing. Please login again.",
            isUploading: false,
            phase: "Failed",
          }));
          addActivity(
            "Knowledge upload failed",
            "Session token missing. Please login again.",
            "maroon",
          );
          return;
        }

        setUploadState((currentState) => ({
          ...currentState,
          error: error?.message || "Upload knowledge gagal.",
          isUploading: false,
          phase: "Failed",
        }));
        addActivity(
          "Knowledge upload failed",
          error?.message || "Upload knowledge gagal.",
          "maroon",
        );
      }
    },
    [addActivity, loadKnowledgeDocuments, uploadState.isUploading],
  );

  const retryKnowledgeUpload = useCallback(() => {
    if (!failedUploadFilesRef.current.length || uploadState.isUploading) return;

    handleKnowledgeUpload(failedUploadFilesRef.current);
  }, [handleKnowledgeUpload, uploadState.isUploading]);

  const handleDeleteDocument = useCallback(
    async (document) => {
      if (!document?.id || isUsingMockFallback) return;
      if (deletingDocumentId === document.id) return;
      if (!window.confirm(`Hapus "${document.title}" dari Knowledge RAG?`)) {
        return;
      }

      setDeletingDocumentId(document.id);
      setLibraryError("");

      try {
        await deleteKnowledgeDocument(document.id);
        addActivity("Knowledge document deleted", document.title, "maroon");
        if (selectedDocumentId === document.id) {
          setSelectedDocumentId("");
        }
        await loadKnowledgeDocuments();
      } catch (error) {
        setLibraryError(
          error?.message || "Gagal menghapus knowledge document.",
        );
        addActivity(
          "Knowledge delete failed",
          error?.message || "Gagal menghapus knowledge document.",
          "maroon",
        );
      } finally {
        setDeletingDocumentId("");
      }
    },
    [
      addActivity,
      deletingDocumentId,
      isUsingMockFallback,
      loadKnowledgeDocuments,
      selectedDocumentId,
    ],
  );

  const copilot = useKnowledgeCopilot({
    activeDocument: selectedDocument,
    documents,
    onActivity: addActivity,
  });

  const semanticResults = useMemo(() => {
    const query = searchQuery.trim();
    const remoteResults =
      query && remoteSearchDocuments.length
        ? remoteSearchDocuments.map((document) => ({
            document,
            score: Math.max(65, Number(document.confidence || 0)),
          }))
        : [];

    return (
      remoteResults.length
        ? remoteResults
        : searchKnowledgeDocumentsLocally(searchQuery, filteredDocuments)
    ).slice(0, 4);
  }, [filteredDocuments, remoteSearchDocuments, searchQuery]);

  const favoriteDocuments = useMemo(
    () => documents.filter((document) => favoriteIds.has(document.id)),
    [documents, favoriteIds],
  );

  useEffect(() => {
    if (!filteredDocuments.length) {
      setSelectedDocumentId("");
      return;
    }

    if (
      filteredDocuments.some((document) => document.id === selectedDocumentId)
    ) {
      return;
    }

    setSelectedDocumentId(filteredDocuments[0].id);
  }, [filteredDocuments, selectedDocumentId]);

  const metrics = useMemo(
    () => [
      {
        icon: Files,
        label: "Documents",
        value: documents.length,
        detail: isUsingMockFallback ? "dev fallback" : "rag indexed",
      },
      {
        icon: Database,
        label: "RAG Ready",
        value: documents.filter((document) => document.status === "Indexed")
          .length,
        detail: "vector indexed",
      },
      {
        icon: Link2,
        label: "Citations",
        value: copilot.citations.length,
        detail: "latest answer",
      },
      {
        icon: Star,
        label: "Favorites",
        value: favoriteDocuments.length,
        detail: "pinned docs",
      },
    ],
    [
      copilot.citations.length,
      documents,
      favoriteDocuments.length,
      isUsingMockFallback,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function syncHashTarget() {
      const targetId = window.location.hash.replace("#", "");
      if (!targetId) return;

      if (targetId === "copilot") {
        setIsCopilotOpen(true);
      }

      window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }

    syncHashTarget();
    window.addEventListener("hashchange", syncHashTarget);

    return () => window.removeEventListener("hashchange", syncHashTarget);
  }, []);

  useKnowledgeKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onOpenCopilot: () => setIsCopilotOpen(true),
    onCloseCopilot: () => setIsCopilotOpen(false),
    onToggleFavorite: toggleFavorite,
    onToggleUpload: openUploadPicker,
    setActiveCollectionId,
    selectedDocument,
  });

  const copilotProps = {
    activeDocument: selectedDocument,
    citations: copilot.citations,
    commandActions: copilot.commandActions,
    confidence: copilot.confidence,
    isLoading: copilot.isLoading,
    messages: copilot.messages,
    onRunCommandAction: copilot.runCommandAction,
    onSubmitQuestion: copilot.submitQuestion,
    quickPrompts: copilot.quickPrompts,
    selectedContext: copilot.selectedContext,
  };
  const releaseState = useMemo(
    () =>
      knowledgeReleaseState.map((item) =>
        item.label === "Mode"
          ? {
              ...item,
              tone: isUsingMockFallback ? "text-amber-300" : "text-emerald-300",
              value: isUsingMockFallback ? "dev-fallback" : "rag-api",
            }
          : item,
      ),
    [isUsingMockFallback],
  );
  const collectionItems = useMemo(
    () =>
      knowledgeCollections.map((collection) => {
        const count =
          collection.id === "all"
            ? documents.length
            : documents.filter(
                (document) => document.collectionId === collection.id,
              ).length;

        return {
          ...collection,
          countLabel: `${count} docs`,
        };
      }),
    [documents],
  );

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar releaseState={releaseState} userRole={userRole} />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Knowledge Base v3.0</p>
              <h1 className="text-xl font-black text-white md:text-2xl">
                AI Knowledge Copilot Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-label="Knowledge notifications"
                className="orbit-icon-button"
                type="button"
              >
                <Bell size={18} />
              </button>
              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6">
            <KnowledgeHero
              isDocumentsLoading={isDocumentsLoading}
              isUsingMockFallback={isUsingMockFallback}
              libraryError={libraryError}
              metrics={metrics}
              onOpenCopilot={() => setIsCopilotOpen(true)}
              selectedDocument={selectedDocument}
            />

            <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_420px]">
              <CollectionSidebar
                activeCollectionId={activeCollectionId}
                collections={collectionItems}
                onSelectCollection={setActiveCollectionId}
              />

              <div className="grid gap-4">
                <SemanticSearchPanel
                  id="knowledge-search"
                  onSearchChange={setSearchQuery}
                  onSelectDocument={handleSelectDocument}
                  query={searchQuery}
                  inputRef={searchInputRef}
                  results={semanticResults}
                />
                <DocumentLibrary
                  deletingDocumentId={deletingDocumentId}
                  documents={filteredDocuments}
                  favoriteIds={favoriteIds}
                  isUsingMockFallback={isUsingMockFallback}
                  onDeleteDocument={handleDeleteDocument}
                  onSelectDocument={handleSelectDocument}
                  onToggleFavorite={toggleFavorite}
                  selectedDocumentId={selectedDocument.id}
                />
                <DocumentPreview document={selectedDocument} />
              </div>

              <aside className="hidden xl:block">
                <AiKnowledgeCopilot {...copilotProps} variant="panel" />
              </aside>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-4 lg:grid-cols-2">
                <SourceCitationCards
                  citations={copilot.citations}
                  document={selectedDocument}
                />
                <RagContextPreview
                  document={selectedDocument}
                  id="knowledge-rag-preview"
                  selectedContext={copilot.selectedContext}
                />
              </div>

              <aside className="grid gap-4 content-start">
                <UploadPanel
                  canRetryUpload={Boolean(failedUploadFilesRef.current.length)}
                  inputRef={uploadInputRef}
                  isUsingMockFallback={isUsingMockFallback}
                  onRetryUpload={retryKnowledgeUpload}
                  onSelectFiles={handleKnowledgeUpload}
                  onTriggerUpload={openUploadPicker}
                  uploadState={uploadState}
                />
                <FavoritesPanel
                  documents={favoriteDocuments}
                  id="knowledge-favorites"
                  onSelectDocument={handleSelectDocument}
                />
                <ActivityLog entries={activityLog} />
              </aside>
            </section>
          </div>
        </section>
      </div>

      <button
        aria-label="Open AI Knowledge Copilot"
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57] px-4 text-sm font-black text-black shadow-2xl shadow-black/40 xl:hidden"
        onClick={() => setIsCopilotOpen(true)}
        type="button"
      >
        <BrainCircuit size={18} />
        AI Copilot
      </button>

      {isCopilotOpen ? (
        <AiKnowledgeCopilot
          {...copilotProps}
          onClose={() => setIsCopilotOpen(false)}
          variant="drawer"
        />
      ) : null}
    </main>
  );
}

function useKnowledgeKeyboardShortcuts({
  onFocusSearch,
  onOpenCopilot,
  onCloseCopilot,
  onToggleFavorite,
  onToggleUpload,
  setActiveCollectionId,
  selectedDocument,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      const key = event.key.toLowerCase();
      const hasMod = event.ctrlKey || event.metaKey;

      if (event.ctrlKey && event.shiftKey && key === "k") {
        event.preventDefault();
        onOpenCopilot();
        return;
      }

      if (hasMod && event.shiftKey && key === "f") {
        event.preventDefault();
        onToggleFavorite(selectedDocument);
        return;
      }

      if (hasMod && event.shiftKey && key === "u") {
        event.preventDefault();
        onToggleUpload();
        return;
      }

      if (!hasMod && key === "/" && !isTypingField) {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (key === "escape") {
        onCloseCopilot();
        return;
      }

      if (isTypingField) return;

      if (key === "1") {
        event.preventDefault();
        setActiveCollectionId("all");
        return;
      }

      if (key === "2") {
        event.preventDefault();
        setActiveCollectionId("papua-selatan");
        return;
      }

      if (key === "3") {
        event.preventDefault();
        setActiveCollectionId("interview");
        return;
      }

      if (key === "4") {
        event.preventDefault();
        setActiveCollectionId("verification");
        return;
      }

      if (key === "5") {
        event.preventDefault();
        setActiveCollectionId("multimedia");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onCloseCopilot,
    onFocusSearch,
    onOpenCopilot,
    onToggleFavorite,
    onToggleUpload,
    selectedDocument,
    setActiveCollectionId,
  ]);
}

function KnowledgeHero({
  isDocumentsLoading,
  isUsingMockFallback,
  libraryError,
  metrics,
  onOpenCopilot,
  selectedDocument,
}) {
  return (
    <section className="rounded-lg border border-[#d9ad57]/20 bg-[linear-gradient(135deg,_rgba(217,173,87,0.13),_rgba(125,31,47,0.24)_42%,_rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-black/30 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <span className="grid size-12 place-items-center rounded-lg border border-[#d9ad57]/30 bg-[#d9ad57]/10 text-[#d9ad57]">
            <BrainCircuit size={24} />
          </span>
          <p className="mt-5 orbit-kicker">Protected Knowledge Route</p>
          <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">
            Source-aware AI copilot for newsroom knowledge.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Production RAG API untuk upload dokumen, chunking, embedding
            pgvector, retrieved context, source citation cards, confidence
            score, quick prompts, command actions, favorites, dan activity log
            dengan Supabase Bearer auth.
          </p>
          {libraryError ? (
            <p className="mt-3 rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-3 py-2 text-xs font-bold text-[#f1c36f]">
              {isUsingMockFallback
                ? libraryError
                : `Knowledge API warning: ${libraryError}`}
            </p>
          ) : null}
          <button
            aria-label="Open AI Knowledge Copilot panel"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20 xl:hidden"
            onClick={onOpenCopilot}
            type="button"
          >
            <Sparkles size={16} />
            Open AI Copilot
          </button>
        </div>

        <div className="grid content-start gap-3 rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Active Preview
              </p>
              <h3 className="mt-2 text-lg font-black text-white">
                {selectedDocument.title}
              </h3>
            </div>
            <Gauge className="text-[#d9ad57]" size={24} />
          </div>
          <StatusLine
            label="Confidence"
            value={`${selectedDocument.confidence}%`}
          />
          <StatusLine label="Owner" value={selectedDocument.owner} />
          <StatusLine label="Updated" value={selectedDocument.updatedAt} />
          <StatusLine
            label="API"
            value={
              isDocumentsLoading
                ? "Syncing"
                : isUsingMockFallback
                  ? "Dev fallback"
                  : "RAG live"
            }
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <MetricTile key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}

function MetricTile({ detail, icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <Icon className="text-[#d9ad57]" size={22} />
      </div>
      <p className="mt-3 text-xs font-bold text-zinc-500">{detail}</p>
    </article>
  );
}

function CollectionSidebar({
  activeCollectionId,
  collections,
  onSelectCollection,
}) {
  return (
    <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg border border-[#7d1f2f]/35 bg-[#7d1f2f]/20 text-[#f1c36f]">
          <Folder size={18} />
        </span>
        <div>
          <p className="orbit-kicker">Collections</p>
          <h2 className="text-lg font-black text-white">Source Groups</h2>
        </div>
      </div>

      <nav aria-label="Knowledge collections" className="mt-4 grid gap-2">
        {collections.map((collection) => {
          const isActive = activeCollectionId === collection.id;

          return (
            <button
              aria-label={`Open ${collection.label}`}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-bold transition ${
                isActive
                  ? "border-[#d9ad57]/35 bg-[#d9ad57]/12 text-white"
                  : "border-white/10 bg-black/20 text-zinc-400 hover:border-[#d9ad57]/25 hover:text-white"
              }`}
              key={collection.id}
              onClick={() => onSelectCollection(collection.id)}
              type="button"
            >
              <span className="min-w-0 truncate">{collection.label}</span>
              <span className="shrink-0 text-[10px] font-black uppercase text-zinc-500">
                {collection.countLabel}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 rounded-lg border border-[#7d1f2f]/30 bg-[#7d1f2f]/16 p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#f1c36f]">
          <ShieldCheck size={14} />
          Protected
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Route tetap berada di bawah auth guard yang sudah ada.
        </p>
      </div>
    </aside>
  );
}

function SemanticSearchPanel({
  id,
  inputRef,
  onSearchChange,
  onSelectDocument,
  query,
  results,
}) {
  return (
    <section
      className="scroll-mt-24 rounded-lg border border-white/10 bg-white/[0.035] p-4"
      id={id}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Search Knowledge</p>
          <h2 className="mt-1 text-lg font-black text-white">Context Match</h2>
        </div>
        <Sparkles className="text-[#d9ad57]" size={22} />
      </div>

      <label className="mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 text-zinc-500 transition focus-within:border-[#d9ad57]/45">
        <Search size={17} />
        <input
          aria-label="Search knowledge documents"
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:shadow-none"
          ref={inputRef}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Cari sumber, kutipan, isu, atau konteks RAG..."
          type="search"
          value={query}
        />
      </label>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {results.length ? (
          results.map(({ document, score }) => (
            <button
              aria-label={`Open ${document.title}`}
              className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#d9ad57]/35 hover:bg-[#d9ad57]/8"
              key={document.id}
              onClick={() => onSelectDocument(document)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {document.title}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {document.source}
                  </p>
                </div>
                <span className="rounded-md border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-2 py-1 text-[10px] font-black text-[#f1c36f]">
                  {score}%
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-400">
                {document.summary}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-bold text-zinc-500 md:col-span-2">
            No matching documents.
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentLibrary({
  deletingDocumentId,
  documents,
  favoriteIds,
  isUsingMockFallback,
  onDeleteDocument,
  onSelectDocument,
  onToggleFavorite,
  selectedDocumentId,
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="orbit-kicker">Document Library</p>
          <h2 className="mt-1 text-lg font-black text-white">
            {documents.length} Sources
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
          <BookOpenText size={14} />
          Indexed
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {documents.length ? (
          documents.map((document) => {
            const isSelected = document.id === selectedDocumentId;
            const isFavorite = favoriteIds.has(document.id);

            return (
              <article
                className={`rounded-lg border p-4 transition ${
                  isSelected
                    ? "border-[#d9ad57]/40 bg-[#d9ad57]/10"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
                key={document.id}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <button
                    aria-label={`Preview ${document.title}`}
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectDocument(document)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400">
                        {document.type}
                      </span>
                      <StatusBadge status={document.status} />
                    </div>
                    <h3 className="mt-3 text-base font-black text-white">
                      {document.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {document.summary}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      aria-label={
                        isFavorite
                          ? `Remove ${document.title} from favorites`
                          : `Add ${document.title} to favorites`
                      }
                      className={`grid size-10 place-items-center rounded-lg border transition ${
                        isFavorite
                          ? "border-[#d9ad57]/35 bg-[#d9ad57]/15 text-[#f1c36f]"
                          : "border-white/10 bg-white/[0.04] text-zinc-500 hover:border-[#d9ad57]/30 hover:text-[#f1c36f]"
                      }`}
                      onClick={() => onToggleFavorite(document)}
                      type="button"
                    >
                      <Star
                        fill={isFavorite ? "currentColor" : "none"}
                        size={17}
                      />
                    </button>
                    <button
                      aria-label={`Open ${document.title}`}
                      className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-[#d9ad57]/30 hover:text-white"
                      onClick={() => onSelectDocument(document)}
                      type="button"
                    >
                      <ChevronRight size={17} />
                    </button>
                    <button
                      aria-label={`Delete ${document.title}`}
                      className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:border-[#7d1f2f]/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={
                        isUsingMockFallback ||
                        deletingDocumentId === document.id
                      }
                      onClick={() => onDeleteDocument(document)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <InfoPill label="Owner" value={document.owner} />
                  <InfoPill label="Tokens" value={document.tokens} />
                  <InfoPill label="Updated" value={document.updatedAt} />
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-5 text-sm font-bold text-zinc-500">
            No matching documents.
          </div>
        )}
      </div>
    </section>
  );
}

function UploadPanel({
  canRetryUpload,
  inputRef,
  isUsingMockFallback,
  onRetryUpload,
  onSelectFiles,
  onTriggerUpload,
  uploadState,
}) {
  const isReady = uploadState.phase === "Ready";

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Upload Panel</p>
          <h2 className="mt-1 text-lg font-black text-white">RAG Intake</h2>
        </div>
        <UploadCloud className="text-[#d9ad57]" size={22} />
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-[#d9ad57]/30 bg-black/25 p-4 text-center">
        <UploadCloud className="mx-auto text-[#d9ad57]" size={28} />
        <p className="mt-3 text-sm font-black text-white">Upload to RAG API</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          PDF, TXT, MD, atau DOCX. File dikirim ke backend protected, disimpan
          di Supabase Storage, lalu diindeks dengan embeddings.
        </p>
        <input
          accept=".pdf,.txt,.md,.docx"
          className="hidden"
          multiple
          onChange={(event) => {
            onSelectFiles(event.target.files);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <StatusLine label="Upload phase" value={uploadState.phase} />
          <StatusLine
            label="Indexed docs"
            value={String(uploadState.indexedCount)}
          />
          <StatusLine
            label="Queue size"
            value={String(uploadState.queueCount)}
          />
          <StatusLine
            label="Mode"
            value={
              isUsingMockFallback
                ? "Dev fallback"
                : isReady
                  ? "Awaiting files"
                  : "RAG indexing active"
            }
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-full border border-white/10 bg-black/40">
          <div
            className="h-2 bg-[#d9ad57] transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, uploadState.progress))}%`,
            }}
          />
        </div>

        {uploadState.lastUploaded ? (
          <p className="mt-3 text-xs font-bold text-zinc-500">
            Last upload: {uploadState.lastUploaded}
          </p>
        ) : null}

        {uploadState.error ? (
          <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-bold text-rose-100">
            {uploadState.error}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              Supported files
            </p>
            <p className="mt-1 text-xs font-bold text-zinc-500">
              PDF, TXT, MD, DOCX up to{" "}
              {formatKnowledgeFileSize(10 * 1024 * 1024)}
            </p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400">
            protected
          </span>
        </div>
      </div>

      {isUsingMockFallback ? (
        <div className="mt-4 rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 p-3 text-xs leading-5 text-[#f1c36f]">
          Development fallback active. Upload is disabled until Knowledge RAG
          API is reachable.
        </div>
      ) : null}

      <button
        aria-label="Upload knowledge documents"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={uploadState.isUploading || isUsingMockFallback}
        onClick={onTriggerUpload}
        type="button"
      >
        <CheckCircle2 size={16} />
        {uploadState.isUploading ? "Indexing..." : "Upload & Index Document"}
      </button>
      {uploadState.phase === "Failed" && canRetryUpload ? (
        <button
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-black text-white transition hover:border-[#d9ad57]/30 hover:text-[#f1c36f] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={uploadState.isUploading || isUsingMockFallback}
          onClick={onRetryUpload}
          type="button"
        >
          Retry Failed Upload
        </button>
      ) : null}
    </section>
  );
}

function FavoritesPanel({ documents, id, onSelectDocument }) {
  return (
    <section
      className="scroll-mt-24 rounded-lg border border-white/10 bg-white/[0.035] p-4"
      id={id}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Favorites</p>
          <h2 className="mt-1 text-lg font-black text-white">Pinned Sources</h2>
        </div>
        <Star className="text-[#d9ad57]" fill="currentColor" size={21} />
      </div>

      <div className="mt-4 grid gap-2">
        {documents.length ? (
          documents.map((document) => (
            <button
              aria-label={`Open favorite ${document.title}`}
              className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#d9ad57]/30"
              key={document.id}
              onClick={() => onSelectDocument(document)}
              type="button"
            >
              <p className="text-sm font-black text-white">{document.title}</p>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                {document.owner}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm font-bold text-zinc-500">
            Belum ada dokumen favorit.
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentPreview({ document }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="orbit-kicker">Document Preview</p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {document.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            {document.excerpt}
          </p>
        </div>
        <div className="rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f1c36f]">
            Confidence
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {document.confidence}%
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPill label="Type" value={document.type} />
        <InfoPill label="Pages" value={document.pages} />
        <InfoPill label="Source" value={document.source} />
        <InfoPill label="Status" value={document.status} />
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-black/25 p-4">
        <div className="flex items-center gap-2">
          <PanelRight className="text-[#d9ad57]" size={18} />
          <h3 className="text-sm font-black text-white">Editorial Notes</h3>
        </div>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          {document.summary}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {document.tags.map((tag) => (
          <span
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400"
            key={tag}
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function SourceCitationCards({ citations = [], document }) {
  const displayedCitations = citations.length ? citations : document.citations;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Selected Source Citations</p>
          <h2 className="mt-1 text-lg font-black text-white">
            {displayedCitations.length} Cards
          </h2>
        </div>
        <Link2 className="text-[#d9ad57]" size={21} />
      </div>

      <div className="mt-4 grid gap-3">
        {displayedCitations.length ? (
          displayedCitations.map((citation) => (
            <article
              className="rounded-lg border border-white/10 bg-black/20 p-3"
              key={citation.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    {citation.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {citation.locator}
                  </p>
                </div>
                <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">
                  {citation.reliability}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-400">
                {citation.quote}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-bold text-zinc-500">
            No citations.
          </div>
        )}
      </div>
    </section>
  );
}

function RagContextPreview({ document, id, selectedContext = [] }) {
  const contextChunks = selectedContext.length
    ? selectedContext.flatMap((item) => item.chunks || [])
    : document.contextChunks;

  return (
    <section
      className="scroll-mt-24 rounded-lg border border-white/10 bg-white/[0.035] p-4"
      id={id}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">RAG Context Preview</p>
          <h2 className="mt-1 text-lg font-black text-white">
            Injected Context
          </h2>
        </div>
        <Layers3 className="text-[#d9ad57]" size={21} />
      </div>

      <div className="mt-4 grid gap-2">
        {contextChunks.length ? (
          contextChunks.map((chunk, index) => (
            <div
              className="rounded-lg border border-white/10 bg-black/25 p-3"
              key={chunk}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
                Chunk {index + 1}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-300">{chunk}</p>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-bold text-zinc-500">
            No context retrieved.
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityLog({ entries }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Activity Log</p>
          <h2 className="mt-1 text-lg font-black text-white">Recent Events</h2>
        </div>
        <Activity className="text-[#d9ad57]" size={21} />
      </div>

      <div className="mt-4 grid gap-3">
        {entries.map((entry) => (
          <article
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
            key={entry.id}
          >
            <span
              className={`mt-1 size-2 rounded-full ${getActivityTone(entry.tone)}`}
            />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-white">{entry.action}</p>
                <span className="shrink-0 text-[10px] font-black uppercase text-zinc-500">
                  {entry.time}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {entry.detail}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-xs font-black text-zinc-200">
        {value}
      </span>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-zinc-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const className =
    status === "Verified"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : status === "Needs Review"
        ? "border-[#d9ad57]/25 bg-[#d9ad57]/10 text-[#f1c36f]"
        : "border-white/10 bg-white/[0.04] text-zinc-300";

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${className}`}
    >
      {status}
    </span>
  );
}

function getActivityTone(tone) {
  if (tone === "green") {
    return "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]";
  }

  if (tone === "maroon") {
    return "bg-[#b4233a] shadow-[0_0_14px_rgba(180,35,58,0.8)]";
  }

  return "bg-[#d9ad57] shadow-[0_0_14px_rgba(217,173,87,0.8)]";
}
