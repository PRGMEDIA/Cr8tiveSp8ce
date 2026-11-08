# Sanctuary Magazine — Membership Login & Member Data Repository

Member login system for **www.prgproduction.com/sanctuary/sanctuarymagazine**.

## Files

| File | Purpose |
|------|---------|
| `config.php` | All settings: database, admin account, session timeout |
| `../mail-config.php` | Shared SMTP settings (site root — used by both systems) |
| `db.php` | Database connection, schema, sessions, auth helpers |
| `layout.php` | Shared page styling/header/footer |
| `login.php` | Member login page (the main entry point) |
| `register.php` | New member self-registration |
| `dashboard.php` | Member-only area after login |
| `members.php` | **Member Data Repository** — admin search/manage page |
| `members-export.php` | CSV export of all member data (admins only) |
| `mailer.php` | Sends the automatic "membership approved" email |
| `install.php` | One-time installer (delete after use) |

## Member Data Repository (database)

The `members` table stores for each member:

- ID, email (unique), hashed password (bcrypt via `password_hash`)
- First name, last name
- Membership level (configurable in `config.php` — default: Reader / Student / Contributor / Patron)
- Admin flag, Active/Disabled flag
- Created date, last login date

A `login_log` table records every login attempt (email, IP, success, time) for
brute-force throttling and auditing.

Driver options in `config.php`:
- **`sqlite`** (default) — zero-config; data lives in `data/members.sqlite`
- **`mysql`** — create the database in your hosting panel first, then fill in `DB_USER` / `DB_PASS`

## Setup (4 steps)

1. **Upload the whole `sanctuarymagazine` folder** so it lives at
   `public_html/sanctuary/sanctuarymagazine/` → the login page is then at
   `www.prgproduction.com/sanctuary/sanctuarymagazine/login.php`.

2. **Edit `config.php`** — set the admin email/password, and (for MySQL) the
   database credentials. SMTP/mail settings are **shared** — they live in
   `mail-config.php` at your **site root** (one folder up from `sanctuary/`),
   shared with the manuscript submission form, so the mailbox password is set
   in exactly one place.

3. **Visit `install.php` once** in the browser
   (`.../sanctuarymagazine/install.php`). It creates the tables and the admin
   account. **Then delete `install.php` from the server.**

4. **Log in** at `.../sanctuarymagazine/login.php` with the admin account.
   The dashboard shows an "Open the Member Data Repository" link, where you can
   search members, change levels, disable/enable accounts, grant admin rights,
   and export everything to CSV.

## Security features

- Passwords hashed with bcrypt (`password_hash` / `password_verify`), auto-rehashed on algorithm upgrades
- Prepared statements everywhere (SQL injection safe)
- CSRF tokens on every form
- Session ID regeneration on login; 1-hour idle auto-logout
- Brute-force throttle: after 8 failed attempts for an email within 15 minutes, login is paused
- Login audit log with IP address
- Admin pages blocked for regular members; admins can't disable themselves

## Linking from the main site

Add a link anywhere on the magazine pages:

```html
<a href="/sanctuary/sanctuarymagazine/login.php">Member Login</a>
```

## Notes

- **Failure records in Oracle**: sign-in failures (`LOGIN_FAILED`,
  `LOGIN_THROTTLED`, `LOGIN_PENDING_APPROVAL`), registration failures
  (`FORM_VALIDATION`, `DUPLICATE_EMAIL`) and installer errors are recorded in
  the shared Oracle `FAILURE_LOG` table (see `oracle-config.php` at the site
  root). If Oracle is unreachable, records queue locally and flush on the next
  successful connection.
- **Registration requires administrator approval by default** (`REQUIRE_APPROVAL = true`
  in `config.php`). New accounts start Disabled and see "awaiting administrator
  approval" when they try to log in; approve them in the Member Data Repository
  with the Enable button — the member is **automatically emailed** that their
  membership was approved (branded welcome email with a login button, sent from
  `NOTIFY_FROM_EMAIL` in config). Set `REQUIRE_APPROVAL = false` for instant access.
- **Membership levels live in `config.php`** (`MEMBERSHIP_LEVELS`) — edit that one
  list and both registration and the repository update automatically.
- The login page links to the manuscript submission form, and the submission form
  links back to member login.
- The SQLite database file is inside the web-accessible folder. Prefer MySQL on
  production, or add a server rule to deny access to `/data/`.
