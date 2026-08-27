# Knowledge Base v3.1 Interactive AI Mock

## Overview
Knowledge Base v3.1 is the protected ORBIT newsroom knowledge surface for source browsing, interactive semantic search, favorites, upload staging, and the AI Knowledge Copilot. The current implementation is mock-only and runs entirely on local demo data. It keeps the existing ORBIT dashboard style while adding a source-aware AI workflow without backend dependency.

The page is mounted at `/knowledge-base` and remains behind the existing protected route guard in `apps/web/src/App.jsx`.

## v3.1 Changelog

- Unified document state around `selectedDocument` as the single source of truth.
- Added interactive search behavior that updates semantic matches while keeping the selected document synchronized.
- Added AI typing/streaming effect for mock Copilot answers.
- Added dynamic confidence, retrieved context, and citation cards tied to the current document or question.
- Added activity timeline events for Copilot actions, favorites, uploads, and document selection.
- Added favorites sync between the library, hero metrics, and favorites panel.
- Added upload mock indexing flow with phase, queue, and indexed counters.
- Added keyboard shortcuts for search, Copilot, collection switching, favorites, and upload mock validation.

## File Map

- `apps/web/src/pages/KnowledgeBase.jsx`: page orchestrator, layout composition, collection filters, favorites, search, upload staging, and Copilot wiring.
- `apps/web/src/components/knowledge/AiKnowledgeCopilot.jsx`: Copilot container for chat, actions, confidence, context preview, and citations.
- `apps/web/src/components/knowledge/CopilotChat.jsx`: message thread and question composer.
- `apps/web/src/components/knowledge/CopilotMessage.jsx`: user and assistant message rendering.
- `apps/web/src/components/knowledge/QuickPromptBar.jsx`: one-click prompt shortcuts.
- `apps/web/src/components/knowledge/RagContextPanel.jsx`: retrieved context preview.
- `apps/web/src/components/knowledge/SourceCitationCard.jsx`: citation rendering.
- `apps/web/src/components/knowledge/ConfidenceMeter.jsx`: confidence score display.
- `apps/web/src/components/knowledge/KnowledgeActionMenu.jsx`: command actions for document tasks.
- `apps/web/src/data/knowledgeMock.js`: local mock knowledge corpus, quick prompts, action catalog, upload queue, and activity seeds.
- `apps/web/src/lib/mockRagEngine.js`: local search/retrieval/scoring/citation engine.
- `apps/web/src/hooks/useKnowledgeCopilot.js`: Copilot state, submit flow, command action flow, and activity event emission.

## Component Responsibilities

`KnowledgeBase.jsx`
- Owns selected collection, `selectedDocument`, favorites, activity log, and upload mock state.
- Derives filtered documents and semantic search results.
- Keeps the hero, library, preview, context, citations, favorites, and upload panels synchronized from the same document state.
- Chooses desktop panel or mobile drawer behavior for the Copilot.
- Keeps `/knowledge-base` page behavior additive and route-safe.

`AiKnowledgeCopilot.jsx`
- Wraps the full Copilot experience.
- Presents the active source, actions, quick prompts, chat, confidence, retrieved context, and citations.
- Exposes a close control only for the mobile drawer variant.

`CopilotChat.jsx`
- Renders the message thread.
- Provides the textarea composer and submit button.
- Supports `Ctrl`/`Cmd` + `Enter` submit.
- Scrolls to the latest assistant output while typing or streaming.

`CopilotMessage.jsx`
- Renders user and assistant messages with role-specific styling.
- Shows confidence and citation metadata on assistant replies.
- Indicates streaming state with a typing cursor label.

`QuickPromptBar.jsx`
- Exposes predefined editor prompts.
- Sends one-click questions into the Copilot hook.

`KnowledgeActionMenu.jsx`
- Hosts the task-oriented commands:
  - Summarize document
  - Explain selected source
  - Generate action items
  - Compare sources
  - Find security risks

`RagContextPanel.jsx`
- Shows the retrieved context chunks returned by the mock engine.
- Provides a visible empty state when nothing matches.
- Updates dynamically when the selected document or question changes.

`SourceCitationCard.jsx`
- Shows citation label, locator, quote, reliability, and source title.
- Keeps citations readable as separate cards.
- Reflects the current retrieved context, not a static list.

`ConfidenceMeter.jsx`
- Summarizes the retrieval confidence score as a compact meter and label.
- Recomputes when selected context changes.

