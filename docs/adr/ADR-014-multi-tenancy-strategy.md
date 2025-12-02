# ADR-014: Multi-Tenancy Strategy (Farm Isolation)

## Status
Accepted

## Context
Different farms must never see each other’s data.  
Each farm can have up to 3 workers (unless premium).

## Decision
Use **Farm ID isolation**:
- Every table includes `farm_id` foreign key  
- All API queries are scoped by farm_id + user permissions  
- Authentication maps user → farm membership

## Alternatives
- Separate databases per farm: too heavy.  
- Row-level security in DB: optional but complex.

## Consequences
### Positive
- Simple and secure isolation.  
- Easy scaling.

### Negative
- Must ensure no queries forget to filter by farm_id.

## Related
ADR-002 Database  
ADR-004 Authentication
