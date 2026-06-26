import { executeLocalWorkflow } from "./local-runner.mjs";
import { parseStoredJsonValue } from "@cloudagent/storage";

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_LOOKAHEAD_YEARS = 2;

function nowIso() {
  return new Date().toISOString();
}

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function parseJsonMaybe(value, fallback = null) {
  return parseStoredJsonValue(value, fallback);
}

function parseSchedule(value) {
  const schedule = parseJsonMaybe(value, value);
  return schedule && typeof schedule === "object" && !Array.isArray(schedule)
    ? schedule
    : {};
}

function parseTime(value = "09:00") {
  const match = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(safeTrim(value));
  if (!match) return { hour: 9, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1]) || 0));
  const minute = Math.min(59, Math.max(0, Number(match[2]) || 0));
  return { hour, minute };
}

function uiDayOfWeekToCron(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  if (parsed >= 1 && parsed <= 7) return parsed - 1;
  if (parsed >= 0 && parsed <= 6) return parsed;
  return 1;
}

function scheduleToCron(schedule = {}) {
  const explicit = safeTrim(schedule.cron);
  if (explicit) return explicit;

  const { hour, minute } = parseTime(schedule.time);
  const type = safeTrim(schedule.type || "daily").toLowerCase();
  if (type === "weekly") {
    return `${minute} ${hour} * * ${uiDayOfWeekToCron(schedule.dayOfWeek ?? 1)}`;
  }
  if (type === "monthly") {
    const day = Math.min(31, Math.max(1, Number(schedule.dayOfMonth) || 1));
    return `${minute} ${hour} ${day} * *`;
  }
  return `${minute} ${hour} * * *`;
}

function parseCronField(field, min, max) {
  const values = new Set();
  for (const partRaw of safeTrim(field).split(",")) {
    const part = partRaw.trim();
    if (!part) continue;
    const [rangePart, stepPart] = part.split("/");
    const step = Math.max(1, Number(stepPart) || 1);
    let start = min;
    let end = max;

    if (rangePart !== "*") {
      const [startRaw, endRaw] = rangePart.split("-");
      start = Number(startRaw);
      end = endRaw == null ? start : Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error(`Invalid cron field: ${field}`);
      }
    }

    start = Math.max(min, Math.min(max, start));
    end = Math.max(min, Math.min(max, end));
    for (let value = start; value <= end; value += step) values.add(value);
  }
  if (values.size === 0) throw new Error(`Invalid cron field: ${field}`);
  return values;
}

function parseCronExpression(expression) {
  const parts = safeTrim(expression).split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Local workflow scheduler supports 5-field cron expressions only.");
  }
  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 7),
  };
}

function getDateParts(date, timezone) {
  if (!timezone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      dayOfWeek: date.getDay(),
    };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  const dayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    dayOfWeek,
  };
}

function cronMatches(cron, date, timezone) {
  const parts = getDateParts(date, timezone);
  const cronDow = parts.dayOfWeek === 0 ? 7 : parts.dayOfWeek;
  return (
    cron.minute.has(parts.minute) &&
    cron.hour.has(parts.hour) &&
    cron.dayOfMonth.has(parts.day) &&
    cron.month.has(parts.month) &&
    (cron.dayOfWeek.has(parts.dayOfWeek) || cron.dayOfWeek.has(cronDow))
  );
}

function ceilToNextMinute(date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  if (next.getTime() <= date.getTime()) next.setMinutes(next.getMinutes() + 1);
  return next;
}

