function getObjectValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value);
}

function resolveCommandCenterTelemetryState({
  dashboardData,
  isTelemetryLoading,
  telemetryError,
}) {
  const hasTelemetryData = Boolean(dashboardData);
  const hasActivity =
    Array.isArray(dashboardData?.activity) && dashboardData.activity.length > 0;
  const hasProjects =
    Array.isArray(dashboardData?.projects) && dashboardData.projects.length > 0;
  const hasAutomation = getObjectValues(dashboardData?.automation).length > 0;
  const isTelemetryConnected =
    hasTelemetryData && !isTelemetryLoading && !telemetryError;
  const isWaitingForRecords =
    isTelemetryConnected && !hasActivity && !hasProjects && !hasAutomation;
  const isUsingFallback =
    isTelemetryLoading || Boolean(telemetryError) || !hasTelemetryData;
  const telemetryStatusText = isTelemetryLoading
    ? "Syncing backend telemetry..."
    : telemetryError
      ? `Telemetry fallback active: ${telemetryError}`
      : isWaitingForRecords
        ? "Telemetry connected, waiting for records."
        : "Backend telemetry live.";

  return {
    hasActivity,
    hasAutomation,
    hasProjects,
    hasTelemetryData,
    isTelemetryConnected,
    isUsingFallback,
    isWaitingForRecords,
    telemetryStatusText,
  };
}

module.exports = {
  getObjectValues,
  resolveCommandCenterTelemetryState,
};
