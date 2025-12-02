# ADR-009: Sync Strategy (Offline → Online)

## Status
Accepted

## Context
Farm workers will often be offline. Data must synchronize seamlessly when internet returns.

## Decision
Use a **Queue-Based Sync Model**:
- Local SQLite stores edits  
- A "pending" table tracks unsynced changes  
- On connection:  
  - Push local pending changes  
  - Pull server changes (timestamp-based)  
  - Resolve conflicts: "latest timestamp wins"

## Alternatives
- Real-time sync (WebSockets): unnecessary.  
- Operational transforms: too complex.

## Consequences
### Positive
- Simple and reliable.  
- Easy debugging.  
- Minimal data usage.

### Negative
- Timestamp conflicts must be considered.  
- Sync loops must be prevented.

## Related
ADR-003 Local Storage
