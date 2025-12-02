# ADR-011: Import & Export Strategy

## Status
Accepted

## Context
The farmer must import legacy Excel data and export reports.

## Decision
- Use **Python (Pandas)** server-side to process imports/exports on demand  
- Format: **.xlsx** (OpenXML)

## Alternatives
- CSV-only: loses formatting.  
- Client-side XLSX rendering: limited compatibility.

## Consequences
### Positive
- Very reliable.  
- Easy to extend.

### Negative
- Server requires memory overhead for large files.

## Related
ADR-001 Backend Framework
