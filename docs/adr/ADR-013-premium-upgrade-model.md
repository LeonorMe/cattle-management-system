# ADR-013: Premium Upgrade & Licensing Model

## Status
Accepted

## Context
System offers free use for up to 3 workers per farm; premium unlocks more.

## Decision
- Use **one-time purchase** via Web backend  
- License stored in PostgreSQL, tied to Farm ID  
- WebApp handles purchase; Android reads permission flag

## Alternatives
- Subscription model: too costly for client.  
- In-app purchases: requires Google fees.

## Consequences
### Positive
- Simple to maintain.  
- No recurring payments.

### Negative
- Must secure license validation.

## Related
ADR-004 Authentication
