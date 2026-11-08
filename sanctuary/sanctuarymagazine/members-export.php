<?php
/**
 * members-export.php — CSV export of the member data repository (admins only).
 */

require_once __DIR__ . '/db.php';

$admin = require_admin();
$pdo = db();

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

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=sanctuary-members-' . date('Ymd_His') . '.csv');

$out = fopen('php://output', 'w');
fputcsv($out, ['ID', 'Email', 'First Name', 'Last Name', 'Membership Level', 'Admin', 'Active', 'Joined', 'Last Login']);
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    fputcsv($out, [
        $row['id'], $row['email'], $row['first_name'], $row['last_name'],
        $row['membership_level'], (int)$row['is_admin'] ? 'Yes' : 'No',
        (int)$row['is_active'] ? 'Active' : 'Disabled',
        $row['created_at'], $row['last_login_at'] ?? '',
    ]);
}
fclose($out);
exit;
