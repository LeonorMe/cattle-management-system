# ADR-004: Authentication Provider

## Status
Accepted

## Context
Users want private, secure login with minimal friction. The system will have very few users (<10).  
Android must allow easy authentication.

## Decision
Use **Google OAuth** as primary login + **email/password** fallback.

## Alternatives
- Firebase Auth alone: requires fully switching ecosystem.  
- Custom authentication: more work, higher security risk.

## Consequences
### Positive
- Secure and free.  
- Works seamlessly on Android.  
- Reduces password handling responsibility.

### Negative
- Requires Google Cloud configuration.

## Related
ADR-013 Premium Licensing Model  
ADR-014 Multi-Tenancy
