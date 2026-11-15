// Structured server-side logger with LOG_LEVEL filtering, request correlation, and sensitive field redaction
import "server-only";

const LEVEL_WEIGHTS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "temporarypassword",
  "confirmpassword",
  "passwordhash",
  "token",
  "auth_token",
  "cookie",
  "authorization",
  "dataurl",
]);

function resolveActiveThreshold() {
  const raw = String(process.env.LOG_LEVEL || "info").toLowerCase().trim();
  return LEVEL_WEIGHTS[raw] || LEVEL_WEIGHTS.info;
}

function redactSensitive(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `[Binary ${value.byteLength} bytes]`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitive(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function emitLog(level, message, meta = {}) {
  const weight = LEVEL_WEIGHTS[level] || LEVEL_WEIGHTS.info;
  if (weight < resolveActiveThreshold()) return;

  const timestamp = new Date().toISOString();
  const safeMeta = redactSensitive(meta);
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const payload = JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(safeMeta && typeof safeMeta === "object" ? safeMeta : { meta: safeMeta }),
    });
    if (level === "error") {
      console.error(payload);
    } else if (level === "warn") {
      console.warn(payload);
    } else {
      console.log(payload);
    }
    return;
  }

  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const hasMeta = safeMeta && typeof safeMeta === "object" && Object.keys(safeMeta).length > 0;
  if (level === "error") {
    if (hasMeta) console.error(prefix, message, safeMeta);
    else console.error(prefix, message);
  } else if (level === "warn") {
    if (hasMeta) console.warn(prefix, message, safeMeta);
    else console.warn(prefix, message);
  } else {
    if (hasMeta) console.log(prefix, message, safeMeta);
    else console.log(prefix, message);
  }
}

export const logger = {
  debug: (message, meta) => emitLog("debug", message, meta),
  info: (message, meta) => emitLog("info", message, meta),
  warn: (message, meta) => emitLog("warn", message, meta),
  error: (message, meta) => emitLog("error", message, meta),
};

export default logger;
