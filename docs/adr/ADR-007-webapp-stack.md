# ADR-007: WebApp Technology Stack

## Status
Accepted

## Context
The WebApp must be light, cheap to host, and maintainable. Developer prefers plain HTML/CSS/JS.

## Decision
Use **HTML + CSS + Vanilla JS** with minimal modules.  
Optional: Alpine.js or HTMX if necessary.

## Alternatives
- React/Vue: heavy for this use-case.  
- Angular: unnecessary complexity.

## Consequences
### Positive
- Very fast and lightweight.  
- Zero build system required.  
- Easy to integrate Google Ads.

### Negative
- Must build some components manually.

## Related
ADR-006 Hosting Platform
