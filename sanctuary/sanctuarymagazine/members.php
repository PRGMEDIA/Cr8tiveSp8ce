<?php
/**
 * members.php — Member Data Repository (administrators only).
 * Searchable directory of all member accounts with CSV export.
 */

require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/mailer.php';

$admin = require_admin();
$pdo = db();

/* ---------- Actions (POST) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    $target = (int)($_POST['member_id'] ?? 0);

    // Admins can never deactivate/demote themselves
    if ($target && $target !== (int)$admin['id']) {
        if ($action === 'toggle_active') {
            // Fetch current state so we know whether this is an approval (0 → 1)
            $get = $pdo->prepare('SELECT first_name, last_name, email, is_active FROM members WHERE id = :id');
            $get->execute([':id' => $target]);
            $targetMember = $get->fetch();

            if (!$targetMember) {
                set_flash('err', 'Member not found.');
                header('Location: members.php');
                exit;
            }

            $wasActive = (int)$targetMember['is_active'] === 1;
            $pdo->prepare('UPDATE members SET is_active = 1 - is_active WHERE id = :id')->execute([':id' => $target]);

            if ($wasActive) {
                set_flash('ok', 'Member disabled.');
            } else {
                // Approval — email the member automatically
                $toName = trim($targetMember['first_name'] . ' ' . $targetMember['last_name']);
                $mailResult = send_approval_email($targetMember['email'], $toName);

                if ($mailResult === true) {
                    set_flash('ok', 'Member approved and notified by email at ' . $targetMember['email'] . '.');
                } else {
                    error_log('Approval email failed for ' . $targetMember['email'] . ': ' . (is_string($mailResult) ? $mailResult : 'unknown'));
                    set_flash('ok', 'Member approved, but the notification email could not be sent. Please contact them at ' . $targetMember['email'] . '.');
                }
            }
        } elseif ($action === 'toggle_admin') {
            $pdo->prepare('UPDATE members SET is_admin = 1 - is_admin WHERE id = :id')->execute([':id' => $target]);
            set_flash('ok', 'Administrator role updated.');
        } elseif ($action === 'set_level') {
            $level = trim($_POST['membership_level'] ?? '');
            if (in_array($level, ['Member', 'Student', 'Contributor', 'Patron'], true)) {
                $pdo->prepare('UPDATE members SET membership_level = :l WHERE id = :id')->execute([':l' => $level, ':id' => $target]);
                set_flash('ok', 'Membership level updated.');
            }
        }
    }
    header('Location: members.php?' . http_build_query(['q' => $_GET['q'] ?? '']));
    exit;
}

/* ---------- Search + list (GET) ---------- */
$q = trim($_GET['q'] ?? '');
if ($q !== '') {
    $like = '%' . $q . '%';
    $stmt = $pdo->prepare("
        SELECT id, email, first_name, last_name, membership_level, is_admin, is_active,
               created_at, last_login_at
        FROM members
        WHERE email LIKE :like OR first_name LIKE :like OR last_name LIKE :like OR membership_level LIKE :like
        ORDER BY created_at DESC
    ");
    $stmt->execute([':like' => $like]);
} else {
    $stmt = $pdo->query("
        SELECT id, email, first_name, last_name, membership_level, is_admin, is_active,
               created_at, last_login_at
        FROM members
        ORDER BY created_at DESC
    ");
}
$members = $stmt->fetchAll();

$totals = $pdo->query("
    SELECT COUNT(*) AS total,
           SUM(is_active) AS active,
           SUM(last_login_at IS NOT NULL) AS ever_logged_in
    FROM members
")->fetch();

page_header('Member Data Repository', true);
?>
<div class="card">
  <div class="topbar">
    <h1 style="font-size:1.3rem;">📚 Member Data Repository</h1>
    <a class="toplink" href="dashboard.php">← Dashboard</a>
  </div>

  <?= flash_msg() ?>

  <div class="toolbar">
    <form method="GET" action="members.php" style="display:flex;gap:10px;flex:1;flex-wrap:wrap;">
      <input type="text" name="q" value="<?= e($q) ?>" placeholder="Search name, email, or level...">
      <button type="submit" class="btn">Search</button>
      <?php if ($q !== ''): ?><a class="toplink" href="members.php">Clear</a><?php endif; ?>
    </form>
    <a class="toplink" href="members-export.php?q=<?= urlencode($q) ?>">⬇ Export CSV</a>
  </div>

  <p style="color:var(--muted);font-size:.88rem;">
    <?= (int)$totals['total'] ?> total members · <?= (int)$totals['active'] ?> active ·
    <?= (int)$totals['ever_logged_in'] ?> have logged in
    <?php $pending = (int)$totals['total'] - (int)$totals['active']; ?>
    <?php if ($pending > 0): ?>· <strong style="color:var(--err);"><?= $pending ?> awaiting approval</strong><?php endif; ?>
  </p>

  <table class="repo">
    <tr>
      <th>ID</th><th>Name</th><th>Email</th><th>Level</th><th>Status</th>
      <th>Joined</th><th>Last Login</th><th>Actions</th>
    </tr>
    <?php if (!$members): ?>
      <tr><td colspan="8" style="color:var(--muted);">No members match your search.</td></tr>
    <?php endif; ?>
    <?php foreach ($members as $m): ?>
      <tr>
        <td><?= (int)$m['id'] ?></td>
        <td><?= e($m['first_name'] . ' ' . $m['last_name']) ?></td>
        <td><a class="toplink" href="mailto:<?= e($m['email']) ?>"><?= e($m['email']) ?></a></td>
        <td><?= e($m['membership_level']) ?></td>
        <td>
          <?= (int)$m['is_active'] ? '<span class="badge member">Active</span>' : '<span class="badge off">Disabled</span>' ?>
          <?= (int)$m['is_admin'] ? ' <span class="badge admin">Admin</span>' : '' ?>
        </td>
        <td><?= e($m['created_at']) ?></td>
        <td><?= e($m['last_login_at'] ?? '—') ?></td>
        <td>
          <?php if ((int)$m['id'] !== (int)$admin['id']): ?>
          <form method="POST" action="members.php" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
            <input type="hidden" name="member_id" value="<?= (int)$m['id'] ?>">
            <input type="hidden" name="q" value="<?= e($q) ?>">
            <select name="membership_level" style="width:auto;padding:4px 6px;font-size:.8rem;">
              <?php foreach (MEMBERSHIP_LEVELS as $lvl): ?>
                <option value="<?= e($lvl) ?>" <?= $m['membership_level'] === $lvl ? 'selected' : '' ?>><?= e($lvl) ?></option>
              <?php endforeach; ?>
            </select>
            <button class="btn secondary" type="submit" name="action" value="set_level" style="margin:0;padding:5px 10px;font-size:.8rem;">Save</button>
            <button class="btn secondary" type="submit" name="action" value="toggle_active" style="margin:0;padding:5px 10px;font-size:.8rem;">
              <?= (int)$m['is_active'] ? 'Disable' : 'Enable' ?>
            </button>
            <button class="btn secondary" type="submit" name="action" value="toggle_admin" style="margin:0;padding:5px 10px;font-size:.8rem;">
              <?= (int)$m['is_admin'] ? 'Revoke Admin' : 'Make Admin' ?>
            </button>
          </form>
          <?php else: ?>
            <span style="color:var(--muted);font-size:.8rem;">(you)</span>
          <?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
  </table>
</div>
<?php page_footer(); ?>
