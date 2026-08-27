import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Clock3,
  Download,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  createChatSession,
  deleteChatSession,
  getChatPersistenceErrorMessage,
  getChatMessages,
  getChatSessions,
  getOrCreateActiveChatSession,
  renameChatSession,
  saveChatMessage,
  togglePinChatSession,
  updateChatSessionModel,
} from "../services/chatPersistence";
import {
  getConversationSearchErrorMessage,
  searchConversations,
} from "../services/conversationSearch";
import { PromptLibrary } from "../components/PromptLibrary";

const modelOptions = [
  { label: "OpenRouter Auto", value: "openrouter/auto" },
  { label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
  { label: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
  { label: "Claude 3.5 Haiku", value: "anthropic/claude-3.5-haiku" },
  { label: "DeepSeek Chat", value: "deepseek/deepseek-chat" },
];

export function AIWorkspace() {
  const { user } = useAuth();
  const userEmail = typeof user?.email === "string" ? user.email.trim() : "";
  const [selectedModel, setSelectedModel] = useState("openrouter/auto");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [
    debouncedConversationSearchQuery,
    setDebouncedConversationSearchQuery,
  ] = useState("");
  const [conversationSearchResults, setConversationSearchResults] = useState(
    [],
  );
  const [conversationSearchError, setConversationSearchError] = useState("");
  const [isConversationSearchLoading, setIsConversationSearchLoading] =
    useState(false);
  const [renameDialogSession, setRenameDialogSession] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteDialogSession, setDeleteDialogSession] = useState(null);
  const [isSessionActionLoading, setIsSessionActionLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesSessionId, setMessagesSessionId] = useState("");
  const messageLoadRequestIdRef = useRef(0);

  const conversationCount = useMemo(
    () => (messages || []).filter((message) => message?.role === "user").length,
    [messages],
  );
  const selectedModelLabel =
    modelOptions.find((model) => model.value === selectedModel)?.label ||
    selectedModel;
  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const safeMessages = Array.isArray(messages) ? messages : [];

    if (!query) return safeMessages;

    return safeMessages.filter((message) =>
      [message.content, message.model, message.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [messages, searchQuery]);
  const filteredSessions = useMemo(() => {
    const query = sessionSearchQuery.trim().toLowerCase();
    const safeSessions = Array.isArray(sessions) ? sessions : [];

    if (!query) return safeSessions;

    return safeSessions.filter((session) =>
      String(session?.title || "")
        .toLowerCase()
        .includes(query),
    );
  }, [sessionSearchQuery, sessions]);
  const latestUserPrompt = useMemo(() => {
    return [...(messages || [])]
      .reverse()
      .find((message) => message?.role === "user")?.content || "";
  }, [messages]);
  const latestAssistantResponse = useMemo(() => {
    return [...(messages || [])]
      .reverse()
      .find((message) => message?.role === "assistant")?.content || "";
  }, [messages]);
  const workspaceSummary = useMemo(
    () => ({
      activeSessionTitle: activeSession?.title || "Prompt Console",
      latestOutput: latestAssistantResponse || "Output AI akan tampil di sini.",
      latestPrompt: latestUserPrompt || "Belum ada prompt aktif.",
      messageCount: messages.length,
      sessionCount: sessions.length,
    }),
    [
      activeSession?.title,
      latestAssistantResponse,
      latestUserPrompt,
      messages.length,
      sessions.length,
    ],
  );
  const loadSessionMessages = useCallback(async (sessionId) => {
    const targetSessionId = String(sessionId || "").trim();
    const requestId = messageLoadRequestIdRef.current + 1;
    messageLoadRequestIdRef.current = requestId;

    setMessages([]);
    setMessagesSessionId(targetSessionId);

    if (!targetSessionId) {
      return [];
    }

    const databaseMessages = await getChatMessages(targetSessionId);

    if (messageLoadRequestIdRef.current === requestId) {
      setMessages(databaseMessages);
      setMessagesSessionId(targetSessionId);
    }

    return databaseMessages;
  }, []);

  const refreshSessions = useCallback(async (targetUserEmail) => {
    const databaseSessions = await getChatSessions(targetUserEmail);
    setSessions(databaseSessions);
    return databaseSessions;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeChatSession() {
      if (!userEmail) {
        messageLoadRequestIdRef.current += 1;
        setActiveSession(null);
        setMessages([]);
        setMessagesSessionId("");
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      setError("");

      try {
        const session = await getOrCreateActiveChatSession({
          model: selectedModel,
          userEmail,
        });
        const databaseSessions = await refreshSessions(userEmail);

        if (!isMounted) return;

        const sessionFromList =
          databaseSessions.find((item) => item.id === session.id) || session;

        setActiveSession(sessionFromList);
        setSelectedModel(sessionFromList.model || selectedModel);
        await loadSessionMessages(sessionFromList.id);
      } catch (sessionError) {
        if (!isMounted) return;

        setError(
          getChatPersistenceErrorMessage(sessionError) ||
            "Gagal memuat session dan history chat dari Supabase.",
        );
        messageLoadRequestIdRef.current += 1;
        setMessages([]);
        setMessagesSessionId("");
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    initializeChatSession();

    return () => {
      isMounted = false;
    };
  }, [loadSessionMessages, refreshSessions, userEmail]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedConversationSearchQuery(conversationSearchQuery.trim());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [conversationSearchQuery]);

  useEffect(() => {
    let isMounted = true;

    async function loadConversationSearchResults() {
      if (!userEmail || !debouncedConversationSearchQuery) {
        setConversationSearchResults([]);
        setConversationSearchError("");
        setIsConversationSearchLoading(false);
        return;
      }

      setIsConversationSearchLoading(true);
      setConversationSearchError("");

      try {
        const results = await searchConversations({
          query: debouncedConversationSearchQuery,
          userId: userEmail,
        });

        if (!isMounted) return;

        setConversationSearchResults(results);
      } catch (searchError) {
        if (!isMounted) return;

        setConversationSearchResults([]);
        setConversationSearchError(
          getConversationSearchErrorMessage(searchError),
        );
      } finally {
        if (isMounted) {
          setIsConversationSearchLoading(false);
        }
      }
    }

    loadConversationSearchResults();

    return () => {
      isMounted = false;
    };
  }, [debouncedConversationSearchQuery, userEmail]);

  async function selectSession(session) {
    if (
      !session?.id ||
      isSending ||
      isSessionActionLoading ||
      session.id === activeSession?.id
    ) {
      return;
    }

    setError("");
    setIsLoadingHistory(true);
    setActiveSession(session);
    setSelectedModel(session.model || "openrouter/auto");

    try {
      await loadSessionMessages(session.id);
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal memuat chat session.",
      );
      setMessages([]);
      setMessagesSessionId(session.id);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function openConversationSearchResult(result) {
    const targetSession =
      sessions.find((session) => session.id === result?.session?.id) ||
      result?.session;

    if (!targetSession?.id) return;

    await selectSession(targetSession);
  }

  async function handleNewChat() {
    if (!userEmail || isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);
    setIsLoadingHistory(true);

    try {
      const session = await createChatSession({
        model: selectedModel,
        title: "Percakapan Baru",
        userEmail,
      });

      const databaseSessions = await refreshSessions(userEmail);
      const sessionFromList =
        databaseSessions.find((item) => item.id === session.id) || session;

      setActiveSession(sessionFromList);
      messageLoadRequestIdRef.current += 1;
      setMessages([]);
      setMessagesSessionId(sessionFromList.id);
      setSearchQuery("");
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal membuat chat baru.",
      );
    } finally {
      setIsLoadingHistory(false);
      setIsSessionActionLoading(false);
    }
  }

  function openRenameDialog(session) {
    setRenameDialogSession(session);
    setRenameTitle(session.title);
  }

  function closeRenameDialog() {
    setRenameDialogSession(null);
    setRenameTitle("");
  }

  async function submitRenameSession(event) {
    event.preventDefault();

    const cleanTitle = renameTitle.trim();

    if (!renameDialogSession?.id || !cleanTitle || isSessionActionLoading) {
      return;
    }

    setError("");
    setIsSessionActionLoading(true);

    const previousSessions = sessions;
    const previousActiveSession = activeSession;
    const optimisticSession = {
      ...renameDialogSession,
      title: cleanTitle,
    };

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === optimisticSession.id ? optimisticSession : session,
      ),
    );

    if (activeSession?.id === optimisticSession.id) {
      setActiveSession(optimisticSession);
    }

    try {
      const renamedSession = await renameChatSession({
        sessionId: renameDialogSession.id,
        title: cleanTitle,
      });

      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === renamedSession.id ? renamedSession : session,
        ),
      );

      if (activeSession?.id === renamedSession.id) {
        setActiveSession(renamedSession);
      }

      closeRenameDialog();
    } catch (sessionError) {
      setSessions(previousSessions);
      setActiveSession(previousActiveSession);
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal rename chat session.",
      );
    } finally {
      setIsSessionActionLoading(false);
    }
  }

  async function confirmDeleteSession() {
    if (!deleteDialogSession?.id || isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);
    setIsLoadingHistory(true);

    try {
      await deleteChatSession(deleteDialogSession.id);
      const remainingSessions = await refreshSessions(userEmail);
      const currentSessionStillExists = remainingSessions.find(
        (item) => item.id === activeSession?.id,
      );
      const nextSession =
        deleteDialogSession.id === activeSession?.id
          ? remainingSessions[0] || null
          : currentSessionStillExists;

      if (nextSession) {
        setActiveSession(nextSession);
        setSelectedModel(nextSession.model || "openrouter/auto");
        await loadSessionMessages(nextSession.id);
      } else {
        const newSession = await createChatSession({
          model: selectedModel,
          title: "Percakapan Baru",
          userEmail,
        });
        await refreshSessions(userEmail);
        setActiveSession(newSession);
        messageLoadRequestIdRef.current += 1;
        setMessages([]);
        setMessagesSessionId(newSession.id);
      }

      setSearchQuery("");
      setSessionSearchQuery("");
      setDeleteDialogSession(null);
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal menghapus chat session.",
      );
    } finally {
      setIsLoadingHistory(false);
      setIsSessionActionLoading(false);
    }
  }

  async function handleTogglePinSession(session) {
    if (isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);

    const previousSessions = sessions;
    const nextPinned = !session.pinned;

    setSessions((currentSessions) =>
      sortSessions(
        currentSessions.map((item) =>
          item.id === session.id ? { ...item, pinned: nextPinned } : item,
        ),
      ),
    );

    try {
      const pinnedSession = await togglePinChatSession({
        sessionId: session.id,
        pinned: nextPinned,
      });

      setSessions((currentSessions) =>
        sortSessions(
          currentSessions.map((item) =>
            item.id === pinnedSession.id ? pinnedSession : item,
          ),
        ),
      );

      if (activeSession?.id === pinnedSession.id) {
        setActiveSession(pinnedSession);
      }
    } catch (sessionError) {
      setSessions(previousSessions);
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal mengubah status pin session.",
      );
    } finally {
      setIsSessionActionLoading(false);
    }
  }

  async function handleModelChange(nextModel) {
    const previousModel = selectedModel;
    const previousActiveSession = activeSession;
    const previousSessions = sessions;

    setSelectedModel(nextModel);

    if (!activeSession?.id || !userEmail) return;

    const optimisticSession = {
      ...activeSession,
      model: nextModel,
    };

    setActiveSession(optimisticSession);
    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === activeSession.id
          ? { ...session, model: nextModel }
          : session,
      ),
    );

    try {
      const updatedSession = await updateChatSessionModel({
        sessionId: activeSession.id,
        model: nextModel,
      });

      setActiveSession(updatedSession);
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === updatedSession.id ? updatedSession : session,
        ),
      );
    } catch (sessionError) {
      setSelectedModel(previousModel);
      setActiveSession(previousActiveSession);
      setSessions(previousSessions);
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal menyimpan model session.",
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanPrompt = prompt.trim();
    const targetSession = activeSession;
    const targetSessionId = targetSession?.id;
    const targetUserEmail = userEmail;
    const targetModel = targetSession?.model || selectedModel;

    if (!cleanPrompt || isSending || !targetSessionId || !targetUserEmail) {
      return;
    }

    setPrompt("");
    setError("");
    setIsSending(true);

    try {
      const targetMessages = await getChatMessages(targetSessionId);

      const optimisticUserMessage = {
        id: `local-user-${Date.now()}`,
        session_id: targetSessionId,
        user_email: targetUserEmail,
        role: "user",
        content: cleanPrompt,
        model: targetModel,
        created_at: new Date().toISOString(),
      };

      messageLoadRequestIdRef.current += 1;
      setMessagesSessionId(targetSessionId);
      setMessages([
        ...targetMessages,
        optimisticUserMessage,
      ]);

      await saveChatMessage({
        sessionId: targetSessionId,
        userEmail: targetUserEmail,
        role: "user",
        content: cleanPrompt,
        model: targetModel,
      });

      const conversationHistory = targetMessages
        .filter((message) => message?.role && message?.content)
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const data = await api.sendAiChat({
        message: cleanPrompt,
        model: targetModel,
        sessionId: targetSessionId,
        userEmail: targetUserEmail,
        history: conversationHistory,
      });

      const aiResponse =
        data?.response ||
        data?.message ||
        data?.content ||
        "Maaf, AI tidak mengembalikan jawaban.";

      await saveChatMessage({
        sessionId: targetSessionId,
        userEmail: targetUserEmail,
        role: "assistant",
        content: aiResponse,
        model: targetModel,
      });

      await loadSessionMessages(targetSessionId);

      const updatedSessions = await refreshSessions(targetUserEmail);
      const updatedActiveSession =
        updatedSessions.find((session) => session.id === targetSessionId) ||
        targetSession;

      setActiveSession(updatedActiveSession);
    } catch (chatError) {
      const message =
        getChatPersistenceErrorMessage(chatError) ||
        chatError?.message ||
        "Gagal mengambil jawaban AI dari OpenRouter.";

      setError(message);

      await loadSessionMessages(targetSessionId).catch(() => undefined);
    } finally {
      setIsSending(false);
    }
  }

  function useLibraryPrompt(libraryPrompt) {
    const promptContent =
      typeof libraryPrompt === "string"
        ? libraryPrompt
        : libraryPrompt?.content || libraryPrompt?.prompt || "";

    setPrompt(promptContent);
  }

  function handleExportConversation(format) {
    if (!activeSession?.id) {
      setError("Pilih chat session sebelum export.");
      return;
    }

    if (messages.length === 0) {
      setError("Conversation masih kosong. Tidak ada data untuk diexport.");
      return;
    }

    setError("");

    try {
      exportConversation({
        format,
        messages,
        modelLabel: selectedModelLabel,
        session: {
          ...activeSession,
          model: activeSession.model || selectedModel,
        },
      });
    } catch (exportError) {
      setError(exportError.message || "Gagal export conversation.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
          <Bot size={23} />
        </span>
        <p className="mt-6 text-[10px] font-black tracking-[0.28em] text-cyan-300">
          AI OPERATIONS
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          AI Workspace v0.9
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
          Workspace newsroom untuk chat panel, prompt library, session history,
          AI tools, context, output, dan settings dalam satu command surface.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1">
            {workspaceSummary.activeSessionTitle}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            {selectedModelLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            {workspaceSummary.sessionCount} sessions
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            {workspaceSummary.messageCount} messages
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          label="Model Aktif"
          value={selectedModelLabel}
          icon={Sparkles}
        />
        <MetricCard
          label="Conversation"
          value={`${conversationCount} prompt`}
          icon={MessageSquare}
        />
        <MetricCard label="Mode" value="OpenRouter API" icon={Clock3} />
        <MetricCard
          label="Output"
          value={latestAssistantResponse ? "Ready" : "Waiting"}
          icon={Bot}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="grid content-start gap-4">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                  SESSION HISTORY
                </p>
                <h3 className="mt-2 text-lg font-black text-white">
                  Saved sessions
                </h3>
              </div>
              <button
                className="inline-flex size-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSessionActionLoading}
                onClick={handleNewChat}
                title="New Chat"
                type="button">
                <Plus size={17} />
              </button>
            </div>

            <div className="mt-4 grid max-h-[460px] gap-2 overflow-y-auto pr-1">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
                <Search size={15} />
                <input
                  className="w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
                  onChange={(event) =>
                    setSessionSearchQuery(event.target.value)
                  }
                  placeholder="Cari session..."
                  value={sessionSearchQuery}
                />
              </label>

              {filteredSessions.map((session) => {
                const isActive = session.id === activeSession?.id;

                return (
                  <article
                    className={`rounded-2xl border p-3 transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    key={session.id}>
                    <div className="flex items-start gap-2">
                      <button
                        className="block min-w-0 flex-1 text-left"
                        disabled={isSessionActionLoading || isSending}
                        onClick={() => selectSession(session)}
                        type="button">
                        <span className="flex items-center gap-2">
                          {session.pinned && (
                            <Pin
                              className="shrink-0 text-amber-300"
                              size={13}
                            />
                          )}
                          <span className="line-clamp-1 text-sm font-black text-white">
                            {session.title}
                          </span>
                        </span>
                        <span className="mt-1 block line-clamp-1 text-[10px] font-bold text-slate-500">
                          {session.model}
                        </span>
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-amber-300/30 hover:text-amber-200"
                        onClick={() => handleTogglePinSession(session)}
                        title={session.pinned ? "Unpin chat" : "Pin chat"}
                        type="button">
                        {session.pinned ? (
                          <PinOff size={14} />
                        ) : (
                          <Pin size={14} />
                        )}
                      </button>
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200"
                        onClick={() => openRenameDialog(session)}
                        title="Rename chat"
                        type="button">
                        <Pencil size={14} />
                      </button>
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/5 text-rose-200 transition hover:bg-rose-300/10"
                        onClick={() => setDeleteDialogSession(session)}
                        title="Delete chat"
                        type="button">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {sessions.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Session akan dibuat otomatis saat workspace dibuka.
                </p>
              )}
              {sessions.length > 0 && filteredSessions.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Session tidak ditemukan.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                  AI TOOLS
                </p>
                <h3 className="mt-2 text-lg font-black text-white">
                  Model presets
                </h3>
              </div>
              <Sparkles className="text-cyan-300" size={18} />
            </div>

            <div className="mt-4 grid gap-2">
              {modelOptions.map((model) => {
                const isActive = model.value === selectedModel;

                return (
                  <button
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    disabled={isSessionActionLoading || isSending}
                    key={model.value}
                    onClick={() => handleModelChange(model.value)}
                    type="button">
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-white">
                        {model.label}
                      </span>
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {isActive ? "Active preset" : "Switch preset"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                        isActive
                          ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-400"
                      }`}>
                      {isActive ? "Selected" : "Use"}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!userEmail || isSessionActionLoading}
              onClick={handleNewChat}
              type="button">
              <Plus size={16} />
              Start New Session
            </button>
          </section>
        </aside>

        <section className="grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                  CHAT PANEL
                </p>
                <h3 className="mt-2 text-xl font-black text-white">
                  {activeSession?.title || "Prompt Console"}
                </h3>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {selectedModelLabel} â€¢ {workspaceSummary.messageCount} messages
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSessionActionLoading}
                onClick={handleNewChat}
                type="button">
                <Plus size={16} />
                New Chat
              </button>
            </div>

            <div className="mt-5 grid max-h-[520px] gap-4 overflow-y-auto pr-1">
              {isLoadingHistory && (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs font-bold text-cyan-200">
                  Memuat history chat dari Supabase...
                </div>
              )}
              {!isLoadingHistory && messages.length === 0 && (
                <article className="mr-auto max-w-2xl rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      AI Workspace
                    </p>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">
                      System
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    Selamat datang di AI Workspace. Pilih model, tulis prompt,
                    lalu submit untuk menyimpan percakapan ke Supabase.
                  </p>
                </article>
              )}
              {!isLoadingHistory &&
                messages.length > 0 &&
                filteredMessages.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-slate-400">
                    Tidak ada message yang cocok dengan pencarian.
                  </div>
                )}
              {filteredMessages.map((message) => (
                <article
                  className={`rounded-2xl border p-4 ${
                    message.role === "user"
                      ? "ml-auto max-w-2xl border-cyan-300/20 bg-cyan-300/10"
                      : "mr-auto max-w-2xl border-white/10 bg-black/20"
                  }`}
                  key={message.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      {message.role === "user" ? "Operator" : "AI Workspace"}
                    </p>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">
                      {modelOptions.find((model) => model.value === message.model)
                        ?.label || message.model}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {message.content}
                  </p>
                </article>
              ))}
            </div>

            <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
              {isSending && (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs font-bold text-cyan-200">
                  Menghubungi OpenRouter API...
                </div>
              )}
              {error && (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-xs font-bold text-rose-200">
                  {error}
                </div>
              )}
              <textarea
                className="min-h-36 resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Tulis prompt untuk berita, transkrip audio, gambar AI, atau audit naskah..."
                value={prompt}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  History tersimpan di Supabase sesuai user login. Jawaban AI
                  diproses real-time lewat OpenRouter API.
                </p>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !prompt.trim() ||
                    isSending ||
                    isLoadingHistory ||
                    !activeSession?.id
                  }
                  type="submit">
                  {isSending ? "Mengirim..." : "Submit Prompt"}
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                  OUTPUT PANEL
                </p>
                <h3 className="mt-2 text-lg font-black text-white">
                  Latest assistant output
                </h3>
              </div>
              <Download className="text-cyan-300" size={18} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Preview
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {workspaceSummary.latestOutput}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Last Prompt
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">
                  {workspaceSummary.latestPrompt}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Session
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {workspaceSummary.activeSessionTitle}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {workspaceSummary.messageCount} saved messages
                </p>
              </div>
            </div>
          </section>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div>
              <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
                WORKSPACE SETTINGS
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                Model, search, export
              </h3>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
                MODEL SELECTOR
                <select
                  className="rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                  onChange={(event) => handleModelChange(event.target.value)}
                  value={selectedModel}>
                  {modelOptions.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
                SEARCH HISTORY
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
                  <Search size={15} />
                  <input
                    className="w-full bg-transparent text-sm font-bold normal-case tracking-normal text-slate-100 outline-none placeholder:text-slate-600"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari prompt atau jawaban..."
                    value={searchQuery}
                  />
                </span>
              </label>
              <div className="grid gap-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
                EXPORT
                <div className="grid grid-cols-3 gap-2">
                  {["md", "pdf", "docx"].map((format) => (
                    <button
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#0c1320] px-2 py-2 text-xs font-black uppercase tracking-normal text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        !activeSession?.id ||
                        messages.length === 0 ||
                        isLoadingHistory
                      }
                      key={format}
                      onClick={() => handleExportConversation(format)}
                      title={`Export ${format.toUpperCase()}`}
                      type="button">
                      <Download size={13} />
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center gap-2">
              <Search className="text-cyan-300" size={18} />
              <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                CONTEXT PANEL
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              <DetailLine label="Active session" value={workspaceSummary.activeSessionTitle} />
              <DetailLine label="Selected model" value={selectedModelLabel} />
              <DetailLine label="Prompt count" value={`${conversationCount} prompt`} />
              <DetailLine label="Output state" value={latestAssistantResponse ? "Ready" : "Waiting"} />
            </div>

            <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
              <Search size={15} />
              <input
                className="w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) =>
                  setConversationSearchQuery(event.target.value)
                }
                placeholder="Cari supabase, openrouter, title..."
                value={conversationSearchQuery}
              />
            </label>

            <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1">
              {isConversationSearchLoading && (
                <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-xs font-bold text-cyan-200">
                  Mencari conversation...
                </p>
              )}
              {!isConversationSearchLoading && conversationSearchError && (
                <p className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-xs font-bold text-rose-200">
                  {conversationSearchError}
                </p>
              )}
              {!isConversationSearchLoading &&
                !conversationSearchError &&
                !debouncedConversationSearchQuery && (
                  <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                    Cari title session, model, prompt user, atau response AI.
                  </p>
                )}
              {!isConversationSearchLoading &&
                !conversationSearchError &&
                debouncedConversationSearchQuery &&
                conversationSearchResults.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                    Conversation tidak ditemukan.
                  </p>
                )}
              {!isConversationSearchLoading &&
                conversationSearchResults.map((result) => {
                  const firstMessage = result.messages?.[0];

                  return (
                    <button
                      className="rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
                      key={result.id}
                      onClick={() => openConversationSearchResult(result)}
                      type="button">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="line-clamp-1 text-sm font-black text-white">
                            {highlightMatch(
                              result.session?.title,
                              debouncedConversationSearchQuery,
                            )}
                          </h4>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                            {highlightMatch(
                              result.session?.model,
                              debouncedConversationSearchQuery,
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">
                          {result.messages?.length || "title"}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                        {highlightMatch(
                          firstMessage?.content ||
                            "Match ditemukan pada session title atau model.",
                          debouncedConversationSearchQuery,
                        )}
                      </p>
                    </button>
                  );
                })}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-cyan-300" size={18} />
              <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                PROMPT LIBRARY
              </p>
            </div>
            <div className="mt-4">
              <PromptLibrary
                currentPrompt={prompt || latestUserPrompt}
                latestAssistantResponse={latestAssistantResponse}
                onSelectTemplate={useLibraryPrompt}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
              SESSION SNAPSHOT
            </p>
            <div className="mt-4 grid gap-3">
              {messages
                .filter((message) => message.role === "user")
                .map((message, index) => (
                  <article
                    className="rounded-2xl border border-white/10 bg-black/15 p-3"
                    key={message.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-300">
                        Prompt #{index + 1}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-300">
                        {modelOptions.find(
                          (model) => model.value === message.model,
                        )?.label || message.model}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                      {message.content}
                    </p>
                  </article>
                ))}
              {conversationCount === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Belum ada prompt. Submit prompt pertama untuk membuat history.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>

      {renameDialogSession && (
        <SessionModal
          actionLabel="Simpan"
          isLoading={isSessionActionLoading}
          onClose={closeRenameDialog}
          onSubmit={submitRenameSession}
          title="Rename Session">
          <label className="grid gap-2 text-xs font-bold text-slate-400">
            Nama session
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
              onChange={(event) => setRenameTitle(event.target.value)}
              value={renameTitle}
            />
          </label>
        </SessionModal>
      )}

      {deleteDialogSession && (
        <SessionModal
          actionLabel="Hapus"
          danger
          isLoading={isSessionActionLoading}
          onClose={() => setDeleteDialogSession(null)}
          onSubmit={(event) => {
            event.preventDefault();
            confirmDeleteSession();
          }}
          title="Delete Session">
          <p className="text-sm leading-6 text-slate-300">
            Hapus chat "{deleteDialogSession.title}" dan semua message di
            dalamnya?
          </p>
        </SessionModal>
      )}
    </div>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <span className="max-w-[58%] text-right text-[11px] font-bold text-slate-100">
        {value}
      </span>
    </div>
  );
}

function sortSessions(sessionList) {
  return [...sessionList].sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
    }

    return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
  });
}

function highlightMatch(value, query) {
  const text = String(value || "");
  const cleanQuery = String(query || "").trim();

  if (!cleanQuery) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex < 0) return text;

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + cleanQuery.length);
  const after = text.slice(matchIndex + cleanQuery.length);

  return (
    <>
      {before}
      <mark className="rounded bg-cyan-300/20 px-1 text-cyan-100">{match}</mark>
      {after}
    </>
  );
}

function exportConversation({ format, messages, modelLabel, session }) {
  const exportData = createConversationExportData({
    messages,
    modelLabel,
    session,
  });
  const filename = `${slugifyFilename(exportData.title)}-${formatDateForFilename(
    new Date(),
  )}.${format}`;

  if (format === "md") {
    downloadBlob({
      blob: new Blob([createMarkdownExport(exportData)], {
        type: "text/markdown;charset=utf-8",
      }),
      filename,
    });
    return;
  }

  if (format === "pdf") {
    downloadBlob({
      blob: createPdfExport(exportData),
      filename,
    });
    return;
  }

  if (format === "docx") {
    downloadBlob({
      blob: createDocxExport(exportData),
      filename,
    });
    return;
  }

  throw new Error("Format export tidak didukung.");
}

function createConversationExportData({ messages, modelLabel, session }) {
  return {
    title: session?.title || "AI Workspace Conversation",
    model: session?.model || modelLabel || "openrouter/auto",
    modelLabel,
    createdAt: session?.createdAt || new Date().toISOString(),
    exportedAt: new Date().toISOString(),
    messages: messages.map((message) => ({
      role: message.role === "user" ? "User" : "Assistant",
      model: message.model || session?.model || "openrouter/auto",
      createdAt: message.createdAt,
      content: message.content || "",
    })),
  };
}

function createMarkdownExport(exportData) {
  const lines = [
    "# BLACK FLASH ORBIT",
    "",
    "## AI Workspace Export",
    "",
    `**Session Title:** ${exportData.title}`,
    `**Model:** ${exportData.modelLabel || exportData.model}`,
    `**Created At:** ${formatDisplayDate(exportData.createdAt)}`,
    `**Exported At:** ${formatDisplayDate(exportData.exportedAt)}`,
    "",
    "---",
    "",
  ];

  exportData.messages.forEach((message, index) => {
    lines.push(`## ${index + 1}. ${message.role}`);
    lines.push("");
    lines.push(`**Model:** ${message.model}`);
    lines.push(`**Created At:** ${formatDisplayDate(message.createdAt)}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

function createPdfExport(exportData) {
  const textLines = createPlainTextExport(exportData);
  const pages = paginateLines(textLines, 42);
  const objects = [];
  const pageObjectNumbers = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines) => {
    const contentObjectNumber = objects.length + 1;
    const pageObjectNumber = objects.length + 2;
    const stream = createPdfPageStream(pageLines);

    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    pageObjectNumbers.push(pageObjectNumber);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((objectNumber) => `${objectNumber} 0 R`)
    .join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  return new Blob([buildPdf(objects)], { type: "application/pdf" });
}

function createPdfPageStream(lines) {
  const escapedLines = lines.map((line) => escapePdfText(line));
  const commands = ["BT", "/F1 11 Tf", "50 750 Td", "14 TL"];

  escapedLines.forEach((line, index) => {
    if (index > 0) {
      commands.push("T*");
    }

    commands.push(`(${line}) Tj`);
  });

  commands.push("ET");
  return commands.join("\n");
}

function buildPdf(objects) {
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return chunks.join("");
}

function createDocxExport(exportData) {
  const paragraphs = createPlainTextExport(exportData).map((line) =>
    line
      ? `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
      : "<w:p/>",
  );
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;

  return new Blob(
    [
      createZip([
        {
          path: "[Content_Types].xml",
          content:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        },
        {
          path: "_rels/.rels",
          content:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        },
        {
          path: "word/document.xml",
          content: documentXml,
        },
      ]),
    ],
    {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  );
}

function createPlainTextExport(exportData) {
  const lines = [
    "BLACK FLASH ORBIT",
    "AI Workspace Export",
    "",
    `Session Title: ${exportData.title}`,
    `Model: ${exportData.modelLabel || exportData.model}`,
    `Created At: ${formatDisplayDate(exportData.createdAt)}`,
    `Exported At: ${formatDisplayDate(exportData.exportedAt)}`,
    "",
    "Conversation",
    "",
  ];

  exportData.messages.forEach((message, index) => {
    lines.push(`${index + 1}. ${message.role}`);
    lines.push(`Model: ${message.model}`);
    lines.push(`Created At: ${formatDisplayDate(message.createdAt)}`);
    splitLongLines(message.content).forEach((line) => lines.push(line));
    lines.push("");
  });

  return lines;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const localHeader = createZipLocalHeader({
      contentLength: contentBytes.length,
      crc,
      nameBytes,
    });

    localParts.push(localHeader, contentBytes);
    centralParts.push(
      createZipCentralHeader({
        contentLength: contentBytes.length,
        crc,
        nameBytes,
        offset,
      }),
    );
    offset += localHeader.length + contentBytes.length;
  });

  const centralSize = centralParts.reduce(
    (total, part) => total + part.length,
    0,
  );
  const endRecord = createZipEndRecord({
    centralOffset: offset,
    centralSize,
    fileCount: files.length,
  });

  return concatUint8Arrays([...localParts, ...centralParts, endRecord]);
}

function createZipLocalHeader({ contentLength, crc, nameBytes }) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, contentLength, true);
  view.setUint32(22, contentLength, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);

  return header;
}

function createZipCentralHeader({ contentLength, crc, nameBytes, offset }) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, contentLength, true);
  view.setUint32(24, contentLength, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);

  return header;
}