export function getNextScheduledRunAt(schedule, after = new Date()) {
  const cron = parseCronExpression(scheduleToCron(schedule));
  const timezone = safeTrim(schedule.timezone || schedule.timeZone);
  const maxTime = after.getTime() + DEFAULT_LOOKAHEAD_YEARS * 366 * 24 * 60 * 60 * 1000;
  const cursor = ceilToNextMinute(after);

  while (cursor.getTime() <= maxTime) {
    if (cronMatches(cron, cursor, timezone)) return cursor.toISOString();
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  throw new Error("Could not find next scheduled run within lookahead window.");
}

function isScheduledWorkflow(workflow) {
  const schedule = parseSchedule(workflow?.schedule);
  if (safeTrim(schedule.triggerType).toLowerCase() !== "scheduled") return false;
  if (schedule.enabled === false) return false;
  if (workflow?.status && safeTrim(workflow.status).toLowerCase() === "disabled") return false;
  return true;
}

function buildWorkflowDefinition(workflow) {
  return {
    ...workflow,
    schedule: parseSchedule(workflow.schedule),
    nodes: parseJsonMaybe(workflow.nodes, workflow.nodes || []),
  };
}

export async function reconcileLocalWorkflowSchedules({ store, now = new Date(), running = new Set() }) {
  const workflows = await store.listWorkflowDefinitions();
  const results = [];

  for (const workflow of workflows) {
    const workflowId = workflow?.workflowId;
    if (!workflowId || !isScheduledWorkflow(workflow)) continue;
    const schedule = parseSchedule(workflow.schedule);

    try {
      const state = await store.getWorkflowScheduleState(workflowId);
      const nextRunAt = state?.nextRunAt || getNextScheduledRunAt(schedule, state?.lastCheckedAt ? new Date(state.lastCheckedAt) : now);
      const due = Date.parse(nextRunAt) <= now.getTime();

      if (!due) {
        if (state?.nextRunAt !== nextRunAt) {
          await store.updateWorkflowScheduleState(workflowId, {
            enabled: true,
            cron: scheduleToCron(schedule),
            timezone: schedule.timezone || schedule.timeZone || null,
            nextRunAt,
            lastCheckedAt: nowIso(),
          });
        }
        results.push({ workflowId, status: "scheduled", nextRunAt });
        continue;
      }

      if (running.has(workflowId)) {
        results.push({ workflowId, status: "already_running", nextRunAt });
        continue;
      }

      const shouldCatchUp = schedule.catchUp === true;
      const missed = Date.parse(nextRunAt) < now.getTime() - 60_000;
      if (missed && !shouldCatchUp) {
        const skippedAt = now.toISOString();
        const nextAfterSkip = getNextScheduledRunAt(schedule, now);
        await store.updateWorkflowScheduleState(workflowId, {
          enabled: true,
          cron: scheduleToCron(schedule),
          timezone: schedule.timezone || schedule.timeZone || null,
          lastSkippedAt: skippedAt,
          lastSkipReason: "missed_run_while_app_was_not_running",
          nextRunAt: nextAfterSkip,
          lastCheckedAt: nowIso(),
        });
        results.push({ workflowId, status: "missed_skipped", nextRunAt: nextAfterSkip });
        continue;
      }

      running.add(workflowId);
      await store.updateWorkflowScheduleState(workflowId, {
        enabled: true,
        cron: scheduleToCron(schedule),
        timezone: schedule.timezone || schedule.timeZone || null,
        lastStartedAt: now.toISOString(),
        lastRunStatus: "running",
        nextRunAt,
        lastCheckedAt: nowIso(),
      });

      try {
        const result = await executeLocalWorkflow({
          store,
          workflowDefinition: buildWorkflowDefinition(workflow),
        });
        const nextAfterRun = getNextScheduledRunAt(schedule, now);
        await store.updateWorkflowScheduleState(workflowId, {
          lastRunAt: now.toISOString(),
          lastRunId: result.workflowRunId,
          lastRunStatus: result.workflowStatus,
          lastRunMessage: result.message || result.summary || null,
          nextRunAt: nextAfterRun,
          lastCheckedAt: nowIso(),
        });
        results.push({ workflowId, status: "ran", workflowRunId: result.workflowRunId, nextRunAt: nextAfterRun });
      } catch (error) {
        const nextAfterFailure = getNextScheduledRunAt(schedule, now);
        await store.updateWorkflowScheduleState(workflowId, {
          lastRunAt: now.toISOString(),
          lastRunStatus: "failed",
          lastRunMessage: error?.message || String(error),
          nextRunAt: nextAfterFailure,
          lastCheckedAt: nowIso(),
        });
        results.push({ workflowId, status: "failed", error: error?.message || String(error), nextRunAt: nextAfterFailure });
      } finally {
        running.delete(workflowId);
      }
    } catch (error) {
      await store.updateWorkflowScheduleState(workflowId, {
        enabled: false,
        lastRunStatus: "scheduler_error",
        lastRunMessage: error?.message || String(error),
        lastCheckedAt: nowIso(),
      });
      results.push({ workflowId, status: "scheduler_error", error: error?.message || String(error) });
    }
  }

  return results;
}

export function startLocalWorkflowScheduler({ store, pollIntervalMs } = {}) {
  if (!store) throw new Error("startLocalWorkflowScheduler requires a store");
  const intervalMs = Math.max(5_000, Number(pollIntervalMs || process.env.LOCAL_WORKFLOW_SCHEDULER_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS));
  const running = new Set();
  let stopped = false;
  let timer = null;
  let tickInProgress = false;

  async function tick() {
    if (stopped || tickInProgress) return;
    tickInProgress = true;
    try {
      await reconcileLocalWorkflowSchedules({ store, now: new Date(), running });
    } catch (error) {
      console.warn("[local workflow scheduler] tick failed", error?.message || error);
    } finally {
      tickInProgress = false;
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  }

  timer = setTimeout(tick, 1_000);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    async runNow() {
      return reconcileLocalWorkflowSchedules({ store, now: new Date(), running });
    },
  };
}
