export function formatOnlyPumpApiError(value, fallback = "") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === "object") {
    const directMessage =
      value.message ||
      value.error ||
      value.error_description ||
      value.hint ||
      value.details;

    if (typeof directMessage === "string" && directMessage.trim()) {
      return directMessage;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback || String(value);
    }
  }

  return String(value || fallback);
}

export function createOnlyPumpApiError({
  endpointName = "onlypump-api",
  action = "unknown",
  status = 0,
  result = null,
  fallback = ""
} = {}) {
  const message =
    formatOnlyPumpApiError(result?.error || result?.message || result, fallback) ||
    `${endpointName} ${action} failed with ${status}`;

  const error = new Error(message);
  error.endpointName = endpointName;
  error.action = action;
  error.status = status;
  error.payload = result;
  return error;
}
