const http = require("node:http");
const Module = require("node:module");
const path = require("node:path");

function loadModuleWithMocks(modulePath, mocks = {}) {
  const resolvedPath = require.resolve(modulePath);
  delete require.cache[resolvedPath];

  Object.keys(mocks).forEach((request) => {
    try {
      const mockResolved = Module._resolveFilename(
        request,
        {
          filename: resolvedPath,
          paths: Module._nodeModulePaths(path.dirname(resolvedPath)),
        },
      );

      delete require.cache[mockResolved];
    } catch {
      // Ignore mocks that cannot be resolved ahead of time.
    }
  });

  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(resolvedPath);
  } finally {
    Module._load = originalLoad;
  }
}

async function startServer(app) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, options);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    body,
    response,
    status: response.status,
  };
}

function createAuthHeader(token = "Bearer test-token") {
  return {
    authorization: token,
  };
}

function createMultipartFile({ content, filename, mimeType = "text/plain" }) {
  const formData = new FormData();
  formData.append(
    "file",
    new File([content], filename, {
      type: mimeType,
    }),
  );

  return formData;
}

function resolveKnowledgeRoutePath(...segments) {
  return path.join(__dirname, "..", "..", "server", "routes", ...segments);
}

module.exports = {
  createAuthHeader,
  createMultipartFile,
  loadModuleWithMocks,
  requestJson,
  resolveKnowledgeRoutePath,
  startServer,
};
