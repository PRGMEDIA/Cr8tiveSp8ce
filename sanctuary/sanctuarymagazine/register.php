<?php
/**
 * register.php — Create a Sanctuary Magazine member account.
 * Accounts are created as "Member" (non-admin) and active immediately.
 */

require_once __DIR__ . '/layout.php';

if (current_member()) {
    header('Location: dashboard.php');
    exit;
}

$errors = [];
$old = ['first_name' => '', 'last_name' => '', 'email' => ''];
$levels = MEMBERSHIP_LEVELS;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $old['first_name'] = trim($_POST['first_name'] ?? '');
    $old['last_name']  = trim($_POST['last_name'] ?? '');
    $old['email']      = strtolower(trim($_POST['email'] ?? ''));
    $level             = trim($_POST['membership_level'] ?? 'Member');
    $password          = $_POST['password'] ?? '';
    $confirm           = $_POST['password_confirm'] ?? '';

    if ($old['first_name'] === '' || mb_strlen($old['first_name']) > 100)  { $errors[] = 'Please enter your first name.'; }
    if (mb_strlen($old['last_name']) > 100)                                { $errors[] = 'Last name is too long.'; }
    if (!filter_var($old['email'], FILTER_VALIDATE_EMAIL) || mb_strlen($old['email']) > 190) { $errors[] = 'Please enter a valid email address.'; }
    if (!in_array($level, $levels, true))                                  { $errors[] = 'Please choose a membership level.'; }
    if (strlen($password) < 8)                                             { $errors[] = 'Password must be at least 8 characters.'; }
    if ($password !== $confirm)                                            { $errors[] = 'Passwords do not match.'; }

    if (!$errors) {
        $check = db()->prepare('SELECT id FROM members WHERE email = :email');
        $check->execute([':email' => $old['email']]);
        if ($check->fetch()) {
            $errors[] = 'An account with that email already exists. Try logging in instead.';
        } else {
            $insert = db()->prepare("
                INSERT INTO members (email, password_hash, first_name, last_name, membership_level, is_active)
                VALUES (:email, :hash, :first, :last, :level, :active)
            ");
            $insert->execute([
                ':email'  => $old['email'],
                ':hash'   => password_hash($password, PASSWORD_DEFAULT),
                ':first'  => $old['first_name'],
                ':last'   => $old['last_name'],
                ':level'  => $level,
                ':active' => REQUIRE_APPROVAL ? 0 : 1,
            ]);

            if (REQUIRE_APPROVAL) {
                // Pending administrator approval — no auto-login until approved
                set_flash('ok', 'Thank you! Your membership account has been created and is awaiting approval. ' .
                    'You will be able to log in once an administrator activates your account (usually within 1–2 business days).');
                header('Location: login.php');
                exit;
            }

            $id = (int)db()->lastInsertId();
            session_refresh();
            $_SESSION['member_id'] = $id;
            set_flash('ok', 'Welcome! Your membership account has been created.');
            header('Location: dashboard.php');
            exit;
        }
    }
}

// Record the registration form failure in the Oracle DB
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $errors) {
    $isDuplicate = (bool)preg_grep('/already exists/', $errors);
    log_failure_record([
        'source'       => 'sanctuary-register',
        'failure_type' => $isDuplicate ? 'DUPLICATE_EMAIL' : 'FORM_VALIDATION',
        'member_name'  => trim($old['first_name'] . ' ' . $old['last_name']),
        'member_email' => $old['email'],
        'detail'       => implode(' ', $errors),
        'extra'        => ['membership_level' => $level, 'field_errors' => $errors],
    ]);
}

page_header('Create Account');
?>
<div class="card narrow">
  <div class="brand">
    <h1>Create Your Account</h1>
    <p><?= e(SITE_NAME) ?> membership</p>
  </div>

  <?php foreach ($errors as $err): ?><div class="msg err"><?= e($err) ?></div><?php endforeach; ?>
  <?= flash_msg() ?>

  <form method="POST" action="register.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">

    <label for="first_name">First Name *</label>
    <input type="text" id="first_name" name="first_name" maxlength="100" required value="<?= e($old['first_name']) ?>">

    <label for="last_name">Last Name</label>
    <input type="text" id="last_name" name="last_name" maxlength="100" value="<?= e($old['last_name']) ?>">

    <label for="email">Email Address *</label>
    <input type="email" id="email" name="email" maxlength="190" required value="<?= e($old['email']) ?>">

    <label for="membership_level">Membership Level *</label>
    <select id="membership_level" name="membership_level">
      <?php foreach ($levels as $lvl): ?>
        <option value="<?= e($lvl) ?>" <?= $lvl === MEMBERSHIP_LEVELS[0] ? 'selected' : '' ?>><?= e($lvl) ?></option>
      <?php endforeach; ?>
    </select>

    <label for="password">Password * (8+ characters)</label>
    <input type="password" id="password" name="password" maxlength="100" required autocomplete="new-password">

    <label for="password_confirm">Confirm Password *</label>
    <input type="password" id="password_confirm" name="password_confirm" maxlength="100" required autocomplete="new-password">

    <button type="submit" class="btn">Create Account</button>
  </form>

  <p class="footnote">Already a member? <a href="login.php">Log in</a></p>
</div>
<?php page_footer(); ?>
