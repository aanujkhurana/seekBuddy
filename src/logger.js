export function logStep(message, details) {
  log("STEP", message, details);
}

export function logSuccess(message, details) {
  log("OK", message, details);
}

export function logWarn(message, details) {
  log("WARN", message, details);
}

export function logError(message, error) {
  log("ERROR", message, formatError(error));
}

function log(level, message, details) {
  const suffix = details ? ` ${formatDetails(details)}` : "";
  console.log(`[${new Date().toISOString()}] [${level}] ${message}${suffix}`);
}

function formatDetails(details) {
  if (typeof details === "string") return details;
  return JSON.stringify(details);
}

function formatError(error) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }
  return { message: String(error) };
}
