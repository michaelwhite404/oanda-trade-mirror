# OANDA Trade Mirror - Future Improvements

## User Feedback
- [x] Toast notifications for actions (account created, trade placed, errors)
- [ ] Loading skeletons instead of "Loading..." text

## Dashboard Enhancements
- [x] Account balances fetched from OANDA API
- [x] Open positions view across all accounts
- [x] P&L summary / trade statistics (win rate, total profit/loss)
- [x] Connection status indicator showing if OANDA API is reachable

## Trade Management
- [x] Retry button for failed mirror executions
- [x] Export trade history to CSV
- [x] Trade filtering/search (by instrument, date range, side)
- [ ] Show pending trades that are being mirrored

## Account Management
- [x] Dynamic NAV-based scaling (auto-scale based on account balance ratio)
- [x] Pause/resume mirroring without deleting accounts
- [ ] Quick scale factor adjustment buttons (0.5x, 1x, 2x)
- [x] Bulk actions (pause all mirrors, resume all)
- [x] Show sync status - whether mirrors are caught up with source

## Real-time Updates
- [x] WebSocket connection for live trade updates instead of manual refresh
- [ ] Desktop notifications when trades are mirrored (or fail)

## Quality of Life
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts
- [ ] Remember last selected source account