`useKnowledgeCopilot.js`
- Holds chat messages, loading state, selected context, citations, and confidence.
- Streams assistant output into the UI with a typing effect.
- Runs query execution for free-form questions and command actions.
- Recomputes selection context when `selectedDocument` changes.
- Emits activity events into the page log.

`mockRagEngine.js`
- Implements deterministic local retrieval and answer generation.
- Never calls backend services.
- Never streams or fabricates live server state.
- Returns context, confidence, and citations derived from local mock data only.

## Mock RAG Data Flow

1. User opens `/knowledge-base`.
2. `KnowledgeBase.jsx` selects `selectedDocument` as the single source of truth for preview, library, context, and Copilot.
3. The Copilot hook receives a question, quick prompt, or command action.
4. `mockRagEngine.js` searches the local document array with tokenized matching.
5. Matching documents are converted into retrieved context records.
6. Citations are built from the matched context.
7. The confidence score is calculated from retrieval quality and citation strength.
8. A mock answer is generated from local context only.
9. The hook appends a user message, then streams the assistant answer token by token.
10. The UI renders chat, retrieved context, citations, confidence, favorites, upload state, and the activity timeline.

## Security Notes

- No secret, API key, or token is stored in the Copilot code.
- No `dangerouslySetInnerHTML` is used.
- No runtime API request is made by the Copilot flow.
- The page is protected by the existing route guard in `App.jsx`.
- All rendered text comes from local mock data and is treated as plain content.
- The UI shows a clear mock disclaimer to avoid claiming real backend or production RAG behavior.

## Limitations

- Retrieval is token-based and deterministic, not embedding-based.
- Context ranking is heuristic, not semantic vector search.
- Answers are generated from demo rules and local snippets only.
- Citations are mock records, not persistent source documents.
- The mobile drawer is UI-only and does not replace a real app shell modal system.
- There is no real document ingestion, indexing, or persistence layer.
- Keyboard shortcuts only affect the local page shell and do not emit global app actions.
- Streaming is simulated typing, not a network stream.

## Manual Test Checklist

1. Open `/knowledge-base`.
2. Confirm the page loads under the protected ORBIT shell.
3. Click a document in the library and confirm the preview, citations, context, and Copilot active source all follow that selection.
4. Select a collection and verify the document list filters correctly.
5. Search for a document title or topic and confirm semantic results update immediately.
6. Confirm search focus shortcut works with `/`.
7. Open the AI Copilot on desktop or mobile.
8. Ask a question about the active document and confirm the assistant answer streams in.
9. Run each quick prompt.
10. Run each command action:
   - Summarize document
   - Explain selected source
   - Generate action items
   - Compare sources
   - Find security risks
11. Verify retrieved context updates after each prompt or action.
12. Verify citation cards change with the current context.
13. Toggle favorites and confirm the library, favorites panel, and activity log stay in sync.
14. Trigger mock upload validation and confirm indexing counters update.
15. Verify keyboard shortcuts:
   - `Ctrl`/`Cmd` + `Shift` + `K` opens Copilot
   - `Ctrl`/`Cmd` + `Shift` + `F` toggles favorite for the selected document
   - `Ctrl`/`Cmd` + `Shift` + `U` toggles mock upload indexing state
   - `1` to `5` switch collections
16. Verify empty states appear when search returns no match or no context is available.
17. Verify activity entries are added after Copilot actions.
18. Run `npm.cmd run build`.
19. Run `git diff --check`.

## Future Upgrade Path

The current mock flow is structured so it can be replaced with real RAG in stages:

1. FastAPI
   - Move retrieval and answer orchestration into a dedicated service.
   - Keep the ORBIT UI contract stable while the transport changes.

2. PostgreSQL + pgvector
   - Store document chunks and embeddings in PostgreSQL.
   - Use pgvector for semantic retrieval and ranking.

3. Supabase Storage
   - Store uploaded source files and derived artifacts.
   - Keep metadata in the database and binary assets in storage.

4. Embeddings
   - Generate chunk embeddings during ingestion.
   - Use the same embedding model for search and reranking.

5. Streaming AI Response
   - Stream tokens into the Copilot chat UI.
   - Preserve citations and retrieved context as structured metadata.

Recommended migration order:

1. Add a retrieval API contract.
2. Replace mock search with database-backed search.
3. Move file ingestion to storage plus indexing jobs.
4. Add streaming responses last.
