import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL_ENABLED = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "";

export interface SendInviteParams {
  email: string;
  inviteToken: string;
  role: string;
  invitedBy?: string;
}

export interface SendPasswordResetParams {
  email: string;
  resetToken: string;
}

class EmailService {
  async sendInvite({ email, inviteToken, role, invitedBy }: SendInviteParams): Promise<void> {
    const registrationUrl = `${APP_URL}/register/${inviteToken}`;

    // If no API key, just log the registration URL (dev mode)
    if (!EMAIL_ENABLED) {
      console.log(`[Email] Dev mode - no RESEND_API_KEY set`);
      console.log(`[Email] Registration URL for ${email}:`);
      console.log(`  ${registrationUrl}`);
      return;
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "You've been invited to OANDA Trade Mirror",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">OANDA Trade Mirror</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1a1a2e; margin-top: 0;">You're Invited!</h2>
              <p>You've been invited to join OANDA Trade Mirror${
                invitedBy ? ` by ${invitedBy}` : ""
              }.</p>
              <p>Your role: <strong style="color: #4f46e5;">${role}</strong></p>
              <p>Click the button below to complete your registration:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${registrationUrl}" style="background: #4f46e5; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Complete Registration</a>
              </div>
              <p style="color: #666; font-size: 14px;">This link will expire in 7 days.</p>
              <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${registrationUrl}" style="color: #4f46e5; word-break: break-all;">${registrationUrl}</a>
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
You've been invited to OANDA Trade Mirror${invitedBy ? ` by ${invitedBy}` : ""}.

Your role: ${role}

Complete your registration by visiting:
${registrationUrl}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send invite:", error);
      throw new Error(`Failed to send invite email: ${error.message}`);
    }

    console.log(`[Email] Invite sent to ${email}`);
  }

  async sendPasswordReset({ email, resetToken }: SendPasswordResetParams): Promise<void> {
    const resetUrl = `${APP_URL}/reset-password/${resetToken}`;

    // If no API key, just log the reset URL (dev mode)
    if (!EMAIL_ENABLED) {
      console.log(`[Email] Dev mode - no RESEND_API_KEY set`);
      console.log(`[Email] Password reset URL for ${email}:`);
      console.log(`  ${resetUrl}`);
      return;
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your password - OANDA Trade Mirror",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">OANDA Trade Mirror</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1a1a2e; margin-top: 0;">Reset Your Password</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #4f46e5; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Reset Your Password - OANDA Trade Mirror

We received a request to reset your password.

Reset your password by visiting:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send password reset:", error);
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }

    console.log(`[Email] Password reset sent to ${email}`);
  }
}

export const emailService = new EmailService();
