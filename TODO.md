# OANDA Trade Mirror - Future Improvements

## User Feedback
- [x] Toast notifications for actions (account created, trade placed, errors)
- [ ] Loading skeletons instead of "Loading..." text

## Dashboard Enhancements
- [x] Account balances fetched from OANDA API
- [ ] Open positions view across all accounts
- [ ] P&L summary / trade statistics (win rate, total profit/loss)
- [ ] Connection status indicator showing if OANDA API is reachable

## Trade Management
- [ ] Retry button for failed mirror executions
- [ ] Export trade history to CSV
- [ ] Trade filtering/search (by instrument, date range, side)
- [ ] Show pending trades that are being mirrored

## Account Management
- [x] Dynamic NAV-based scaling (auto-scale based on account balance ratio)
- [ ] Pause/resume mirroring without deleting accounts
- [ ] Quick scale factor adjustment buttons (0.5x, 1x, 2x)
- [ ] Bulk actions (pause all mirrors, resume all)
- [ ] Show sync status - whether mirrors are caught up with source

## Real-time Updates
- [x] WebSocket connection for live trade updates instead of manual refresh
- [ ] Desktop notifications when trades are mirrored (or fail)

## Quality of Life
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts
- [ ] Remember last selected source account
