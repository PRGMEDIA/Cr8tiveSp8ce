<?php
/**
 * send-mail.php — Email Submittal Handler
 * ----------------------------------------
 * Receives the manuscript submission (POST) from index.html,
 * validates it, and emails it from info@prgduction.com
 * to villa@villashurielle.com — with an optional file attachment.
 *
 * REQUIRES: PHPMailer (recommended). Install with Composer:
 *   composer require phpmailer/phpmailer
 * ...or download manually from https://github.com/PHPMailer/PHPMailer
 * and place the src/ folder next to this file.
 *
 * UPLOADS: If you want attachments saved on the server in addition to
 * being emailed, create a folder named "uploads" next to this file and
 * make it writable (chmod 755 or 775). Otherwise leave $SAVE_UPLOADS = false.
 */

declare(strict_types=1);

/* ======================= CONFIGURATION ======================= */

/* SMTP + sender settings now live in the SHARED mail-config.php at your
 * site root (one place for the mailbox password across both systems).
 * Look for it next to this folder or one level up. */
foreach ([__DIR__ . '/../mail-config.php', __DIR__ . '/mail-config.php'] as $__mailConfig) {
    if (is_file($__mailConfig)) { require_once $__mailConfig; break; }
}
if (!defined('SMTP_HOST')) {
    header('Content-Type: application/json; charset=utf-8');
    fail(500, 'Server configuration error: shared mail-config.php not found. See README.');
}

/* Oracle failure records (shared module at site root; local copy as fallback) */
foreach ([__DIR__ . '/../oracle-failure-log.php', __DIR__ . '/oracle-failure-log.php'] as $__oracleLog) {
    if (is_file($__oracleLog)) { require_once $__oracleLog; break; }
}
if (!function_exists('log_failure_record')) {
    // Module missing — never let failure logging break the form
    function log_failure_record(array $f): void { error_log('oracle-failure-log.php missing; failure not recorded: ' . ($f['failure_type'] ?? '?')); }
}

const TO_EMAIL      = 'submission@prgduction.com';
const TO_NAME       = 'PRG Production Submissions';

const MAX_CHARS     = 2000;
const MAX_FILE_MB   = 10;
const ALLOWED_EXT   = ['pdf','doc','docx','txt','rtf','jpg','jpeg','png','gif'];
const SAVE_UPLOADS  = false; // true = also save attachments to ./uploads/
const UPLOAD_DIR    = __DIR__ . '/uploads';

/* ---------- Submissions repository ----------
 * A dedicated Git repo where every received submission is archived as a
 * dated record (JSON + markdown + attachment) and auto-committed — a
 * permanent, timestamped log of all submissions received.
 *   SUBMISSIONS_GIT   false = save files only, skip git commits
 *   SUBMISSIONS_PUSH  true  = push to SUBMISSIONS_REMOTE after each commit
 */
const SUBMISSIONS_DIR    = __DIR__ . '/submissions';
const SUBMISSIONS_GIT    = true;
const SUBMISSIONS_PUSH   = true;
const SUBMISSIONS_DIAGNOSTICS = true; // write a diagnostic report on any failure
/* The remote URL (with token) is NOT kept in this file — see SW-GIT-002 in
 * docs/SECRET_WALLET_SECURITY_REQUIREMENTS.md. Put the token URL in a
 * git-ignored file named .submissions-remote next to this script:
 *   https://<TOKEN>@github.com/prgmedia/submissions-repo-.git
 */
const SUBMISSIONS_REMOTE = '';
const SUBMISSIONS_BRANCH = 'main';

/** Resolves the submissions remote URL: constant first, then .submissions-remote file. */
function submissions_remote(): string
{
    static $url = null;
    if ($url !== null) {
        return $url;
    }
    if (SUBMISSIONS_REMOTE !== '') {
        $url = SUBMISSIONS_REMOTE;
        return $url;
    }
    $file = __DIR__ . '/.submissions-remote';
    if (is_file($file)) {
        $line = trim((string)file_get_contents($file));
        if ($line !== '' && str_starts_with($line, 'https://')) {
            $url = $line;
            return $url;
        }
        error_log('.submissions-remote present but is not a https URL — ignoring.');
    }
    $url = '';
    return $url;
}

