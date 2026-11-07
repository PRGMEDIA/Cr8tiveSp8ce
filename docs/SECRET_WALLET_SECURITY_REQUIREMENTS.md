# Secret & Wallet Security Requirements

**Applies to:** Oracle Cloud mTLS wallet (`oracle-wallet/`), shared credential files
(`mail-config.php`, `oracle-config.php`, `oracle-failure-log.php`), GitHub tokens
embedded in `send-mail.php`, and the submissions repository (`SUBMISSIONS-REPO-`).

**Scope:** all environments (developer workstation, web server, GitHub).

**ID scheme:** `SW-<area>-<nnn>` — each requirement is unique and independently
verifiable.

---

## 1. Storage & location

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-STO-001 | The Oracle wallet SHALL be stored in a dedicated directory (`oracle-wallet/`) containing nothing but wallet files and protection files (`.htaccess`, `.gitignore`). | Directory listing |
| SW-STO-002 | The wallet directory SHALL NOT be web-accessible: an `.htaccess` with `Require all denied` SHALL exist in it on Apache hosts. On nginx hosts the wallet SHALL be placed outside the web root instead. | HTTP request to `/oracle-wallet/cwallet.sso` returns 403/404 |
| SW-STO-003 | The system SHALL automatically (re)write the wallet `.htaccess` on every connection attempt if it is missing. | Delete file, reload page, file reappears |
| SW-STO-004 | The module SHALL patch `sqlnet.ora`'s `WALLET_LOCATION` to the real server path at connection time and SHALL NOT require manual path edits. | `oracle-test.php` passes without manual sqlnet.ora edits |
| SW-STO-005 | Shared config files containing secrets (`mail-config.php`, `oracle-config.php`) SHALL be PHP files (executable server-side, zero-byte response over HTTP) and SHALL NOT contain secrets in comments that could be exposed by misconfiguration. | `curl https://…/mail-config.php` returns empty body |

## 2. Git & version control

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-GIT-001 | The wallet directory SHALL contain an ignore-all `.gitignore` (ignore `*`, allow only `.gitignore` and `.htaccess`) so certificates can never be committed. | `git check-ignore oracle-wallet/cwallet.sso` returns the file |
| SW-GIT-002 | No file containing a plaintext secret (wallet files, tokens, mailbox/DB passwords) SHALL be committed to any repository, public or private. | `git log -p` / GitHub secret scanning shows no matches |
| SW-GIT-003 | A pre-commit check SHALL be used on any repo that could receive the wallet or configs, blocking commits of `cwallet.sso`, `ewallet.pem`, `keystore.jks`, `oracle-failure-log.jsonl`, and config files containing `SMTP_PASS`/`ORACLE_PASS` with non-placeholder values. | Attempt a test commit; it is rejected |
| SW-GIT-004 | If the wallet or a token is ever found in a commit history, the credential SHALL be treated as compromised and rotated immediately (see SW-ROT-001/002) regardless of repository visibility. | Incident log |
| SW-GIT-005 | The submissions archive repository (`SUBMISSIONS-REPO-`) SHALL remain **private**; its visibility SHALL be re-verified after any repository settings change. | GitHub repo settings → `private: true` |

## 3. Credential scoping & least privilege

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-SCP-001 | The GitHub token used for auto-push SHALL be a fine-grained PAT scoped to **only** `SUBMISSIONS-REPO-` with **Contents: read/write** and no other permissions. | Token details page on GitHub |
| SW-SCP-002 | A second, separate token with **Issues: write** SHALL be used if/when failure records are filed as issues — the push token SHALL NOT gain issue permissions. | Two distinct tokens exist |
| SW-SCP-003 | The Oracle DB user (`prg_logger`) SHALL hold only `CREATE SESSION` and `CREATE TABLE` plus quota on its own schema — never ADMIN. | `SELECT * FROM user_sys_privs` as prg_logger |
| SW-SCP-004 | The SMTP mailbox credential SHALL be dedicated to automated sending and SHALL NOT be a personal account password. | Account audit |
| SW-SCP-005 | Diagnostic reports SHALL redact the remote URL token before writing to any store (Oracle `DIAGNOSTIC_LOG`, local files, error log). | Inspect stored reports for `***TOKEN***` |

## 4. Transport & lifecycle

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-TRN-001 | The wallet ZIP SHALL be downloaded only over HTTPS from the OCI console and SHALL be deleted from the workstation and any email/downloads folder after unzipping to the server. | No wallet copies remain outside server + OCI |
| SW-TRN-002 | The wallet SHALL NOT be transmitted by email, chat, or ticket attachments. | — |
| SW-TRN-003 | Upload of wallet/config files to the server SHALL use SFTP/SSH, not plain FTP. | Deployment procedure |
| SW-TRN-004 | `oracle-test.php` and `install.php` SHALL be deleted from the server immediately after successful use. | File absent from web root |

## 5. Rotation

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-ROT-001 | The GitHub auto-push token SHALL be rotated at least every **90 days**, or immediately if exposed in any transcript, log, or screen share. | Token created-date ≤ 90 days |
| SW-ROT-002 | If the wallet is exposed, a new wallet SHALL be downloaded from OCI and replaced on the server within 24 hours; the old wallet files SHALL be deleted, not archived. | Wallet file dates |
| SW-ROT-003 | The ADMIN password and logger password of the Autonomous DB SHALL be rotated at least annually and on any suspected exposure. | Change history |
| SW-ROT-004 | After any rotation, `oracle-test.php` SHALL be re-run once to confirm the system reconnects, then deleted again. | Test output 🎉 |

## 6. Monitoring & failure handling

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-MON-001 | Every send/archive/push failure SHALL produce a diagnostic record (Oracle `DIAGNOSTIC_LOG`, local JSON fallback) — never a silent failure. | Force a failure in staging; record appears |
| SW-MON-002 | Diagnostic reports SHALL be reviewed after any failure before re-running, and the root cause SHALL be recorded. | Review notes |
| SW-MON-003 | The local fallback queue (`oracle-failure-log.jsonl`) SHALL be treated as transient: a non-empty queue older than 7 days SHALL be investigated as an Oracle connectivity outage. | File age check |

## 7. Incident response

| ID | Requirement | Verification |
|----|-------------|--------------|
| SW-INC-001 | Suspected exposure of the wallet SHALL trigger: rotate wallet (SW-ROT-002) → rotate DB password (SW-ROT-003) → review OCI audit log for unexpected connections. | Incident record |
| SW-INC-002 | Suspected exposure of the GitHub token SHALL trigger: revoke token → issue scoped replacement (SW-SCP-001) → update `SUBMISSIONS_REMOTE` in `send-mail.php` on the server → run a test submission. | Push succeeds after rotation |
| SW-INC-003 | Suspected exposure of the SMTP password SHALL trigger: change the mailbox password → update `SMTP_PASS` in the shared `mail-config.php` → send a test submission. | Test email arrives |

---

**Minimum set if you only do five things:** SW-GIT-001, SW-STO-002, SW-SCP-001,
SW-TRN-004, SW-ROT-001.
