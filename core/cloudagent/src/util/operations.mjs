const opFinalizeStore = new Map();

export function saveFinalizeResult(opExecutionId, payload) {
  if (!opExecutionId) return;
  opFinalizeStore.set(opExecutionId, payload);
}

export function takeFinalizeResult(opExecutionId) {
  if (!opExecutionId) return null;
  const payload = opFinalizeStore.get(opExecutionId) || null;
  if (payload) opFinalizeStore.delete(opExecutionId);
  return payload;
}

export function extractFinalizeOperationResult(history) {
  for (const blk of history ?? []) {
    if (blk?.type === "function_call_output" && blk?.name === "finalize_operation_result") {
      return blk.output ?? null;
    }
  }
  return null;
}