/** Allowed Manuscript Type values — must match index.html exactly. */
const MANUSCRIPT_TYPES = [
    'Fiction',
    'Non-Fiction',
    'Memoir / Biography',
    'Poetry',
    'Short Story Collection',
    'Screenplay / Stage Play',
    "Children's / Middle Grade",
    'Young Adult',
    'Academic / Educational',
    'Devotional / Inspirational',
    'Other',
];

/* ============================================================= */

header('Content-Type: application/json; charset=utf-8');

// Only accept POST from the form
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Method not allowed.');
}

// ---- Honeypot: hidden field should stay empty (bot trap) ----
if (!empty($_POST['website_hp'])) {
    // Pretend success so bots move on
    echo json_encode(['ok' => true, 'message' => 'Thank you. Your submission was sent.']);
    exit;
}

// ---- Gather and validate input ----
$name     = trim($_POST['name'] ?? '');
$email    = trim($_POST['email'] ?? '');
$caseType = trim($_POST['case_type'] ?? '');
$subject  = trim($_POST['subject'] ?? '');
$message  = trim($_POST['message'] ?? '');

$errors = [];

if ($name === '' || mb_strlen($name) > 100)        { $errors[] = 'Please provide your name.'; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 150) { $errors[] = 'Please provide a valid email address.'; }
if (!in_array($caseType, MANUSCRIPT_TYPES, true))  { $errors[] = 'Please select a manuscript type.'; }
if ($subject === '' || mb_strlen($subject) > 150)  { $errors[] = 'Please provide a subject.'; }
if (mb_strlen($message) < 10)                      { $errors[] = 'Please describe your manuscript.'; }
if (mb_strlen($message) > MAX_CHARS)               { $errors[] = 'Message exceeds ' . MAX_CHARS . ' characters.'; }

if ($errors) {
    // Record the form failure for this "member" (submitter) in the Oracle DB
    log_failure_record([
        'source'       => 'manuscript-form',
        'failure_type' => 'FORM_VALIDATION',
        'member_name'  => $name,
        'member_email' => $email,
        'detail'       => implode(' ', $errors),
        'extra'        => [
            'case_type'      => $caseType,
            'subject'        => $subject,
            'message_length' => mb_strlen($message),
            'attachment'     => isset($_FILES['attachment']['name']) ? basename($_FILES['attachment']['name']) : null,
            'field_errors'   => $errors,
        ],
    ]);
    fail(422, implode(' ', $errors));
}

// ---- Validate the attachment (optional) ----
$attachmentPath = null;
$attachmentName = null;

if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES['attachment'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        fail(422, 'There was a problem with the uploaded file. Please try again.');
    }
    if ($file['size'] > MAX_FILE_MB * 1024 * 1024) {
        fail(422, 'The attached file exceeds the ' . MAX_FILE_MB . ' MB limit.');
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_EXT, true)) {
        fail(422, 'That file type is not allowed. Allowed: ' . implode(', ', ALLOWED_EXT));
    }

    // Extra safety: verify it really is an image when it claims to be one
    if (in_array($ext, ['jpg','jpeg','png','gif'], true)) {
        $info = @getimagesize($file['tmp_name']);
        if ($info === false) {
            fail(422, 'The attached image appears to be invalid.');
        }
    }

    if (SAVE_UPLOADS) {
        if (!is_dir(UPLOAD_DIR)) { mkdir(UPLOAD_DIR, 0755, true); }
        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($file['name']));
        $attachmentPath = UPLOAD_DIR . '/' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $attachmentPath)) {
            $attachmentPath = null; // still email without the saved copy if move fails
        } else {
            $attachmentName = basename($file['name']);
        }
    } else {
        $attachmentPath = $file['tmp_name']; // send directly from the temp file
        $attachmentName = basename($file['name']);
    }
}

// ---- Send the email ----
$mailSent = send_mail($name, $email, $caseType, $subject, $message, $attachmentPath, $attachmentName);

if ($mailSent !== true) {
    // Email delivery failed — capture a diagnostic report to identify the failure
    run_diagnostics('email-send', is_string($mailSent) ? $mailSent : 'unknown error');
    error_log('Mail send failed: ' . (is_string($mailSent) ? $mailSent : 'unknown error'));
    fail(500, 'We could not send your message right now. Please try again later or email us directly at ' . TO_EMAIL . '.');
}

