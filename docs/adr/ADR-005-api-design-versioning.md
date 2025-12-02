# ADR-005: API Design & Versioning

## Status
Accepted

## Context
Both Android and Web require a stable API. The system must be extendable after first release.

## Decision
Adopt the following design:
- REST API  
- Versioned routes: `/api/v1/...`  
- JWT for session tokens  

## Alternatives
- GraphQL: versatile but adds complexity.  
- Unversioned REST: breaks clients on updates.

## Consequences
### Positive
- Clear upgrade path for v2, v3.  
- Easy to test and document.

### Negative
- Slightly more boilerplate.

## Related
ADR-001 Backend Framework  
ADR-009 Sync Strategy

