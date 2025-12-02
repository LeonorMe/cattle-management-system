# ADR-012: Notifications System

## Status
Accepted

## Context
System must notify about expected births, estrus cycles, and updates.

## Decision
- Server cron job checks events  
- Firebase Cloud Messaging (FCM) for Android push notifications  
- Email fallback for WebApp users

## Alternatives
- SMS: expensive.  
- Fully client-side notifications: unreliable.

## Consequences
### Positive
- Free and reliable.  
- Works offline once received.

### Negative
- Cron scheduling must be deployed.

## Related
ADR-001 Backend  
ADR-008 Android
