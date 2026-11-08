<?php
/**
 * config.php — Sanctuary Magazine Membership Settings
 * ---------------------------------------------------
 * Edit the values below before going live.
 * SMTP/mail credentials live in the SHARED mail-config.php at your site root.
 */

declare(strict_types=1);

/* ---------- Shared email settings ----------
 * SMTP credentials and notification senders live in the SHARED
 * mail-config.php at your site root (one password for both systems).
 */
foreach ([__DIR__ . '/../../mail-config.php', __DIR__ . '/../mail-config.php', __DIR__ . '/mail-config.php'] as $__mailConfig) {
    if (is_file($__mailConfig)) { require_once $__mailConfig; break; }
}
if (!defined('CONTACT_EMAIL')) {
    // Safe fallbacks if the shared file is missing — upload mail-config.php to the site root.
    const CONTACT_EMAIL      = 'info@villashurielle.com';
    const NOTIFY_FROM_EMAIL  = 'info@prgproduction.com';
    const NOTIFY_FROM_NAME   = 'Sanctuary Magazine';
}

/* ---------- Oracle failure records (shared module at site root) ---------- */
foreach ([__DIR__ . '/../../oracle-failure-log.php', __DIR__ . '/../oracle-failure-log.php', __DIR__ . '/oracle-failure-log.php'] as $__oracleLog) {
    if (is_file($__oracleLog)) { require_once $__oracleLog; break; }
}
if (!function_exists('log_failure_record')) {
    function log_failure_record(array $f): void { error_log('oracle-failure-log.php missing; failure not recorded: ' . ($f['failure_type'] ?? '?')); }
}

/* ---------- Site ---------- */
const SITE_NAME    = 'Sanctuary Magazine';
const ORG_NAME     = 'PRG Production';

/* ---------- Database ----------
 * Choose one driver:
 *   'mysql'  — most web hosts (cPanel) — create the database first in your
 *              hosting panel, then fill in the credentials below.
 *   'sqlite' — zero-config; stores everything in data/members.sqlite.
 */
const DB_DRIVER    = 'sqlite';

const DB_HOST      = 'localhost';
const DB_NAME      = 'sanctuary_members';
const DB_USER      = 'CHANGE_ME_DB_USER';
const DB_PASS      = 'CHANGE_ME_DB_PASS';
const DB_SQLITE_PATH = __DIR__ . '/data/members.sqlite';

/* ---------- Membership levels ----------
 * Used by register.php and the Member Data Repository. Edit this list and
 * both pages update automatically.
 */
const MEMBERSHIP_LEVELS = ['Reader', 'Student', 'Contributor', 'Patron'];

/* ---------- Registration approval ----------
 * true  = new registrations start Disabled and must be approved by an
 *         administrator in the Member Data Repository (members.php).
 * false = new members can log in immediately.
 */
const REQUIRE_APPROVAL = true;

/* ---------- Initial administrator (used by install.php) ----------
 * install.php creates this account on first run. Change the password
 * immediately after installing, then delete install.php from the server.
 */
const ADMIN_EMAIL    = 'info@prgproduction.com';
const ADMIN_NAME     = 'Site Administrator';
const ADMIN_PASSWORD = 'CHANGE_ME_ADMIN_PASSWORD';

/* ---------- Notification emails ----------
 * Sender identity comes from the shared mail-config.php.
 * The approval email links to the member portal below.
 */
const MEMBER_PORTAL_URL = 'https://www.prgproduction.com/sanctuary/sanctuarymagazine/login.php';

/* ---------- Session security ---------- */
const SESSION_NAME     = 'SANCTUARYSESS';
const SESSION_IDLE_TTL = 3600; // seconds of inactivity before auto-logout (1 hour)
