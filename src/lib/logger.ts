// stdout carries the MCP protocol, so every log line must go to stderr.

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

let threshold: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  threshold = level;
}

function write(level: LogLevel, message: string): void {
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(threshold)) return;
  process.stderr.write(`${new Date().toISOString()} ${level.toUpperCase()} ${message}\n`);
}

export const logger = {
  debug: (message: string) => write("debug", message),
  info: (message: string) => write("info", message),
  warn: (message: string) => write("warn", message),
  error: (message: string) => write("error", message),
};
