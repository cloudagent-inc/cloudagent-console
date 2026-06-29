export function getUserId(runContext) {
  return runContext?.context?.userId ?? runContext?.toolExecutionContext?.userId ?? null;
}
