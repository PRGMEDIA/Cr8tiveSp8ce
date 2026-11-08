<?php
/**
 * db.php — Database connection, schema, and shared helpers.
 * Included by every page. Starts the session and enforces idle timeout.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/* ---------- Session bootstrap ---------- */
if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_start();
}

// Idle timeout: log the user out after SESSION_IDLE_TTL of inactivity
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > SESSION_IDLE_TTL) {
    session_unset();
    session_destroy();
    session_start();
}
$_SESSION['last_activity'] = time();

/** Regenerate the session ID on login/privilege change (session fixation defense). */
function session_refresh(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
}

/** Per-session CSRF token. */
function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_check(): void
{
    $posted = $_POST['csrf_token'] ?? '';
    if (!is_string($posted) || !hash_equals(csrf_token(), $posted)) {
        http_response_code(403);
        exit('Invalid or expired form token. Please go back and try again.');
    }
}

function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

/* ---------- Database ---------- */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    if (DB_DRIVER === 'sqlite') {
        $dir = dirname(DB_SQLITE_PATH);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $pdo = new PDO('sqlite:' . DB_SQLITE_PATH, null, null, $options);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
    } else {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }

    create_schema($pdo);
    return $pdo;
}

/** Creates the member data repository tables if they do not exist yet. */
function create_schema(PDO $pdo): void
{
    $auto = DB_DRIVER === 'mysql' ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';
    $pk   = DB_DRIVER === 'mysql' ? 'PRIMARY KEY' : 'PRIMARY KEY';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS members (
            id            INTEGER {$pk} {$auto},
            email         VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            first_name    VARCHAR(100) NOT NULL,
            last_name     VARCHAR(100) NOT NULL DEFAULT '',
            membership_level VARCHAR(50) NOT NULL DEFAULT 'Member',
            is_admin      INTEGER NOT NULL DEFAULT 0,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME NULL
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS login_log (
            id         INTEGER {$pk} {$auto},
            email      VARCHAR(190) NOT NULL,
            ip_address VARCHAR(45)  NOT NULL DEFAULT '',
            succeeded  INTEGER NOT NULL DEFAULT 0,
            attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // Helpful index for the admin repository search
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_members_email ON members (email)');
}

/* ---------- Auth helpers ---------- */
function current_member(): ?array
{
    if (empty($_SESSION['member_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM members WHERE id = :id AND is_active = 1');
    $stmt->execute([':id' => $_SESSION['member_id']]);
    $member = $stmt->fetch();
    return $member ?: null;
}

function require_login(): array
{
    $member = current_member();
    if (!$member) {
        header('Location: login.php');
        exit;
    }
    return $member;
}

function require_admin(): array
{
    $member = require_login();
    if (!$member['is_admin']) {
        http_response_code(403);
        exit('You do not have permission to view this page.');
    }
    return $member;
}

/** Records a login attempt and returns how many recent failures exist for this email+IP. */
function record_login_attempt(string $email, bool $succeeded): int
{
    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO login_log (email, ip_address, succeeded) VALUES (:email, :ip, :ok)');
    $stmt->execute([
        ':email' => mb_substr($email, 0, 190),
        ':ip'    => $_SERVER['REMOTE_ADDR'] ?? '',
        ':ok'    => $succeeded ? 1 : 0,
    ]);

    $count = $pdo->prepare("
        SELECT COUNT(*) FROM login_log
        WHERE email = :email AND succeeded = 0
          AND attempted_at > DATETIME('NOW', '-15 minutes')
    ");
    // MySQL lacks DATETIME('NOW', ...) — use a portable fallback for MySQL
    if (DB_DRIVER === 'mysql') {
        $count = $pdo->prepare('
            SELECT COUNT(*) FROM login_log
            WHERE email = :email AND succeeded = 0
              AND attempted_at > (NOW() - INTERVAL 15 MINUTE)
        ');
    }
    $count->execute([':email' => mb_substr($email, 0, 190)]);
    return (int)$count->fetchColumn();
}
