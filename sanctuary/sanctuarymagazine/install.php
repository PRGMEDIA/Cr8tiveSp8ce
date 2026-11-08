<?php
/**
 * install.php — One-time installer for the Sanctuary Magazine membership system.
 *
 * Creates the database tables and the initial administrator account from
 * the values in config.php.
 *
 * ⚠ SECURITY: Delete this file from the server after running it once.
 */

require_once __DIR__ . '/layout.php';

$alreadyDone = false;
$createdAdmin = false;
$messages = [];

try {
    $pdo = db(); // connects + creates schema

    $stmt = $pdo->prepare('SELECT id FROM members WHERE email = :email');
    $stmt->execute([':email' => ADMIN_EMAIL]);
    if ($stmt->fetch()) {
        $alreadyDone = true;
    } elseif (ADMIN_PASSWORD === 'CHANGE_ME_ADMIN_PASSWORD') {
        $messages[] = 'Open config.php and set ADMIN_PASSWORD first, then run install.php again.';
    } else {
        $insert = $pdo->prepare("
            INSERT INTO members (email, password_hash, first_name, last_name, membership_level, is_admin, is_active)
            VALUES (:email, :hash, :first, :last, 'Administrator', 1, 1)
        ");
        $insert->execute([
            ':email' => ADMIN_EMAIL,
            ':hash'  => password_hash(ADMIN_PASSWORD, PASSWORD_DEFAULT),
            ':first' => explode(' ', ADMIN_NAME, 2)[0],
            ':last'  => explode(' ', ADMIN_NAME, 2)[1] ?? '',
        ]);
        $createdAdmin = true;
    }
} catch (Throwable $ex) {
    log_failure_record([
        'source'       => 'sanctuary-install',
        'failure_type' => 'INSTALL_ERROR',
        'detail'       => $ex->getMessage(),
    ]);
    $messages[] = 'Database error: ' . $ex->getMessage();
}

page_header('Install');
?>
<div class="card narrow">
  <div class="brand">
    <h1>Membership System Installer</h1>
    <p><?= e(SITE_NAME) ?></p>
  </div>

  <?php if ($createdAdmin): ?>
    <div class="msg ok">
      ✅ Installation complete. The database tables were created and the
      administrator account <strong><?= e(ADMIN_EMAIL) ?></strong> is ready.
      <br><br><strong>Now delete install.php from the server.</strong>
    </div>
    <a class="btn" href="login.php">Go to Member Login</a>
  <?php elseif ($alreadyDone): ?>
    <div class="msg ok">✅ The system is already installed (an administrator account exists).</div>
    <a class="btn" href="login.php">Go to Member Login</a>
  <?php else: ?>
    <?php foreach ($messages as $m): ?><div class="msg err"><?= e($m) ?></div><?php endforeach; ?>
    <p style="color:var(--muted);font-size:.9rem;">
      Set your database credentials and <code>ADMIN_PASSWORD</code> in
      <code>config.php</code>, then refresh this page.
    </p>
  <?php endif; ?>
</div>
<?php page_footer(); ?>
