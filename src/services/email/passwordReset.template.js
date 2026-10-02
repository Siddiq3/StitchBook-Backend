const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));

exports.passwordResetEmail = ({ name, otp, expiresMinutes }) => {
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp);
  const subject = 'Your StitchBook password reset code';

  return {
    subject,
    text: `Hi ${name || 'there'},\n\nYour StitchBook password reset code is ${otp}. It expires in ${expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.\n\nStitchBook`,
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f6;font-family:Arial,sans-serif;color:#101014">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px">
      <div style="background:#fff;border:1px solid #e6e6ea;border-radius:18px;padding:28px">
        <div style="font-size:22px;font-weight:700;color:#e2511e">StitchBook</div>
        <h1 style="font-size:24px;line-height:32px;margin:24px 0 8px">Reset your password</h1>
        <p style="font-size:15px;line-height:23px;color:#45454f">Hi ${safeName}, use this verification code to reset your StitchBook password.</p>
        <div style="margin:24px 0;padding:18px;border-radius:14px;background:#fef1ea;text-align:center;font-size:34px;letter-spacing:8px;font-weight:700;color:#101014">${safeOtp}</div>
        <p style="font-size:14px;line-height:21px;color:#5b5b66">This code expires in ${expiresMinutes} minutes. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    </div>
  </body>
</html>`,
  };
};
