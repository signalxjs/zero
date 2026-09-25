export const meta = {
  name: 'fix-issues',
  description: 'Pick fixable open issues and take each one end to end: worktree, fix, PR, Copilot review, merge queue',
  whenToUse: 'Burn down the concrete part of the backlog. Args (all optional): {max: 6, issues: [N...], exclude: [N...]}',
  phases: [
    { title: 'Select', detail: 'rank open issues, skip RFCs/blocked/in-flight' },
    { title: 'Assess', detail: 'read issue + code; fixable, needs-decision, already-fixed, too-big' },
    { title: 'Implement', detail: 'pnpm wt new, fix, verify, PR with Copilot' },
    { title: 'Land', detail: 'address Copilot, resolve threads, green checks, enqueue' },
  ],
}

const opts = args || {}
const MAX = opts.max || 6
const EXCLUDE = opts.exclude || []

// Out of scope per #159 (RFC-scale, each needs its own planned session) plus trackers.
const RFC_SCALE = [35, 36, 18, 20, 21, 23, 24, 28, 27, 15, 11, 10, 22]
const TRACKERS = [159, 219]

const REPO_HINT = `Repo: signalxjs/zero. Layout: <repo>/main is the primary checkout (never edit or commit there), \
<repo>/branches/<name> are worktrees. Find <repo> with: dirname "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")".`

const QUESTION_RULE = `If the fix needs a maintainer decision, do not guess. Post ONE issue comment \
(gh issue comment N --body ...) with what you found, lettered options (a)/(b)/(c) with trade-offs, and which one you \
recommend. First check the existing comments: if an equivalent question is already there and unanswered, don't post again.`

const SELECT_SCHEMA = {
  type: 'object',
  properties: {
    picked: { type: 'array', items: { type: 'object', properties: {
      number: { type: 'integer' }, title: { type: 'string' }, why: { type: 'string' },
    }, required: ['number', 'title', 'why'] } },
    skipped: { type: 'array', items: { type: 'object', properties: {
      number: { type: 'integer' }, reason: { type: 'string' },
    }, required: ['number', 'reason'] } },
  },
  required: ['picked', 'skipped'],
}

const ASSESS_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['fixable', 'needs-decision', 'already-fixed', 'too-big'] },
    slug: { type: 'string', description: 'short kebab-case slug for the branch, e.g. stats-item-color' },
    plan: { type: 'string', description: 'concrete implementation plan: files, changes, tests to add/run' },
    summary: { type: 'string' },
  },
  required: ['verdict', 'slug', 'plan', 'summary'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pr-open', 'failed', 'needs-decision'] },
    pr: { type: 'integer', description: 'PR number, 0 if none' },
    branch: { type: 'string' },
    dir: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['status', 'pr', 'branch', 'dir', 'notes'],
}

const LAND_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['queued', 'needs-human'] },
    reason: { type: 'string' },
  },
  required: ['status', 'reason'],
}

