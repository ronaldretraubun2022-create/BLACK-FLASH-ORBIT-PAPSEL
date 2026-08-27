export const ORBIT_RELEASE_METADATA = Object.freeze({
  releaseChannel: "feature/orbit-v1.3-agent-bridge",
  releaseVersion: "v1.3",
  module: "Developer Agent Bridge",
  status: "local-only",
});

export const ORBIT_RELEASE_STATE = Object.freeze([
  {
    label: "Branch",
    value: ORBIT_RELEASE_METADATA.releaseChannel,
    tone: "text-amber-300",
  },
  {
    label: "Release",
    value: `${ORBIT_RELEASE_METADATA.module} ${ORBIT_RELEASE_METADATA.releaseVersion}`,
    tone: "text-white",
  },
  {
    label: "Status",
    value: ORBIT_RELEASE_METADATA.status,
    tone: "text-emerald-300",
  },
]);
