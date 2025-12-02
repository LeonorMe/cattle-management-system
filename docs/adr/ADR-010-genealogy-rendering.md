# ADR-010: Genealogy Tree Rendering

## Status
Accepted

## Context
Users require a visual genetic tree of animals. Must run on Web and Android.

## Decision
Use a **tree layout using D3.js** in Web, and **WebView-D3** or native Canvas for Android.

## Alternatives
- Custom rendering engine: too complex.  
- SVG static diagrams: not interactive.

## Consequences
### Positive
- D3.js is stable, powerful, free.  
- Easy to scale nodes and relationships.

### Negative
- Learning curve required.  
- WebView integration on Android needs care.

## Related
ADR-002 Database
