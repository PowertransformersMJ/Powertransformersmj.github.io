# crm-architect — Triggering Evals

`triggering.json` is the eval set that measures whether the skill's **description**
fires for the right queries (and stays quiet for the wrong ones). It feeds the
skill-creator harness (`run_eval.py` → `improve_description.py` → `run_loop.py`).

- **14 positives** (`should_trigger: true`): direct + indirect, English + Spanish,
  both verticals, "add a module" cases.
- **11 hard negatives** (`should_trigger: false`): things that look CRM-ish but
  aren't building a CRM — recommend-a-CRM, "what is a CRM", landing page, logo,
  e-commerce, PM board, cold email, fixing Firestore rules, portfolio, to-do app,
  newsletter form. These test **over-triggering** (the description is "eager").

## Run the quantitative loop (from YOUR authenticated terminal)

The automated harness shells out to `claude -p` and/or subagents. That does **not**
work from inside a nested Claude Code session (auth isn't passed through / 1M-context
billing). Run it from a normal authenticated terminal, from the skill-creator root:

```bash
cd C:\Users\romad\Downloads\skill-creator
python -m pip install pyyaml

# 1) Measure triggering (3 runs/query; use a standard-context model)
python -m scripts.run_eval \
  --eval-set crm-architect/evals/triggering.json \
  --skill-path crm-architect \
  --runs-per-query 3 --num-workers 6 --model sonnet --verbose > eval_results.json

# 2) (optional) Auto-improve the description from the failures
python -m scripts.improve_description \
  --eval-results eval_results.json --skill-path crm-architect --model sonnet --verbose

# 3) (optional) Full automated eval→improve loop (train/test split)
python -m scripts.run_loop --help
```

Pass `--model sonnet` (or `haiku`) so each `claude -p` uses a standard-context
model and avoids the 1M-context billing gate. A pass = trigger-rate ≥ 0.5 matches
`should_trigger`.

## Manual audit (done at creation, description v968 chars)

Reasoned case-by-case against the current description; expected outcome:

| Case | Expected | Why it should hold |
|---|---|---|
| All 14 positives | TRIGGER | description names CRM / gestión de clientes / gestor de leads / pipeline de ventas / "tracking customers, deals, follow-ups" + both verticals + "adding CRM modules" |
| Recommend-a-CRM / "what is a CRM" | NO | verbs are build/design/scaffold/extend, not recommend/inform |
| Landing page / logo for RE or dealership | NO | scoped to "customer/client/lead management app" + explicit "Not for … plain marketing pages"; "real estate"/"dealership" alone don't trigger |
| E-commerce / PM board / cold email / fix Firestore rules / portfolio / to-do / newsletter | NO | none is a customer/lead-management app being built |

Highest-risk negatives (recommend-a-CRM, RE/dealership landing page) are
explicitly fenced by the verb scoping and the "Not for merely recommending CRM
tools or building plain marketing pages" clause. Re-run the quantitative loop
after any description edit and keep the highest-scoring version.
