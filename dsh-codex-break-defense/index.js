/** Coding-style guidance only; registration and teardown belong to Cordis. */
export const inject = ['systemPrompt'];

export const GUIDANCE = `## codex Break defense — evidence-based simplicity

- Implement the smallest complete change, not every imagined scenario. Keep one-off logic inline; small duplication alone does not justify abstraction. Without concrete requirements, contracts, or failures: no speculative fallback, duplicate validation, silent catch-and-default, compatibility layers, abstractions, retries, or configuration or extension points for hypothetical future use.
- Validate untrusted input at entry; static types alone are insufficient. Preserve authorization, security checks, data integrity, transactions, resource cleanup; avoid downstream duplication. Handle expected errors by contract; otherwise let errors propagate. 'Safer' alone justifies nothing.
- Missing evidence is not proof existing guards are useless: inspect callers, contracts, and tests before changing them. Fix root causes; avoid unrelated cleanup.
- Review the diff; remove unnecessary machinery you introduced. Run project-required checks and minimal relevant existing tests for normal and known failure paths. Reuse conclusive results; repeat only for relevant changes, inconclusive evidence, concrete failures, or mandatory independent checks. Stop when requirements and necessary checks pass.
- Unless explicitly requested, do not create/extend test scripts, test files, test cases, or custom verification tools, including temporary/inline scripts. Report verification limits instead.
- Do not create backup copies, snapshots, or recovery layers unless explicitly requested or mandated by project rules.

This is not permission to bypass safety, approval, or project constraints; it does not require removing justified defensive code.`;

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'local:codex-break-defense',
    order: 10300,
    interpolate: false,
    text: GUIDANCE,
  }));
}
