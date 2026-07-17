# How CloudAgent works with CloudFormation, Terraform, and GitHub

CloudAgent lets AI agents build and change cloud infrastructure — but only
the way a careful engineer would. This guide explains the design: which
tools agents use for CloudFormation, Terraform, and GitHub, what guardrails
are enforced deterministically (in code, not in prompts), and how you
configure those guardrails through Workload Standards.

## The core idea: governance lives in the tools

Agents are steered by instructions, but instructions alone can be ignored or
misunderstood. CloudAgent therefore enforces its rules **inside the tools
the agent calls**. When a rule applies — "use a change set", "don't commit
to main", "don't write outside your IaC roots" — the tool either switches
behavior deterministically or refuses with a structured error the agent can
understand and self-correct from. The agent never has to be trusted to
remember a rule; the tool applies it every time.

Every governed tool also reports *which* configuration it applied and *where
that configuration came from* (workload, environment, or global default), so
each run is auditable after the fact.

## Where settings come from: the resolution chain

Guardrail configuration lives in **deployment preferences**, defined at
three levels and resolved most-specific-first:

```
workload  →  environment (permission profile)  →  global defaults
```

- **Global defaults** are set on the Workload Standards page and apply
  everywhere unless overridden.
- **Environment** settings (attached to a permission profile / account) win
  over global defaults.
- **Workload** settings win over everything, for that workload only.

In the workload configuration tab each field shows whether it is
*inherited* or *overridden*, and can be reverted to the inherited value.
Tool results include the effective settings and their source (for example
`securityRulesSource: "workload"`), so you can always tell which level's
rules governed an operation.

When an agent calls a tool without naming a workload, CloudAgent maps the
target (a CloudFormation stack, or a Git repository) back to the workload
that owns it. If the target matches more than one workload, the tool refuses
with an "ambiguous workload" error and asks the agent to pass a
`workloadId` explicitly — governance is never silently skipped because the
mapping was unclear.

## CloudFormation

Agents deploy CloudFormation through a single tool, `aws_cfn_operations`,
which wraps validate-then-deploy into one governed step:

1. **Validation always runs first.** The template is linted with
   `cfn-lint` and evaluated with CloudFormation Guard against the security
   rules selected for the workload/environment (encryption, public access,
   logging, versioning, and so on). A template that fails validation is
   never sent to AWS.
2. **Change-set governance.** If the effective deployment preferences set
   `changeSet: true`, the tool deterministically creates a **change set**
   and never updates the stack directly — a human reviews and executes the
   change set. If change sets are not required, the tool deploys directly.
   The agent cannot choose; the setting decides.
3. **Auditable output.** Results carry the validation report, whether a
   change set was required, and the source of each governing setting.

## Terraform / OpenTofu

Terraform follows a *check-before-PR* design built around plan JSON:

- **`terraform_plan_check`** (read-only, freely callable): runs
  `terraform init` and `terraform plan` in the workload's declared IaC root
  using read-only credentials, converts the saved plan to JSON, and
  evaluates it with two engines — CloudFormation Guard for custom/org
  policy rules and Trivy for the built-in best-practices pack. Findings are
  normalized into one result format and scoped to the resources the plan
  actually changes.
- The agent **iterates against the check** — fix, re-plan, re-check — with
  no human in the loop, and only opens a pull request once the check
  passes. The plan summary and policy report are included in the PR body,
  so reviewers see exactly what will change and what was validated.
- Plans are evaluated as **plan JSON, never raw HCL**, so variables,
  modules, and expressions are fully resolved before rules run.
- Execution is separate from checking: applying a plan is an
  approval-gated step that runs the *saved* plan file, so what the human
  approved is byte-for-byte what executes.

Each workload declares its Terraform/OpenTofu **roots** (`iac.roots[]`),
workspace, and var files. The check tool refuses paths that resolve outside
the repository or the declared root — and those same roots also scope where
the GitHub tools may write (below).

## GitHub

Agents interact with repositories the way a careful engineer does:
**branch → commit → pull request**. That flow is enforced by the GitHub
tools themselves, configured under `deploymentPreferences.github` with the
same workload → environment → global resolution chain. The defaults are the
secure values, so the guardrails are on even if you never touch a setting.

### The delivery flow

