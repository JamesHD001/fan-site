const RESEND_API_URL = "https://api.resend.com/emails";

const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[char]);

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    const error = new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "The email provider rejected the message.");
    error.code = "EMAIL_DELIVERY_FAILED";
    error.provider = data;
    throw error;
  }
  return data;
};

const sendOtpEmail = ({ to, otp, purpose }) => {
  const isRegistration = purpose === "REGISTRATION";
  const title = isRegistration ? "Verify your email address" : "Confirm your purchase";
  const action = isRegistration ? "finish creating your fan community account" : "confirm your purchase";
  const subject = isRegistration ? "Your Keanu Reeves Fan Community verification code" : "Your purchase verification code";
  const safeOtp = escapeHtml(otp);
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#171717"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:18px;padding:36px;box-shadow:0 8px 30px rgba(0,0,0,.08)"><p style="font-size:12px;font-weight:700;letter-spacing:2px">KEANU REEVES FAN COMMUNITY</p><h1 style="font-size:28px;margin:20px 0 10px">${title}</h1><p style="font-size:16px;line-height:1.6;color:#555">Use the verification code below to ${action}. This code expires in 10 minutes.</p><div style="margin:28px 0;padding:18px;text-align:center;border-radius:12px;background:#f4f4f5;font-size:34px;font-weight:800;letter-spacing:10px">${safeOtp}</div><p style="font-size:13px;line-height:1.6;color:#777">Never share this code with anyone. If you did not request it, you can safely ignore this email.</p></div></body></html>`;
  const text = `Keanu Reeves Fan Community\n\n${title}\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes. Never share it with anyone.`;
  return sendEmail({ to, subject, html, text });
};

module.exports = { sendEmail, sendOtpEmail };
