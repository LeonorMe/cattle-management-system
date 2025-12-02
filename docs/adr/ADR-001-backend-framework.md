# ADR-001: Backend Framework

## Status
Accepted

## Context
The project requires an API capable of serving both an Android application and a Web application.  
Cost must be minimal, development time short, and performance high. The developer prefers Python.

## Decision
Use **FastAPI (Python 3.12)** as the backend framework.

## Alternatives Considered
- **Django**: robust but heavy; slower development; unnecessary admin overhead.  
- **Flask**: lighter but lacks built-in validation and async support.  
- **Node.js/Express**: good option but non-preferred language.  

## Consequences
### Positive
- Very fast to develop.  
- Auto-generated API documentation (OpenAPI/Swagger).  
- Pydantic provides strong validation.  
- Async support useful for sync events.

### Negative
- Requires more configuration than Django.  
- Admin interface must be custom-built.

## Related Decisions
ADR-002 Production Database  
ADR-005 API Versioning