// ── Select ────────────────────────────────────────────────────────────────
phase('Select')
let picked
if (opts.issues && opts.issues.length) {
  picked = opts.issues.map(n => ({ number: n, title: '', why: 'passed in args.issues' }))
  log(`Using ${picked.length} issue(s) from args: ${opts.issues.map(n => '#' + n).join(' ')}`)
} else {
  const sel = await agent(
    `${REPO_HINT}

Pick up to ${MAX} open issues that one agent can fix end to end in a single PR. Read-only: change nothing.

1. gh issue list --state open --limit 200 --json number,title,labels,body,updatedAt
2. gh pr list --state open --json number,title,body,headRefName, and ls <repo>/branches, to see what is already in flight.
3. Exclude, and list each one in "skipped" with a reason:
   - labels deferred, spike, kit
   - RFC-scale issues: ${RFC_SCALE.map(n => '#' + n).join(' ')}
   - trackers: ${TRACKERS.map(n => '#' + n).join(' ')}; also any other issue that is mainly a checklist of other issues
   - issues with an open PR (Closes/Fixes #N, or a head branch starting with "N-") or an existing <repo>/branches/N-* worktree
   - issues whose latest comment is a question or options for the maintainer that nobody has answered
     (check with gh issue view N --comments; this is how #29, #30, #16 are blocked)
   - explicitly excluded: ${EXCLUDE.length ? EXCLUDE.map(n => '#' + n).join(' ') : '(none)'}
4. Rank what's left by how concrete it is: reproducible bugs first, then from:agentic items with a clear fix, then small
   features with a settled design. Skip anything vague or cross-cutting ("too big: ..."). Keep the top ${MAX}.`,
    { label: 'select', phase: 'Select', schema: SELECT_SCHEMA, effort: 'medium' },
  )
  if (!sel) return { error: 'selection agent failed' }
  picked = sel.picked.slice(0, MAX)
  log(`Picked: ${picked.map(p => `#${p.number}`).join(' ') || '(none)'}`)
  for (const s of sel.skipped) log(`skip #${s.number}: ${s.reason}`)
  if (!picked.length) return { picked: [], skipped: sel.skipped, results: [] }
}

// ── Assess → Implement → Land, per issue, no barriers ──────────────────────
const results = await pipeline(
  picked,

  (issue) => agent(
    `${REPO_HINT}

Assess issue #${issue.number}${issue.title ? ` ("${issue.title}")` : ''}. Read it with gh issue view ${issue.number} --comments,
then read the relevant code in <repo>/main. Read-only except for the issue actions below.

Decide on one verdict:
- fixable: one PR can fix it, with no open design question. Write a concrete plan: files, changes, tests.
- needs-decision: ${QUESTION_RULE}
- already-fixed: main already does what the issue asks. Prove it (the commit/PR that fixed it, a test that covers it),
  then gh issue comment with that evidence and gh issue close ${issue.number}.
- too-big: RFC-scale or cross-cutting, needs its own planned session. Take no action.`,
    { label: `assess:#${issue.number}`, phase: 'Assess', schema: ASSESS_SCHEMA, effort: 'medium' },
  ),

  (a, issue) => {
    if (!a || a.verdict !== 'fixable') return { assess: a, impl: null }
    return agent(
      `${REPO_HINT}

Fix issue #${issue.number} end to end, following the AGENTS.md development workflow. The issue already exists: skip step 1.

Plan from assessment:
${a.plan}

Steps:
1. From <repo>/main: pnpm wt new ${issue.number}-${a.slug}. Then work ONLY in <repo>/branches/${issue.number}-${a.slug}.
   Every command runs there; use absolute paths.
2. Implement. Update in-repo docs in the same change, per the AGENTS.md "Documentation" table.
3. Verify: pnpm typecheck, plus the relevant pnpm test / pnpm build. Fix any failure. Never skip or weaken a test to get green.
4. Before committing, git branch --show-current must print ${issue.number}-${a.slug}.
   Stage specific paths with git add <path>, never -A. No co-author trailers.
5. git push -u origin HEAD, then gh pr create --base main --title "<title>" --body "Closes #${issue.number}. <summary written as
   the squash commit body>" --reviewer @copilot. If @copilot doesn't resolve, use the requested_reviewers API fallback in AGENTS.md.
6. For a user-facing change, file the docs-repo issue and link it from the PR, per AGENTS.md "Documentation".

${QUESTION_RULE} If that happens partway through, post the question and return status needs-decision without opening a PR.
If you can't get to green, return failed and explain why in notes. Leave the worktree in place.`,
      { label: `fix:#${issue.number}`, phase: 'Implement', schema: IMPL_SCHEMA },
    ).then(impl => ({ assess: a, impl }))
  },

  (r, issue) => {
    if (!r || !r.impl || r.impl.status !== 'pr-open' || !r.impl.pr) return { ...r, land: null }
    const { pr, dir } = r.impl
    return agent(
      `${REPO_HINT}

Take PR #${pr} (issue #${issue.number}, worktree ${dir}) through Copilot review and into the merge queue.
Work only in ${dir}, following AGENTS.md steps 5–6.

1. Wait for copilot-pull-request-reviewer to review: poll gh pr view ${pr} --json reviews in a bounded until-loop,
   about 30s between polls and a 10 min cap. Use Monitor or one Bash call with a timeout; don't sleep in the foreground.
2. Read gh pr view ${pr} --json reviews,comments and the unresolved review threads (GraphQL query in AGENTS.md).
   Fix each actionable comment, rerun pnpm typecheck and the relevant tests, commit specific paths, and push.
   For a comment you decline, reply with the reason. Resolve every thread you address or decline.
3. Re-request review (gh pr edit ${pr} --add-reviewer @copilot) and repeat. Stop after 3 rounds.
4. When no threads are unresolved and gh pr checks ${pr} is green (e2e included; gh pr checks ${pr} --watch works),
   run gh pr merge ${pr} --squash --auto and return queued.
5. If CI fails, fix it if the cause is in this PR. Otherwise, or after 3 rounds with feedback still open,
   return needs-human with a precise reason.`,
      { label: `land:#${issue.number} (PR #${pr})`, phase: 'Land', schema: LAND_SCHEMA },
    ).then(land => ({ ...r, land }))
  },
)

// ── Summary ─────────────────────────────────────────────────────────────────
const rows = picked.map((issue, i) => {
  const r = results[i]
  const a = r && r.assess
  const impl = r && r.impl
  const land = r && r.land
  const row = {
    issue: issue.number,
    verdict: a ? a.verdict : 'agent-failed',
    pr: impl && impl.pr ? impl.pr : null,
    status: land ? land.status : impl ? impl.status : a ? a.verdict : 'agent-failed',
    note: land ? land.reason : impl ? impl.notes : a ? a.summary : 'no result',
  }
  if (row.status !== 'queued') log(`#${row.issue}: ${row.status} (${row.note.slice(0, 120)})`)
  return row
})

return { rows }