function createZipEndRecord({ centralOffset, centralSize, fileCount }) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);

  return header;
}

function concatUint8Arrays(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function paginateLines(lines, pageSize) {
  const pages = [];

  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }

  return pages.length > 0
    ? pages
    : [["BLACK FLASH ORBIT", "AI Workspace Export"]];
}

function splitLongLines(text) {
  const output = [];

  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      if (!line) {
        output.push("");
        return;
      }

      for (let index = 0; index < line.length; index += 92) {
        output.push(line.slice(index, index + 92));
      }
    });

  return output;
}

function downloadBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugifyFilename(value) {
  const slug = String(value || "ai-workspace-export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "ai-workspace-export";
}

function formatDateForFilename(value) {
  return value.toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function formatDisplayDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SessionModal({
  actionLabel,
  children,
  danger = false,
  isLoading,
  onClose,
  onSubmit,
  title,
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <form
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#080d16] p-5 shadow-2xl shadow-black/50"
        onSubmit={onSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button
            className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300"
            onClick={onClose}
            type="button">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-black text-slate-300"
            onClick={onClose}
            type="button">
            Batal
          </button>
          <button
            className={`rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "border-rose-300/30 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
                : "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/20"
            }`}
            disabled={isLoading}
            type="submit">
            {isLoading ? "Memproses..." : actionLabel}
          </button>
        </div>
      </form>
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
