<?php
/**
 * logout.php — End the member session.
 */

require_once __DIR__ . '/config.php';

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], (bool)$p['secure'], (bool)$p['httponly']);
}
session_destroy();
session_start();
session_regenerate_id(true);

header('Location: login.php');
exit;
