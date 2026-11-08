# Email Submittal Page — Setup Guide

A complaint/inquiry submission page for your website. Submissions are emailed from **info@prgduction.com** to **villa@villashurielle.com**.

> **Branch note:** this branch is the **legal complaint form** with Case Type (Pro Se / Pro Bono + legal matters). The manuscript-submission version lives on a separate branch.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The submission page (2,000-character text box + file attachment) |
| `send-mail.php` | Server script that validates and emails the submission |
| `README.md` | This guide |

## Features

- 📚 **Manuscript Type** dropdown — Fiction, Non-Fiction, Memoir / Biography, Poetry, Short Story Collection, Screenplay / Stage Play, Children's / Middle Grade, Young Adult, Academic / Educational, Devotional / Inspirational, Other (edit the `MANUSCRIPT_TYPES` list in `send-mail.php`; keep it in sync with the dropdown in `index.html`)
- ✍️ **Text box limited to 2,000 characters** with a live counter (turns orange near the limit, red at max)
- 📎 **File attachment** — PDF, DOC/DOCX, TXT, RTF, JPG, PNG, GIF up to 10 MB (click or drag & drop)
- 🔒 **Spam protection** — honeypot field + server-side validation
- 📧 **Reply-To** is set to the submitter's email, so you can reply directly
- 🎨 Styled, mobile-responsive page

## Setup (3 steps)

### 1. Shared mail config ✅ (already set)

SMTP credentials live in **`mail-config.php` at your site root** — shared by this form AND the Sanctuary Magazine membership system, so the password is entered in one place. It is already set up for `info@prgduction.com`. If the password ever changes, update `SMTP_PASS` there:

```php
const SMTP_HOST   = 'mail.prgduction.com'; // ask your hosting provider if unsure
const SMTP_PORT   = 587;                      // 587 (STARTTLS) or 465 (SSL)
const SMTP_SECURE = 'tls';                    // 'tls' for 587, 'ssl' for 465
const SMTP_PASS   = <mailbox password>;      // update if the mailbox password changes
```

Deploy it so the site root contains: `mail-config.php`, `email-submittal/`, and `sanctuary/` side by side. The script also looks next to itself as a fallback.

### 2. Install PHPMailer (recommended)

On your web server (in the same folder as `send-mail.php`):

```bash
composer require phpmailer/phpmailer
```

**No Composer?** Download PHPMailer from https://github.com/PHPMailer/PHPMailer, copy its `src/` folder next to `send-mail.php`. The script auto-detects either layout.

If neither is available, the script falls back to PHP's built-in `mail()` function automatically (works on most shared hosts, though attachments and deliverability are less reliable).

### 3. Upload and test

Upload the **whole `email-submittal` folder** plus `mail-config.php` to your web host (any host with PHP 7.4+). Visit the page, submit a test submission, and confirm it arrives at **villa@villashurielle.com**.

## Submissions repository (automatic archive)

Every received submission is archived in a **dedicated Git repository** at
`submissions/` (this folder, auto-initialized on first submission). Each submission
becomes a dated JSON record + readable Markdown record + a copy of any attachment,
committed automatically:

```
submissions/2026/11/2026-11-06_143012_jane-doe_a1b2.json
submissions/2026/11/2026-11-06_143012_jane-doe_a1b2.md
submissions/attachments/2026/11/2026-11-06_143012_jane-doe_a1b2_manuscript.pdf
```

The commit history of that repo **is** the log of submissions received. Settings
live at the top of `send-mail.php`:

- `SUBMISSIONS_GIT` — auto-commit each submission (default `true`)
- `SUBMISSIONS_PUSH` + `SUBMISSIONS_REMOTE` — mirror the archive to the remote
  (private repo) by setting the URL with a fine-grained token that has
  **Contents: read/write** on that repo:
  `https://TOKEN@github.com/prgmedia/submissions-repo-.git`
- `SUBMISSIONS_BRANCH` — default `main`
- `SUBMISSIONS_DIAGNOSTICS` — on any failure (email send, archive, git init/add/
  commit/fetch/rebase/push), the full diagnostic report is stored in the
  **Oracle DB** (table `DIAGNOSTIC_LOG` — see `oracle-config.php` at the site
  root). If Oracle is unreachable, the report falls back to a local JSON file
  in `submissions/diagnostics/` (kept out of git via `.gitignore`). A summary
  always goes to the server error log, so the root cause can be identified
  quickly.

### CI on the submissions repo

- **CodeQL** (`.github/workflows/codeql.yml`) runs only when **submission records
  change** — path-filtered to `20*/**` (record folders) and `attachments/**` — plus
  a weekly scheduled sweep. Workflow/doc commits do not trigger it.
