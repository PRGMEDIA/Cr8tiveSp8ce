<?php
/**
 * login.php — Sanctuary Magazine Member Login
 * Serves the login form AND processes it (POST).
 */

require_once __DIR__ . '/layout.php';

// Already logged in? Go straight to the member area.
if (current_member()) {
    header('Location: dashboard.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $email    = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        $error = 'Please enter your email and password.';
    } else {
        $failures = record_login_attempt($email, false);
        if ($failures >= 8) {
            log_failure_record([
                'source'       => 'sanctuary-login',
                'failure_type' => 'LOGIN_THROTTLED',
                'member_email' => $email,
                'detail'       => "Throttled after {$failures} failed attempts within 15 minutes.",
            ]);
            $error = 'Too many failed attempts. Please wait 15 minutes and try again.';
        } else {
            $stmt = db()->prepare('SELECT * FROM members WHERE email = :email');
            $stmt->execute([':email' => $email]);
            $member = $stmt->fetch();

            if ($member && password_verify($password, $member['password_hash'])) {
                if ((int)$member['is_active'] !== 1) {
                    // Correct password, but account not yet approved by an administrator
                    record_login_attempt($email, true);
                    log_failure_record([
                        'source'       => 'sanctuary-login',
                        'failure_type' => 'LOGIN_PENDING_APPROVAL',
                        'member_email' => $email,
                        'detail'       => 'Correct password; account is disabled pending administrator approval.',
                    ]);
                    $error = 'Your account is awaiting administrator approval. '
                           . 'You will be able to log in once your membership is activated.';
                } else {
                    // Optional upgrade of legacy hashes
                    if (password_needs_rehash($member['password_hash'], PASSWORD_DEFAULT)) {
                        $up = db()->prepare('UPDATE members SET password_hash = :h WHERE id = :id');
                        $up->execute([':h' => password_hash($password, PASSWORD_DEFAULT), ':id' => $member['id']]);
                    }

                    session_refresh();
                    $_SESSION['member_id'] = (int)$member['id'];
                    record_login_attempt($email, true);

                    $upd = db()->prepare('UPDATE members SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id');
                    $upd->execute([':id' => $member['id']]);

                    header('Location: dashboard.php');
                    exit;
                }
            } else {
                log_failure_record([
                    'source'       => 'sanctuary-login',
                    'failure_type' => 'LOGIN_FAILED',
                    'member_email' => $email,
                    'detail'       => $member ? 'Password did not match.' : 'No account with this email (or inactive).',
                ]);
                $error = 'Incorrect email or password.';
            }
        }
    }
}

page_header('Member Login');
?>
<div class="card narrow">
  <div class="brand">
    <h1>Member Login</h1>
    <p><?= e(SITE_NAME) ?> · <?= e(ORG_NAME) ?></p>
  </div>

  <?php if ($error): ?><div class="msg err"><?= e($error) ?></div><?php endif; ?>
  <?= flash_msg() ?>

  <form method="POST" action="login.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">

    <label for="email">Email Address</label>
    <input type="email" id="email" name="email" maxlength="190" required autofocus autocomplete="email">

    <label for="password">Password</label>
    <input type="password" id="password" name="password" maxlength="100" required autocomplete="current-password">

    <button type="submit" class="btn">Log In</button>
  </form>

  <p class="footnote">New member? <a href="register.php">Create an account</a></p>
  <p class="footnote">Have a manuscript to share? <a href="../../email-submittal/index.html">Submit it here</a></p>
</div>
<?php page_footer(); ?>
