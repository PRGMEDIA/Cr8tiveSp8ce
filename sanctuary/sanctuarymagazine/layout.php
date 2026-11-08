<?php
/**
 * layout.php — Shared HTML header/footer for all Sanctuary Magazine pages.
 */

require_once __DIR__ . '/db.php';

function page_header(string $title, bool $showLogout = false): void
{
    $site = SITE_NAME;
    $logoutLink = $showLogout
        ? '<a class="toplink" href="logout.php">Log Out</a>'
        : '<a class="toplink" href="login.php">Member Login</a>';

    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$title} — {$site}</title>
<style>
  :root {
    --bg: #f5f2ee;
    --card: #ffffff;
    --ink: #1f2430;
    --muted: #6b7280;
    --accent: #7c3aed;
    --accent-dark: #5b21b6;
    --ok: #15803d;
    --err: #b91c1c;
    --border: #e5e1da;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    background: var(--bg);
    color: var(--ink);
    min-height: 100vh;
    padding: 24px 16px;
  }
  .wrap { max-width: 960px; margin: 0 auto; }
  .card {
    background: var(--card);
    width: 100%;
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0,0,0,.08);
    padding: 32px;
    border: 1px solid var(--border);
  }
  .card.narrow { max-width: 460px; margin: 4vh auto 0; }
  .brand { text-align: center; margin-bottom: 20px; }
  .brand h1 { font-size: 1.5rem; }
  .brand p { color: var(--muted); font-size: .9rem; margin-top: 4px; }
  label { display: block; font-weight: 600; font-size: .9rem; margin: 14px 0 6px; }
  input[type="text"], input[type="email"], input[type="password"], select {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    background: #fafaf8;
  }
  input:focus, select:focus { outline: none; border-color: var(--accent); }
  .btn {
    display: block; width: 100%; margin-top: 20px;
    padding: 13px; background: var(--accent); color: #fff;
    font-size: 1rem; font-weight: 600; border: none;
    border-radius: 8px; cursor: pointer;
  }
  .btn:hover { background: var(--accent-dark); }
  .btn.secondary { background: #ede9fe; color: var(--accent-dark); }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: .92rem; }
  .msg.ok  { background: #ecfdf5; color: var(--ok); border: 1px solid #bbf7d0; }
  .msg.err { background: #fef2f2; color: var(--err); border: 1px solid #fecaca; }
  .footnote { text-align: center; margin-top: 18px; font-size: .88rem; color: var(--muted); }
  .footnote a { color: var(--accent-dark); }
  table.repo { width: 100%; border-collapse: collapse; font-size: .88rem; margin-top: 16px; }
  table.repo th, table.repo td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); }
  table.repo th { background: #f3effc; color: var(--accent-dark); white-space: nowrap; }
  table.repo tr:hover td { background: #fafaf8; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: .75rem; font-weight: 600; }
  .badge.admin  { background: #ede9fe; color: var(--accent-dark); }
  .badge.member { background: #ecfdf5; color: var(--ok); }
  .badge.off    { background: #fef2f2; color: var(--err); }
  .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  .toolbar input { max-width: 280px; }
  .toolbar .btn { margin: 0; width: auto; padding: 10px 18px; }
  .toplink { color: var(--accent-dark); text-decoration: none; font-weight: 600; font-size: .9rem; }
  .toplink:hover { text-decoration: underline; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  @media (max-width: 640px) { .card { padding: 22px 16px; } .card.narrow { margin-top: 2vh; } }
</style>
</head>
<body>
<div class="wrap">
HTML;
}

function page_footer(): void
{
    $org  = ORG_NAME;
    $mail = CONTACT_EMAIL;
    echo <<<HTML
  <p class="footnote">{$org} · Questions? <a href="mailto:{$mail}">{$mail}</a></p>
</div>
</body>
</html>
HTML;
}

function flash_msg(): string
{
    if (!empty($_SESSION['flash'])) {
        [$type, $text] = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return '<div class="msg ' . e($type) . '">' . e($text) . '</div>';
    }
    return '';
}

function set_flash(string $type, string $text): void
{
    $_SESSION['flash'] = [$type, $text];
}
