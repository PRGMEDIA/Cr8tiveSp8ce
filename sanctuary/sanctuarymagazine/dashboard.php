<?php
/**
 * dashboard.php — Member-only area after login.
 */

require_once __DIR__ . '/layout.php';

$member = require_login();

page_header('Member Dashboard', true);
?>
<div class="card">
  <div class="topbar">
    <h1 style="font-size:1.3rem;">Welcome, <?= e($member['first_name']) ?> 👋</h1>
    <a class="toplink" href="login.php?action=logout">Log Out</a>
  </div>

  <?= flash_msg() ?>

  <h2 style="font-size:1rem;margin:18px 0 8px;">My Membership</h2>
  <table class="repo">
    <tr><th style="width:170px;">Name</th><td><?= e(trim($member['first_name'] . ' ' . $member['last_name'])) ?></td></tr>
    <tr><th>Email</th><td><?= e($member['email']) ?></td></tr>
    <tr><th>Membership Level</th><td><span class="badge member"><?= e($member['membership_level']) ?></span></td></tr>
    <tr><th>Member Since</th><td><?= e($member['created_at']) ?></td></tr>
    <tr><th>Last Login</th><td><?= e($member['last_login_at'] ?? 'First visit') ?></td></tr>
  </table>

  <h2 style="font-size:1rem;margin:26px 0 8px;">Member Resources</h2>
  <p style="color:var(--muted);font-size:.92rem;line-height:1.7;">
    Your member area is ready. Coming soon: digital magazine issues, submission
    tools, and member-exclusive downloads. If you submitted a manuscript through
    the website form, our editors will contact you at
    <strong><?= e($member['email']) ?></strong>.
  </p>

  <?php if ($member['is_admin']): ?>
    <h2 style="font-size:1rem;margin:26px 0 8px;">Administration</h2>
    <a class="toplink" href="members.php">→ Open the Member Data Repository</a>
  <?php endif; ?>
</div>
<?php page_footer(); ?>
