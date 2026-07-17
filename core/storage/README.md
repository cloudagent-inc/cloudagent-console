# CloudAgent Storage

`core/storage` (npm: `@cloudagent/storage`) implements the console's local
persistence: `JsonFileStore`, a JSON-file-per-record store rooted at the
user’s data directory (chosen in Preferences; default under the Electron
`userData` path). There is no database and no hosted backend — this store
is the single source of truth for console data.

The desktop shell passes the saved Preferences path explicitly. The storage
package does not read a data-directory environment variable.

## Layout on disk

Each record type gets a directory under the data dir, one JSON file per
record (`<encoded-id>.json`):

```text
permission-profiles/     Cloud credential/auth profiles
workloads/               Workload records
workflows/               Workflow definitions
workflow-runs/           Workflow run history
skills/                  Skill records
chat-records/            Chat sessions
agent-history/           Agent run records
agent-run-events/        Streamed agent run events
scheduler/workflows/     Scheduler state per workflow
summaries/…              Executive summaries (environments, workloads)
report-history/          Report runs
scanner-runs/            Scanner run metadata
artifacts/               Scanner/diagram artifacts (scoped subdirs)
```

## What it exports

- `JsonFileStore` — CRUD, listing/pagination, scanner-artifact read/write,
  and settings helpers used by the desktop API.
- `DEFAULT_AUTH` — the fixed single-user auth context of the desktop app
  (`userId: "local-user"`).
- `parseStoredObject` / `parseStoredJsonValue` — tolerant parsing of stored
  values.

## Path safety

All file paths derived from external input (record ids, scope ids, scan
ids) are sanitized (`..`-style dot-only segments are neutralized, ids are
URI-encoded for filenames) and every filesystem operation passes through a
containment guard that throws if a resolved path would escape the data
directory.

A SQLite adapter behind the same interface is a possible future evolution;
the JSON layout is deliberately simple and user-inspectable (Preferences
has an "open data folder" action).

## Startup safety

`JsonFileStore.init()` is additive and idempotent. It creates missing record
directories and creates `schema.json` or `settings.json` only when those files
do not already exist. It does not clear directories, replace an existing
store, or delete records. Record files are removed only through an explicit
delete operation for that record type.