- A fetch-first (non-fast-forward) rejection can no longer happen: the archive
  step fetches and rebases onto the latest remote `main` before every push, so
  submission commits stack cleanly on top of remote activity. Rebase is the safe
  alternative to a rejection; if a rebase ever conflicts, it aborts and the
  record stays safe locally with a diagnostic written.

A `.htaccess` file blocks direct web access to the archive on Apache hosts.
The remote repository is **private** — it contains submitter personal data and
manuscript attachments; never make it public.

> 🔐 Security rules for the wallet, tokens, and credential files are specified
> in [`docs/SECRET_WALLET_SECURITY_REQUIREMENTS.md`](../docs/SECRET_WALLET_SECURITY_REQUIREMENTS.md)
> (unique IDs `SW-*`, each with a verification method).

## Oracle DB failure records

Every failure creates a record in the **Oracle DB** (table `FAILURE_LOG`) tagged
with the person involved:

| Failure type | When |
|---|---|
| `FORM_VALIDATION` | Submitter submits the form with missing/invalid fields |
| `EMAIL_SEND` | The submission email could not be delivered |
| `FAILURE_GIT_*` / `FAILURE_SUBMISSIONS_ARCHIVE` | Archive/commit/push problems |
| `LOGIN_FAILED` / `LOGIN_THROTTLED` / `LOGIN_PENDING_APPROVAL` | Member sign-in problems |
| `DUPLICATE_EMAIL` | Registration with an existing email |
| `INSTALL_ERROR` | Membership installer database problems |

Each record stores: timestamp, source (manuscript-form / sanctuary-login / …),
failure type, **member name & email**, detail, IP, user agent, and a JSON extra
field (e.g. field-level errors, message length).

Setup — Always Free Autonomous DB on Oracle Cloud, **wallet (mTLS) mode**:

1. **Create the DB**: OCI console → Oracle Database → Autonomous Database →
   *Create Autonomous Database* → workload type **Transaction Processing (ATP)** →
   **Always Free** eligible → set the ADMIN password.
2. **Create a logger user** (Database Actions → SQL, as ADMIN):
   ```sql
   CREATE USER prg_logger IDENTIFIED BY "StrongPassword";
   GRANT CREATE SESSION, CREATE TABLE TO prg_logger;
   ALTER USER prg_logger QUOTA 100M ON DATA;
   ```
3. **Download the wallet**: DB Connection page → *Download wallet* →
   unzip it into **`oracle-wallet/`** at the site root (the folder is
   pre-created and web-blocked with `.htaccess`, and excluded from git).
4. **Configure `oracle-config.php`** at the site root:
   - `ORACLE_AUTH_MODE = 'wallet'` (default)
   - `ORACLE_TNS_ALIAS` — open `oracle-wallet/tnsnames.ora` and pick an alias,
     typically `<dbname>_low` (e.g. `myatpdb1_low`)
   - `ORACLE_USER` = `PRG_LOGGER`, `ORACLE_PASS` = its password
5. **Enable OCI8** on the web host (cPanel → PHP Extensions → `oci8`), or PDO_OCI.
6. **Run `oracle-test.php`** in the browser — it validates wallet files, alias,
   connection, table creation, and insert/read-back. Delete it afterwards.

Wallet handling is automatic: the module sets `TNS_ADMIN`, patches
`sqlnet.ora`'s `WALLET_LOCATION` to the real server path (Oracle ships the zip
with a placeholder), and web-blocks the folder. If your host runs nginx instead
of Apache, place the wallet **outside** the web root and set `ORACLE_WALLET_DIR`
accordingly.

The `FAILURE_LOG` and `DIAGNOSTIC_LOG` tables are created automatically on first use.

The module (`oracle-failure-log.php`) prefers the OCI8 PHP extension, falls back
to PDO_OCI, and — if Oracle is unreachable — queues records locally in
`oracle-failure-log.jsonl` and flushes them on the next successful connection,
so **no failure record is ever lost**.

## Optional: Save attachments on the server

Set `SAVE_UPLOADS = true` in `send-mail.php` and create a writable `uploads/` folder next to the script. Attachments will be saved there **and** emailed.

## Notes

- The form validates input on both the browser side (JavaScript) and server side (PHP) — always trust the PHP checks.
- The allowed Case Type values are listed in the `CASE_TYPES` constant in `send-mail.php` — if you edit the dropdown in `index.html`, update that list to match.
- If emails land in spam, confirm SPF/DKIM records are configured for **prgduction.com** with your DNS provider.
- Never commit your real mailbox password to a public repository.
