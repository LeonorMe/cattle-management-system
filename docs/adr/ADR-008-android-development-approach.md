# ADR-008: Android Development Approach

## Status
Accepted

## Context
The Android app must be lightweight, offline-ready, and easy to publish to Google Play.

## Decision
Use **Kotlin + Android Studio** (native Android).

## Alternatives
- Kivy / Python for Android: unstable, store issues.  
- Flutter: excellent but heavier learning curve.  
- React Native: adds dependency on JavaScript ecosystem.

## Consequences
### Positive
- Best performance and long-term stability.  
- Simple integration with Google OAuth.  
- Full Play Store compatibility.

### Negative
- New language if developer is less experienced.  
- More boilerplate than Flutter.

## Related
ADR-003 Local Storage  
ADR-009 Sync Strategy