// Archive the submission in the dedicated Git repository
$archive = save_to_submissions_repo($name, $email, $caseType, $subject, $message, $attachmentPath, $attachmentName);
if ($archive !== true) {
    run_diagnostics('submissions-archive', $archive);
}

echo json_encode([
    'ok'      => true,
    'message' => 'Your submission was sent successfully. We will respond to your email shortly.',
]);

/* ======================= FUNCTIONS ======================= */

/**
 * Sends the manuscript email via SMTP using PHPMailer.
 * Returns true on success, or an error string on failure.
 */
function send_mail(string $name, string $email, string $caseType, string $subject, string $message, ?string $attachPath, ?string $attachName): bool|string
{
    // Try Composer autoload first, then a manual src/ folder
    $phpmailerLoaded = false;
    if (file_exists(__DIR__ . '/vendor/autoload.php')) {
        require_once __DIR__ . '/vendor/autoload.php';
        $phpmailerLoaded = class_exists('PHPMailer\\PHPMailer\\PHPMailer');
    }
    if (!$phpmailerLoaded && file_exists(__DIR__ . '/src/PHPMailer.php')) {
        require_once __DIR__ . '/src/PHPMailer.php';
        require_once __DIR__ . '/src/SMTP.php';
        require_once __DIR__ . '/src/Exception.php';
        $phpmailerLoaded = true;
    }

    if ($phpmailerLoaded) {
        return send_with_phpmailer($name, $email, $caseType, $subject, $message, $attachPath, $attachName);
    }

    // Fallback: native mail() (works on most shared hosts, less reliable for attachments)
    return send_with_mail_function($name, $email, $caseType, $subject, $message, $attachPath, $attachName);
}

function send_with_phpmailer(string $name, string $email, string $caseType, string $subject, string $message, ?string $attachPath, ?string $attachName): bool|string
{
    $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);

    try {
        $mailer->isSMTP();
        $mailer->Host       = SMTP_HOST;
        $mailer->Port       = SMTP_PORT;
        $mailer->SMTPAuth   = true;
        $mailer->Username   = SMTP_USER;
        $mailer->Password   = SMTP_PASS;
        $mailer->SMTPSecure = SMTP_SECURE;
        $mailer->CharSet    = 'UTF-8';

        $mailer->setFrom(FROM_EMAIL, FROM_NAME);
        $mailer->addAddress(TO_EMAIL, TO_NAME);
        // Reply-To goes to the person who submitted, so you can just hit Reply
        $mailer->addReplyTo($email, $name);

        $mailer->Subject = $subject;
        $mailer->isHTML(true);
        $mailer->Body = build_html_body($name, $email, $caseType, $subject, $message, $attachName);
        $mailer->AltBody = build_plain_body($name, $email, $caseType, $subject, $message, $attachName);

        if ($attachPath && is_readable($attachPath)) {
            $mailer->addAttachment($attachPath, $attachName ?? 'attachment');
        }

        $mailer->send();
        return true;
    } catch (\PHPMailer\PHPMailer\Exception $e) {
        return $e->getMessage();
    } catch (\Throwable $e) {
        return $e->getMessage();
    }
}

/**
 * Fallback sender using PHP's native mail() with a manually built
 * multipart/mixed message (needed when attaching a file).
 */
function send_with_mail_function(string $name, string $email, string $caseType, string $subject, string $message, ?string $attachPath, ?string $attachName): bool|string
{
    $from     = FROM_NAME . ' <' . FROM_EMAIL . '>';
    $replyTo  = $name . ' <' . $email . '>';
    $boundary = 'bnd_' . bin2hex(random_bytes(16));
    $safeName = $attachName ?? 'attachment';
    $safeName = str_replace(["\r", "\n", '"'], '', $safeName);

    $headers  = "From: $from\r\n";
    $headers .= "Reply-To: $replyTo\r\n";
    $headers .= "MIME-Version: 1.0\r\n";

    $body = "--$boundary\r\n"
          . "Content-Type: text/plain; charset=UTF-8\r\n"
          . "Content-Transfer-Encoding: 8bit\r\n\r\n"
          . build_plain_body($name, $email, $caseType, $subject, $message, $attachName)
          . "\r\n";

    if ($attachPath && is_readable($attachPath)) {
        $content = chunk_split(base64_encode((string)file_get_contents($attachPath)));
        $body .= "--$boundary\r\n"
              . "Content-Type: application/octet-stream; name=\"$safeName\"\r\n"
              . "Content-Transfer-Encoding: base64\r\n"
              . "Content-Disposition: attachment; filename=\"$safeName\"\r\n\r\n"
              . $content . "\r\n";
    }

    $body .= "--$boundary--";

    if ($attachPath) {
        $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
    } else {
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $body = build_plain_body($name, $email, $caseType, $subject, $message, null);
    }

    $fullSubject = '[Manuscript Submission] ' . $subject;
    $encodedSubject = '=?UTF-8?B?' . base64_encode($fullSubject) . '?=';

    $ok = @mail(TO_EMAIL, $encodedSubject, $body, $headers);
    return $ok ? true : 'mail() returned false — check server mail configuration.';
}

