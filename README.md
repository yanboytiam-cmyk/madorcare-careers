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

## Connecting the inbox (once, about five minutes)

The form cannot send anything until this is done. Until then it shows a
"not connected to its inbox yet" screen instead of the confirmation.

1. Go to <https://sheets.new> and name the spreadsheet **MaDorCARE Applications**.
2. In that sheet: **Extensions → Apps Script**.
3. Delete whatever is in `Code.gs` and paste the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs). Save.
4. **Deploy → New deployment → Web app**, with:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Authorise when Google asks. It will warn that the app is unverified: choose
   **Advanced → Go to (project name)**. This is normal for your own script.
6. Copy the **Web app URL** and paste it into the last line of `config.js`:

   ```js
   const ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';
   ```

7. Commit and push. GitHub Pages redeploys in about a minute.

To check it worked, open the Web app URL in a browser. It should answer
`{"ok":true,"service":"MaDorCARE careers intake","ready":true}`.

### Email alerts

Optional. In `Code.gs`, set `const NOTIFY = 'someone@madorcare.com';` and
redeploy (**Deploy → Manage deployments → edit → New version**).

### Where the resumes go

Into a Drive folder named **MaDorCARE Resumes**, owned by whoever deployed the
script. Each row in the sheet links to that candidate's file. If the account that
deploys is not the account that reads the sheet, share that folder with the
reader.

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
