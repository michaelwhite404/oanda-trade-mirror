# OANDA Trade Mirror - Future Improvements

## User Feedback
- [x] Toast notifications for actions (account created, trade placed, errors)
- [x] Loading skeletons instead of "Loading..." text

## Dashboard Enhancements
- [x] Account balances fetched from OANDA API
- [x] Open positions view across all accounts
- [x] P&L summary / trade statistics (win rate, total profit/loss)
- [x] Connection status indicator showing if OANDA API is reachable

## Trade Management
- [x] Retry button for failed mirror executions
- [x] Export trade history to CSV
- [x] Trade filtering/search (by instrument, date range, side)
- [x] Show pending trades that are being mirrored

## Account Management
- [x] Dynamic NAV-based scaling (auto-scale based on account balance ratio)
- [x] Pause/resume mirroring without deleting accounts
- [x] Quick scale factor adjustment buttons (0.5x, 1x, 2x)
- [x] Bulk actions (pause all mirrors, resume all)
- [x] Show sync status - whether mirrors are caught up with source

## Real-time Updates
- [x] WebSocket connection for live trade updates instead of manual refresh
- [x] Desktop notifications when trades are mirrored (or fail)

## Quality of Life
- [x] Dark mode toggle
- [x] Keyboard shortcuts
- [x] Remember last selected source account

## Mobile
- [x] PWA support (installable app, offline caching)
- [x] Push notifications for trade alerts (works when app is closed)

## Security
- [x] JWT authentication with httpOnly cookies
- [x] Google OAuth sign-in
- [x] API key authentication for programmatic access
- [x] Active sessions list (show where logged in, allow revoking)
- [x] API key scopes/permissions (read-only, specific endpoints)

## User Account
- [x] Invite-based registration flow
- [x] Update username from Account page
- [x] Change password
- [x] Forgot password / reset flow
- [x] API key expiration option in UI

## Admin Features
- [x] User management page (invite, deactivate, change role)
- [x] Reactivate users with auto-resend invite
- [x] User search/filter
- [x] Audit log (track who invited/deactivated users)

## CI/CD & DevOps
- [x] Docker containerization
- [x] Fly.io deployment configuration
- [x] Manual deploy GitHub Action
- [x] Staging environment with auto-deploy on push to main
- [x] Automated tests in CI pipeline
- [x] Database backup automation (MongoDB Atlas built-in)
