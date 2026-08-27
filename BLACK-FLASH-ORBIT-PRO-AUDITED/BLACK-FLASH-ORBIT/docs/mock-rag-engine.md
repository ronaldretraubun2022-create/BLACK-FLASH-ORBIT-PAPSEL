# Mock RAG Engine

## Overview
`apps/web/src/lib/mockRagEngine.js` is the local retrieval and answer layer for Knowledge Base v3.1 Interactive AI Mock. It is intentionally deterministic and mock-only. The goal is to make the UI and workflow behave like a copilot-driven knowledge system without adding backend dependencies.

The engine is used by `useKnowledgeCopilot.js` and the Knowledge Base page to simulate search, retrieval, confidence scoring, citations, and answer generation.

## Responsibilities

- Tokenize the user query.
- Score local documents against the query.
- Produce retrieved context records.
- Build citation cards from matched documents.
- Calculate a confidence score.
- Generate a mock answer from context only.
- Support dynamic updates as the selected document changes.

## Public Functions

### `searchKnowledge(query, documents)`
Returns ranked search results from the local corpus.

Behavior:
- Normalizes the query and document text.
- Matches against title, source, type, status, owner, summary, excerpt, tags, chunks, and citations.
- Returns empty matches when no document satisfies the query.
- Sorts results by score descending.
- Used by interactive search and panel synchronization.

### `retrieveContext(query, documents)`
Builds the structured context payload used by the Copilot UI.

Returns:
- `documentId`
- `title`
- `source`
- `type`
- `status`
- `owner`
- `updatedAt`
- `score`
- `matchedTerms`
- `summary`
- `excerpt`
- `chunks`
- `citations`
- `confidence`
- `matchedTerms` and `chunks` are used to drive dynamic context previews.

### `generateMockAnswer(query, context)`
Creates a local-only response string.

Behavior:
- Uses the top retrieved context first.
- Produces task-specific responses for:
  - summarize
  - explain selected source
  - generate action items
  - compare sources
  - find security risks
- Falls back to a generic mock answer when no task keyword is matched.
- Returns a no-match message when context is empty.
- The UI streams this response token by token as a typing effect.

### `calculateConfidence(context)`
Produces a confidence score for the current retrieval result.

Inputs:
- Retrieved context records

Outputs:
- Integer score between 0 and 98

Signals used:
- Average retrieval score
- Average document confidence
- High-reliability citation count
- The selected document also seeds the baseline context confidence.

### `buildCitations(context)`
Flattens citations from the retrieved context into citation cards.

Each citation includes:
- `id`
- `documentId`
- `documentTitle`
- `source`
- `score`
- `label`
- `locator`
- `quote`
- `reliability`
- Citation cards are rederived whenever the selected document or query changes.

## Mock RAG Flow

1. `useKnowledgeCopilot.js` receives a question or action.
2. `KnowledgeBase.jsx` keeps `selectedDocument` as the single source of truth for the visible panels.
3. `retrieveContext()` calls `searchKnowledge()`.
4. Query tokens are matched against local documents.
5. The best matches are converted into context records.
6. `buildCitations()` extracts citation cards from those records.
7. `calculateConfidence()` computes the confidence meter value.
8. `generateMockAnswer()` creates the assistant text response.
9. The hook streams the answer into the chat message thread.

This flow is local, synchronous in concept, and delayed only by the UI hook timer used to simulate loading.

## Safety Limits

- The engine does not call any backend endpoint.
- The engine does not read or write persistent storage.
- The engine does not use embeddings or external search services.
- The engine does not claim real-time availability.
- The engine does not infer facts beyond the local demo corpus.
- The engine is not suitable for editorial publication without real verification.
- The engine does not manage keyboard shortcuts, uploads, or favorites; those are page-level responsibilities.

## Limitations

- Matching is heuristic, not semantic.
- Ranking is based on simple text overlap and local confidence values.
- The answers are templated and context-aware, but not model-generated.
- The citations are demo objects, not authoritative source records.
- Long or ambiguous questions may retrieve broad matches.
- Streaming is simulated in the UI and does not imply token streaming from a model endpoint.

## Future Replacement Path

When moving to real RAG, replace the engine in layers:

1. Keep the UI contract stable.
2. Swap `searchKnowledge()` for a real retrieval API.
3. Swap `retrieveContext()` for chunked database retrieval.
4. Replace `calculateConfidence()` with server-side scoring.
5. Replace `generateMockAnswer()` with streamed AI output.
6. Keep `buildCitations()` as a formatter for authoritative source metadata.
7. Preserve `selectedDocument` as the UI anchor so the real backend can slot into the same panel contract.

## Validation Notes

For the current mock implementation, the important checks are:

1. `npm.cmd run build`
2. `git diff --check`
3. Manual Knowledge Base smoke on `/knowledge-base`
4. Confirm typing effect, dynamic context, citations, favorites, uploads, and shortcuts on the page shell

No backend/API validation is required for this documentation update.
