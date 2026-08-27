const assert = require("node:assert");
const test = require("node:test");

const { loadModuleWithMocks } = require("./testUtils");

function createSupabaseMock() {
  const state = {
    buckets: [],
    chunks: [],
    documentDeletes: [],
    documents: [],
    rpcCalls: [],
    storageUploads: [],
  };

  const client = {
    from(table) {
      const query = {
        _table: table,
        _filters: [],
        _payload: null,
        delete() {
          query._action = "delete";
          return query;
        },
        eq(column, value) {
          query._filters.push([column, value]);
          return query;
        },
        insert(payload) {
          query._action = "insert";
          query._payload = payload;
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle: async () => {
          const ownerFilter = query._filters.find(
            ([column]) => column === "owner_id",
          );
          const ownerId = ownerFilter?.[1];

          return {
            data:
              table === "knowledge_documents" && ownerId === "user-1"
                ? {
                    created_at: "2026-07-07T00:00:00Z",
                    file_name: "report.pdf",
                    file_type: "pdf",
                    id: "doc-1",
                    owner_id: "user-1",
                    source_label: "Editorial Desk",
                    status: "indexed",
                    storage_path: "user-1/doc-1/report.pdf",
                    title: "Report",
                    updated_at: "2026-07-07T00:00:00Z",
                  }
                : null,
            error: null,
          };
        },
        order() {
          return query;
        },
        select() {
          query._action = query._action === "insert" ? "insert-select" : "select";
          return query;
        },
        single: async () => ({
          data:
            table === "knowledge_documents"
              ? {
                  created_at: "2026-07-07T00:00:00Z",
                  file_name: "report.pdf",
                  file_type: "pdf",
                  id: "doc-1",
                  owner_id: "user-1",
                  source_label: "Editorial Desk",
                  status: query._payload?.status || "indexed",
                  storage_path: "user-1/doc-1/report.pdf",
                  title: "Report",
                  updated_at: "2026-07-07T00:00:00Z",
                }
              : null,
          error: null,
        }),
        update(payload) {
          query._action = "update";
          query._payload = payload;
          return query;
        },
      };

      query.select = (columns) => {
        query._columns = columns;
        query._action = query._action === "insert" ? "insert-select" : "select";
        return query;
      };

      query.eq = (column, value) => {
        query._filters.push([column, value]);
        return query;
      };

      query.delete = () => {
        query._action = "delete";
        return query;
      };

      query.insert = (payload) => {
        query._action = "insert";
        query._payload = payload;
        return query;
      };

      query.order = () => query;
      query.limit = () => query;
      query.update = (payload) => {
        query._action = "update";
        query._payload = payload;
        return query;
      };

      query.then = (resolve) => {
        if (table === "knowledge_documents" && query._action === "insert") {
          state.documents.push(...query._payload);
          return resolve({
            data: query._payload.map((item) => ({
              ...item,
              created_at: "2026-07-07T00:00:00Z",
              updated_at: "2026-07-07T00:00:00Z",
            })),
            error: null,
          });
        }

        if (
          table === "knowledge_chunks" &&
          (query._action === "insert" || query._action === "insert-select")
        ) {
          state.chunks.push(...query._payload);
          return resolve({
            data: query._payload.map((item, index) => ({
              ...item,
              id: `chunk-${index + 1}`,
            })),
            error: null,
          });
        }

        if (table === "knowledge_documents" && query._action === "delete") {
          state.documentDeletes.push(query._filters);
          return resolve({
            data: { id: "doc-1" },
            error: null,
          });
        }

        if (table === "knowledge_documents" && query._action === "select") {
          return resolve({
            data: [
              {
                created_at: "2026-07-07T00:00:00Z",
                file_name: "report.pdf",
                file_type: "pdf",
                id: "doc-1",
                owner_id: "user-1",
                source_label: "Editorial Desk",
                status: "indexed",
                storage_path: "user-1/doc-1/report.pdf",
                title: "Report",
                updated_at: "2026-07-07T00:00:00Z",
              },
            ],
            error: null,
          });
        }

        return resolve({ data: [], error: null });
      };

      return query;
    },
    rpc(name, payload) {
      state.rpcCalls.push([name, payload]);

      return Promise.resolve({
        data: [
          {
            citation_label: "S1",
            chunk_index: 0,
            content: "Verified source chunk",
            document_id: "doc-1",
            file_name: "report.pdf",
            id: "chunk-1",
            owner_id: "user-1",
            similarity: 0.91,
            source_label: "Editorial Desk",
            source_page: 2,
            token_count: 120,
            title: "Report",
          },
        ],
        error: null,
      });
    },
    storage: {
      createBucket: async (bucketName, options) => {
        state.buckets.push([bucketName, options]);
        return { error: null };
      },
      from() {
        return {
          remove: async (paths) => {
            state.storageUploads.push(paths);
            return { error: null };
          },
          upload: async (storagePath, buffer, options) => {
            state.storageUploads.push([storagePath, buffer.length, options]);
            return { error: null };
          },
        };
      },
    },
  };

  return { client, state };
}

test("knowledgeRepository writes and reads owner-scoped records", async () => {
  const { client, state } = createSupabaseMock();
  const repository = loadModuleWithMocks(
    "../../server/services/knowledge/knowledgeRepository",
    {
      "../supabaseAdmin": {
        getSupabaseAdmin: () => client,
      },
    },
  );

  const created = await repository.createDocument({
    ownerId: "user-1",
    title: "Report",
  });

  assert.strictEqual(created.id, "doc-1");
  assert.strictEqual(created.ownerId, "user-1");

  const docs = await repository.listDocuments({ ownerId: "user-1" });
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].title, "Report");

  const chunks = await repository.insertChunks({
    documentId: "doc-1",
    ownerId: "user-1",
    chunks: [
      {
        chunkIndex: 0,
        content: "Chunk content",
        embedding: [0.1, 0.2],
        sourcePage: 2,
        tokenCount: 12,
      },
    ],
  });

  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(state.chunks.length, 1);

  const matches = await repository.matchKnowledgeChunks({
    matchCount: 5,
    ownerId: "user-1",
    queryEmbedding: [0.1, 0.2],
  });

  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].title, "Report");
  assert.strictEqual(state.rpcCalls[0][1].owner_filter, "user-1");

  const updated = await repository.updateDocumentStatus({
    documentId: "doc-1",
    ownerId: "user-1",
    status: "indexed",
  });
  assert.strictEqual(updated.status, "indexed");

  const deleted = await repository.deleteDocument({
    documentId: "doc-1",
    ownerId: "user-1",
  });

  assert.strictEqual(deleted.id, "doc-1");
  assert.strictEqual(state.documentDeletes.length, 1);
  assert.deepStrictEqual(state.storageUploads[0], [
    "user-1/doc-1/report.pdf",
  ]);
  assert.deepStrictEqual(state.documentDeletes[0], [
    ["id", "doc-1"],
    ["owner_id", "user-1"],
  ]);
});

test("knowledgeRepository denies cross-user read and delete", async () => {
  const { client, state } = createSupabaseMock();
  const repository = loadModuleWithMocks(
    "../../server/services/knowledge/knowledgeRepository",
    {
      "../supabaseAdmin": {
        getSupabaseAdmin: () => client,
      },
    },
  );

  await assert.rejects(
    () =>
      repository.getDocument({
        documentId: "doc-1",
        ownerId: "user-2",
      }),
    (error) => error.code === "knowledge_document_not_found",
  );
  await assert.rejects(
    () =>
      repository.deleteDocument({
        documentId: "doc-1",
        ownerId: "user-2",
      }),
    (error) => error.code === "knowledge_document_not_found",
  );
  assert.strictEqual(state.documentDeletes.length, 0);
  assert.strictEqual(state.storageUploads.length, 0);
});