1. `create_github_branch` — creates a working branch off the base.
2. `write_github_file` — writes files and commits them on that branch.
3. `create_github_pull_request` — pushes the branch and opens a PR
   (a **draft** PR by default) into the repository's default branch.

There is deliberately **no merge tool**. CloudAgent never merges pull
requests — merging is always a human decision made in GitHub.

### What the guardrails enforce

- **Protected branches.** `main`, `master`, and the repository's detected
  default branch can never be committed to, reset, or used as a PR head.
  In the default `pr_only` mode, every change must go through a branch and
  a pull request.
- **Branch naming.** Agent branches must carry the configured prefix
  (default `cloudagent/`), so agent work is always recognizable. A
  non-conforming name is refused with a suggested compliant name — never
  silently renamed.
- **No clobbering.** Branch creation never force-resets an existing branch.
  An existing branch is only reset when the reset policy allows it
  (by default, only branches carrying the agent prefix); pushes are never
  forced.
- **Path scoping.** Writes can be confined to the workload's declared IaC
  roots plus an explicit allow list. Deny patterns —
  `.github/workflows/**` (CI tampering), `**/*.tfstate`, `**/.env*` —
  apply **always**, even when path scoping is otherwise open, unless you
  explicitly remove them.
- **Secret scanning.** File content is scanned before commit for
  credential patterns (AWS access keys, private key blocks, GitHub and API
  tokens). A match blocks the write and reports only the *pattern name*,
  never the matched value.
- **PR size limits.** Before anything is pushed, the diff is checked
  against limits (default: 50 files, 512 KB, no binaries). Oversized or
  binary-bearing changes are refused before they leave the machine.
- **Base verification.** PRs may only target the repository's default
  branch (or an explicitly configured alternate), so an agent cannot open
  a PR into an arbitrary branch.
- **Attribution.** Commits carry a co-author trailer, PRs get a
  `cloudagent` label and a footer identifying the run and workload — you
  can always tell which changes an agent made, and from which run.

### Structured refusals, not opaque failures

When a guardrail blocks an operation, the tool returns a machine-readable
error — `protected_branch`, `branch_prefix_required` (with a suggested
name), `branch_exists`, `path_denied` (with the allowed roots),
`secret_detected` (pattern name only), `diff_too_large`,
`invalid_base_branch`, `repo_not_configured`,
`ambiguous_workload_for_repo` — with a flag for whether it is retryable.
Agents use these to self-correct (for example, creating a properly prefixed
branch and retrying); the run view renders them as readable "GitHub
guardrail" events rather than raw failures.

### Branch protection: the server-side floor

Tool-level rules bind CloudAgent's own tools and well-behaved agents, but
an external agent with shell access could still run `git push origin main`
directly. The real floor is **GitHub branch protection**. CloudAgent
*verifies* — and never modifies — the protection status of each configured
repository's default branch, and surfaces it in the workload configuration
tab. If the default branch is unprotected you'll see a warning chip
("main is not protected — agents could bypass PR-only locally") with a
"Verify now" action. Enable branch protection or rulesets in GitHub to
close that gap.

### A note on identity

The GitHub CLI (`gh`) authenticates as **you**. Branches and pull requests
created by agents are created under your GitHub login (with the CloudAgent
attribution label, trailer, and footer making the agent's role explicit).

## Configuring it all: Workload Standards

The **Workload Standards** page holds the global defaults:

- **CloudFormation change approvals** — whether stacks require change sets.
- **Security rules** — the Guard/Trivy policy selections applied during
  CloudFormation validation and Terraform plan checks.
- **Source Control (GitHub)** — PR-only mode, protected branches, branch
  prefix, draft PRs, branch-reset policy, and (under Advanced) path
  scoping, secret scanning, size limits, and attribution.

The same cards appear in each workload's configuration tab (and at the
environment level) with inheritance badges, so you can see and override the
effective policy per workload. The GitHub card also shows the repository
status row: detected default branch, branch-protection check result, and
last verified time.

Agents are told about these rules up front — the MCP instructions and the
`get_deployment_preferences_summary` tool describe the effective policy
(use the GitHub tools for all repo changes, PR-only, branch prefix, no
direct pushes) — but the enforcement never depends on the agent listening.
