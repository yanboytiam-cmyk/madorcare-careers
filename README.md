# MaDorCARE — careers application form

A single-question-per-screen application funnel for the three roles on the hiring
flyer. Static site on GitHub Pages, applications land in a Google Sheet, resumes
land in a Google Drive folder.

```
index.html      markup shell
config.js       brand, roles, and every question — the only file you normally edit
app.js          flow engine: branching, validation, draft saving, upload, submit
styles.css      visual system taken from the flyer
apps-script/    the Google backend
assets/         logo and the original flyer
```

## The backend (live, nothing to do)

The form posts to n8n, which files the application and answers with a reference
number. Two workflows, both active:

| Workflow | id | What it does |
|---|---|---|
| `MaDorCARE - candidatures` | `CDB9KtNMFlsDqxJW` | webhook → uploads the resume to Drive → appends a row to the sheet → replies `{ok, reference}` |
| `MaDorCARE - alerte erreur` | `zd9BDW1mFhHHoNfs` | error trigger → emails Yanis with the failing node and a link to the execution |

- Webhook: `https://n8n.srv1325858.hstgr.cloud/webhook/madorcare-candidature`
- Sheet: [MaDorCARE Applications](https://docs.google.com/spreadsheets/d/1ZRScX_u594uRmiMnQ1YI7ORnvVALFmykxNvMx7BWxbc/edit), tab `Applications` (gid `751523646`)
- Resumes: [MaDorCARE Resumes](https://drive.google.com/drive/folders/1lMy2VANgHha400yygW3RdRhO_gH6Umoj)

The main workflow names the error workflow in its settings, so any failure in the
chain sends the alert. The candidate meanwhile gets the fallback screen with the
clinic's email address, and their answers stay saved in their browser.

To rebuild or change the workflows, edit [`n8n/build_workflows.py`](n8n/build_workflows.py)
and run it on the VPS with `N8N_BASE_URL` and `N8N_API_KEY` in the environment. It
updates in place rather than duplicating.

### Columns

The sheet has a fixed set of columns. Role-specific answers (approaches, caseload,
prescriptive authority, and so on) are folded into the single **Role details**
column, so adding a question to one role never shifts the sheet's shape. Change
that mapping in the `Preparer la candidature` node.

### The Apps Script alternative

[`apps-script/Code.gs`](apps-script/Code.gs) is a standalone Google Apps Script
backend that does the same job without n8n. It is not in use; keep it as a
fallback if the VPS ever goes away. Point `ENDPOINT` at its Web app URL to switch.

## Changing the questions

Everything is in `config.js`.

- **A new role**: add an entry to `ROLES`. `extras` are questions only that role
  sees; set `credentials` to a list of licences, or `null` if the role needs none.
- **A new question for everyone**: add an entry to `FLOW`, in the position you
  want it asked.
- **Conditional questions**: give the entry a `when: answers => …`. It stays
  hidden until that returns true.
- New questions become new columns in the sheet automatically. Existing columns
  keep their position, so old rows stay readable.

Types available: `text`, `email`, `tel`, `number`, `textarea`, `radio`,
`select`, `checkbox` (multi-select), `file`. Add `autoAdvance: true` to a
single-choice question to move on as soon as it is tapped.

## Notes

- Answers are kept in the browser's local storage as the candidate types, so a
  dropped connection or a closed tab does not lose the application. The draft is
  cleared once the application sends.
- Resumes are capped at 5 MB (`maxMB` on the `cv` question).
- The form is keyboard-driven on desktop: letter keys pick an option, Enter
  advances, Ctrl+Enter advances out of a long text box.