/**
 * Archives a received submission in the dedicated Git repository.
 * Each submission becomes two files (JSON record + readable markdown)
 * plus its attachment, in one auto-generated commit:
 *
 *   submissions/
 *     2026/11/2026-11-06_143012_jane-doe_a1b2.json
 *     2026/11/2026-11-06_143012_jane-doe_a1b2.md
 *     attachments/2026/11/2026-11-06_143012_jane-doe_a1b2_manuscript.pdf
 *
 * Returns true on success (or when archiving is skipped), error string otherwise.
 */
function save_to_submissions_repo(string $name, string $email, string $caseType, string $subject, string $message, ?string $attachPath, ?string $attachName): bool|string
{
    if (!is_dir(SUBMISSIONS_DIR) && !mkdir(SUBMISSIONS_DIR, 0755, true) && !is_dir(SUBMISSIONS_DIR)) {
        return 'Could not create submissions directory.';
    }

    $stamp  = date('Y-m-d_His');
    $slug   = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $name)) ?? 'submitter';
    $slug   = trim($slug, '-') ?: 'submitter';
    $key    = $stamp . '_' . $slug . '_' . bin2hex(random_bytes(2));
    $subDir = SUBMISSIONS_DIR . '/' . date('Y') . '/' . date('m');

    if (!is_dir($subDir) && !mkdir($subDir, 0755, true) && !is_dir($subDir)) {
        return 'Could not create submission month folder.';
    }

    $record = [
        'id'               => $key,
        'received_at'      => date('c'),
        'name'             => $name,
        'email'            => $email,
        'manuscript_type'  => $caseType,
        'subject'          => $subject,
        'details'          => $message,
        'attachment'       => $attachName ?: null,
        'ip_address'       => $_SERVER['REMOTE_ADDR'] ?? null,
        'email_sent'       => true,
    ];

    $json = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents("$subDir/$key.json", $json) === false) {
        return 'Could not write submission JSON record.';
    }

    $markdown = '# Manuscript Submission — ' . $subject . "\n\n"
        . '- **Received:** ' . date('Y-m-d H:i:s T') . "\n"
        . '- **Name:** ' . $name . "\n"
        . '- **Email:** ' . $email . "\n"
        . '- **Manuscript Type:** ' . $caseType . "\n"
        . '- **Attachment:** ' . ($attachName ?: 'None') . "\n\n"
        . '## Manuscript Details' . "\n\n"
        . $message . "\n";
    if (file_put_contents("$subDir/$key.md", $markdown) === false) {
        return 'Could not write submission markdown record.';
    }

    if ($attachPath && is_readable($attachPath)) {
        $attDir = SUBMISSIONS_DIR . '/attachments/' . date('Y') . '/' . date('m');
        if (!is_dir($attDir) && !mkdir($attDir, 0755, true) && !is_dir($attDir)) {
            return 'Could not create attachments folder.';
        }
        $safeAttach = preg_replace('/[^A-Za-z0-9._-]/', '_', (string)$attachName) ?: 'attachment';
        if (!@copy($attachPath, $attDir . '/' . $key . '_' . $safeAttach)) {
            return 'Submission archived, but the attachment could not be copied.';
        }
    }

    if (!SUBMISSIONS_GIT) {
        return true; // files saved; git archiving disabled
    }

    return commit_to_submissions_repo("Manuscript submission: {$subject} — {$name}");
}

/**
 * On any detected failure, writes a diagnostic report (JSON) into
 * submissions/diagnostics/ and mirrors a summary to the server error log,
 * so the root cause of a failed send/archive/push can be identified quickly.
 */
