<?php
/**
 * mailer.php — Sends transactional emails for the membership system.
 * Uses PHPMailer when available (Composer vendor/ or src/ folder),
 * falling back to PHP's native mail() function.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Sends the "membership approved" email to a member.
 * Returns true on success, or an error string on failure.
 */
function send_approval_email(string $toEmail, string $toName): bool|string
{
    $loginUrl = MEMBER_PORTAL_URL;
    $site     = SITE_NAME;
    $org      = ORG_NAME;
    $contact  = CONTACT_EMAIL;

    $plain = "Hello {$toName},\r\n\r\n"
        . "Good news! Your membership with {$site} has been approved.\r\n"
        . "You can now log in to the member area:\r\n\r\n"
        . "{$loginUrl}\r\n\r\n"
        . "If you have any questions, contact us at {$contact}.\r\n\r\n"
        . "Warm regards,\r\n{$org}";

    $html = <<<HTML
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#1f2430;margin:0;padding:0;background:#f5f2ee;">
  <div style="max-width:560px;margin:20px auto;background:#ffffff;border:1px solid #e5e1da;border-radius:10px;overflow:hidden;">
    <div style="background:#7c3aed;color:#ffffff;padding:18px 24px;">
      <h2 style="margin:0;font-size:18px;">Welcome to {$site}! 🎉</h2>
    </div>
    <div style="padding:24px;font-size:14px;line-height:1.7;">
      <p>Hello <strong>{$toName}</strong>,</p>
      <p>Good news — your membership has been <strong style="color:#15803d;">approved</strong>!</p>
      <p>You can now log in to the member area:</p>
      <p style="text-align:center;margin:22px 0;">
        <a href="{$loginUrl}" style="background:#7c3aed;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Log In to Member Area</a>
      </p>
      <p style="color:#6b7280;font-size:13px;">If the button doesn't work, copy this link into your browser:<br>{$loginUrl}</p>
      <p style="margin-top:24px;">Warm regards,<br><strong>{$org}</strong></p>
    </div>
  </div>
</body>
</html>
HTML;

    return send_email($toEmail, $toName, "Your {$site} membership has been approved!", $html, $plain);
}

/**
 * Low-level sender: PHPMailer if available, otherwise mail().
 * Returns true on success, error string on failure.
 */
function send_email(string $toEmail, string $toName, string $subject, string $html, string $plain): bool|string
{
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
        try {
            $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mailer->isSMTP();
            $mailer->Host       = SMTP_HOST;
            $mailer->Port       = SMTP_PORT;
            $mailer->SMTPAuth   = true;
            $mailer->Username   = SMTP_USER;
            $mailer->Password   = SMTP_PASS;
            $mailer->SMTPSecure = SMTP_SECURE;
            $mailer->CharSet    = 'UTF-8';

            $mailer->setFrom(NOTIFY_FROM_EMAIL, NOTIFY_FROM_NAME);
            $mailer->addAddress($toEmail, $toName);
            $mailer->addReplyTo(CONTACT_EMAIL, ORG_NAME);

            $mailer->Subject = $subject;
            $mailer->isHTML(true);
            $mailer->Body    = $html;
            $mailer->AltBody = $plain;

            $mailer->send();
            return true;
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            return $e->getMessage();
        } catch (\Throwable $e) {
            return $e->getMessage();
        }
    }

    // Fallback: native mail() with multipart alternative
    $boundary = 'bnd_' . bin2hex(random_bytes(16));
    $headers  = "From: " . NOTIFY_FROM_NAME . " <" . NOTIFY_FROM_EMAIL . ">\r\n"
              . "Reply-To: " . CONTACT_EMAIL . "\r\n"
              . "MIME-Version: 1.0\r\n"
              . "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
    $body = "--$boundary\r\n"
          . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
          . $plain . "\r\n"
          . "--$boundary\r\n"
          . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
          . $html . "\r\n"
          . "--$boundary--";

    return @mail($toEmail, $subject, $body, $headers) ? true : 'mail() returned false.';
}
