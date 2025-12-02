# ADR-006: Hosting & Deployment Platform

## Status
Accepted

## Context
The system requires cheap or free hosting for API, database, and static WebApp.  
Project budget is minimal.

## Decision
- **Backend + PostgreSQL** → Railway / Render free tier  
- **WebApp** → GitHub Pages (static), or Render if ads require server-side  
- **Images / Assets** stored locally or minimal cloud space

## Alternatives
- AWS/Azure/GCP: too expensive for small project.  
- DigitalOcean: low cost but no free tier.

## Consequences
### Positive
- Very low cost.  
- Easy automatic deployments.  
- GitHub integration.

### Negative
- Free tiers have sleep/cold-start delays.  
- Limited compute.

## Related
ADR-002 Database  
ADR-007 WebApp Stack