function run_diagnostics(string $context, string $detail, array $extra = []): void
{
    error_log("Diagnostics ({$context}): {$detail}");

    // Every diagnostic is also a failure record in the Oracle DB
    log_failure_record([
        'source'       => 'manuscript-form',
        'failure_type' => 'FAILURE_' . strtoupper(preg_replace('/[^A-Za-z0-9]/', '_', $context)),
        'detail'       => $detail,
        'extra'        => $extra,
    ]);

    if (!SUBMISSIONS_DIAGNOSTICS) {
        return;
    }

    $dir = SUBMISSIONS_DIR . '/diagnostics';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        error_log("Diagnostics could not create {$dir} — original issue: {$detail}");
        return;
    }

    // Never write the remote token into a diagnostic file
    $remoteUrl = submissions_remote();
    $safeRemote = $remoteUrl !== ''
        ? preg_replace('/\/\/[^@]*@/', '//***TOKEN***@', $remoteUrl)
        : '(not set)';

    $diag = [
        'timestamp'       => date('c'),
        'context'         => $context,
        'detail'          => $detail,
        'php_version'     => PHP_VERSION,
        'exec_enabled'    => function_exists('exec'),
        'git_version'     => null,
        'git_status'      => null,
        'recent_commits'  => null,
        'remote_url'      => $safeRemote,
        'branch'          => SUBMISSIONS_BRANCH,
        'submissions_dir' => [
            'path'     => SUBMISSIONS_DIR,
            'exists'   => is_dir(SUBMISSIONS_DIR),
            'writable' => is_dir(SUBMISSIONS_DIR) ? is_writable(SUBMISSIONS_DIR) : false,
        ],
        'disk_free_bytes' => @disk_free_space(SUBMISSIONS_DIR),
        'extra'           => $extra,
    ];

    if (function_exists('exec') && is_dir(SUBMISSIONS_DIR)) {
        $dir = escapeshellarg(SUBMISSIONS_DIR);
        exec("git -C $dir version 2>&1", $gv, $gc);
        $diag['git_version'] = $gc === 0 ? implode(' ', $gv) : 'git unavailable / failed';

        exec("git -C $dir status --porcelain=v1 -b 2>&1", $st, $sc);
        $diag['git_status'] = $sc === 0 ? $st : ['status failed: ' . implode(' ', $st)];

        exec("git -C $dir log --oneline -5 2>&1", $lg, $lc);
        $diag['recent_commits'] = $lc === 0 ? $lg : ['log failed: ' . implode(' ', $lg)];
    }

    // Primary storage: the full diagnostic report goes into the Oracle DB
    $storedInOracle = function_exists('log_diagnostic_report')
        ? log_diagnostic_report($context, $detail, $diag)
        : false;

    // Fallback: local JSON file only when Oracle could not store the report
    if (!$storedInOracle) {
        $file = $dir . '/diag-' . date('Ymd_His') . '-' . bin2hex(random_bytes(2)) . '.json';
        file_put_contents($file, json_encode($diag, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        error_log("Diagnostic stored locally (Oracle unavailable): $file");
    }
}

/** Git add + commit (+ optional push) inside the submissions repository. */
function commit_to_submissions_repo(string $commitMsg): bool|string
{
    if (!function_exists('exec')) {
        run_diagnostics('git-unavailable', 'exec() is disabled on this host — files saved but not committed.');
        return 'exec() is disabled on this host — files saved but not committed.';
    }

    $dir = escapeshellarg(SUBMISSIONS_DIR);

    // Initialise the repo on first use (main branch)
    if (!is_dir(SUBMISSIONS_DIR . '/.git')) {
        exec("git -C $dir init 2>&1", $o, $c);
        if ($c !== 0) {
            run_diagnostics('git-init', implode(' ', $o));
            return 'git init failed: ' . implode(' ', $o);
        }
        exec("git -C $dir checkout -b " . escapeshellarg(SUBMISSIONS_BRANCH) . " 2>&1", $o, $c);
    }

    // Point origin at the dedicated submissions remote (once)
    if (submissions_remote() !== '') {
        exec("git -C $dir remote get-url origin 2>&1", $o, $c);
        if ($c !== 0) {
            exec('git -C ' . $dir . ' remote add origin ' . escapeshellarg(submissions_remote()) . ' 2>&1', $o, $c);
        }
    }

    exec("git -C $dir add -A 2>&1", $o, $c);
    if ($c !== 0) {
        run_diagnostics('git-add', implode(' ', $o));
        return 'git add failed: ' . implode(' ', $o);
    }

    exec("git -C $dir -c user.name='Submissions Bot' -c user.email='submissions@prgduction.com' commit -m " . escapeshellarg($commitMsg) . ' 2>&1', $o, $c);
    if ($c !== 0) {
        // "nothing to commit" means the record already existed — not an error
        if (stripos(implode(' ', $o), 'nothing to commit') !== false) return true;
        run_diagnostics('git-commit', implode(' ', $o));
        return 'git commit failed: ' . implode(' ', $o);
    }

    if (SUBMISSIONS_PUSH && submissions_remote() !== '') {
        // The remote can gain commits between submissions (e.g. CodeQL analysis
        // or CI workflows committing to the branch) — rebase before pushing so
        // the auto-push never fails on a non-fast-forward.
        exec("git -C $dir fetch origin 2>&1", $o, $c);
        if ($c !== 0) {
            run_diagnostics('git-fetch', implode(' ', $o));
            return 'Committed locally, but git fetch failed: ' . implode(' ', $o);
        }
        // Rebase is the safe alternative to a fetch-first rejection:
        // the submission commit stacks cleanly on top of remote activity
        // (CodeQL analysis, CI commits) instead of the push being rejected.
        exec("git -C $dir rebase origin/" . escapeshellarg(SUBMISSIONS_BRANCH) . ' 2>&1', $o, $c);
        if ($c !== 0) {
            exec("git -C $dir rebase --abort 2>&1");
            run_diagnostics('git-rebase', implode(' ', $o));
            return 'Committed locally, but could not integrate remote updates (rebase failed). The submission record is safe in the local repo.';
        }
        exec("git -C $dir push -u origin " . escapeshellarg(SUBMISSIONS_BRANCH) . ' 2>&1', $o, $c);
        if ($c !== 0) {
            run_diagnostics('git-push', implode(' ', $o));
            return 'Committed locally, but git push failed: ' . implode(' ', $o);
        }
    }

    return true;
}

function build_plain_body(string $name, string $email, string $caseType, string $subject, string $message, ?string $attachName): string
{
    $lines = [
        'NEW MANUSCRIPT SUBMISSION',
        str_repeat('=', 40),
        'Name:     ' . $name,
        'Email:    ' . $email,
        'Type:     ' . $caseType,
        'Subject:  ' . $subject,
        'Date:     ' . date('Y-m-d H:i:s T'),
        'IP:       ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'Attachment: ' . ($attachName ?: 'None'),
        str_repeat('-', 40),
        'MANUSCRIPT DETAILS:',
        '',
        $message,
        str_repeat('=', 40),
        'Sent from the Villashurielle website manuscript submission form.',
    ];
    return implode("\r\n", $lines);
}

function build_html_body(string $name, string $email, string $caseType, string $subject, string $message, ?string $attachName): string
{
    $esc = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    $msgHtml = nl2br($esc($message));

    return <<<HTML
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#1f2430;margin:0;padding:0;background:#f5f2ee;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border:1px solid #e5e1da;border-radius:10px;overflow:hidden;">
    <div style="background:#7c3aed;color:#ffffff;padding:16px 24px;">
      <h2 style="margin:0;font-size:18px;">New Manuscript Submission</h2>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:110px;">Name</td><td style="padding:6px 0;"><strong>{$esc($name)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;"><a href="mailto:{$esc($email)}">{$esc($email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Manuscript Type</td><td style="padding:6px 0;"><strong>{$esc($caseType)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Subject</td><td style="padding:6px 0;">{$esc($subject)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;">{$esc(date('Y-m-d H:i:s T'))}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Attachment</td><td style="padding:6px 0;">{$esc($attachName ?: 'None')}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e1da;margin:16px 0;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 6px;"><strong>MANUSCRIPT DETAILS:</strong></p>
      <div style="font-size:14px;line-height:1.6;background:#fafaf8;border:1px solid #e5e1da;border-radius:8px;padding:16px;">
        $msgHtml
      </div>
    </div>
  </div>
</body>
</html>
HTML;
}

/** Sends a JSON error response and stops. */
function fail(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => $message]);
    exit;
}
