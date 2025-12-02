# ADR-002: Production Database

## Status
Accepted

## Context
The system must support multiple farms, multi-user access, simple relational structure, and genealogy queries.  
Cost must be minimal.

## Decision
Use **PostgreSQL** as the production database.

## Alternatives
- **MySQL**: similar but fewer extensions for recursive queries.  
- **SQLite**: not suitable for cloud multi-user scenario.  
- **MongoDB**: not ideal for relational or tree-structured queries.

## Consequences
### Positive
- Excellent support for recursive queries (CTE), useful for genealogy.  
- Free hosting available via Railway/Render.  
- Stable and widely supported.

### Negative
- Requires managed hosting.  
- Slightly more configuration compared to Firebase.

## Related
ADR-014 Multi-Tenancy  
ADR-010 Genealogy Rendering
