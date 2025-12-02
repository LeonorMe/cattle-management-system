# ADR-003: Local Offline Storage (Android)

## Status
Accepted

## Context
The Android app must work fully offline. Users will make updates on farms without Wi-Fi.

## Decision
Use **SQLite** as the local offline database on Android.

## Alternatives
- IndexedDB (WebView only) — not reliable for native app.  
- JSON flat file — unsafe and fragile.  

## Consequences
### Positive
- Stable and well-tested local database.  
- Easy to sync using a queue model.

### Negative
- Conflict resolution logic required.  
- Requires a migration strategy.

## Related
ADR-009 Sync Strategy
