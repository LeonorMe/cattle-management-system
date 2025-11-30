# Cattle Management System
A lightweight and privacy-focused herd management platform designed for small farms. It includes a synchronized Web App and Android App for managing cattle records, genealogy visualization, reproduction cycles, birth notifications, productivity dashboards, and offline access. Built for speed, simplicity, and scalability.

## Key Features
- Unified database shared between web and Android apps
- Offline mode with automatic sync when online
- Excel (XLSX/CSV) import and export
- Genealogy tree visualization
- Dashboards with statistics and productivity indicators
- Notification system (birth dates, cycles, events)
- Multi-user access per farm (up to 3 users free, upgrade available)
- Secure authentication with Google Login or email/password
- Minimal tracking, privacy-first design
- Deployable to the Play Store
- Web version supports ads for revenue option

## Technology Stack (planned)
| Area | Technology |
|-------|------------|
| Backend | Python FastAPI, Postgres, Alembic |
| Frontend Web | HTML, CSS, JS, PWA |
| Android | TWA (Trusted Web Activity) |
| Sync | Custom API (push/pull with conflict resolution) |
| Local Storage | IndexedDB |
| Excel | openpyxl / CSV |
| Notifications | APScheduler, Firebase Cloud Messaging |
| Deployment | Docker, CI/CD GitHub Actions |

## Project Goals
- Lightweight and fast on low-end tablets
- Simple, intuitive and optimized for field conditions
- Clean architecture and maintainable codebase
- Expandable for future features

## Roadmap
Development timeline: November 2024 → May 2025  
Full week-by-week and GitHub project workflow tracked in Issues & Project board.

## Privacy
- No unnecessary analytics or tracking
- Local-first design with encrypted connection to the server
- User owns all stored data

## Contributing
Currently a private and single-developer project. Suggestions welcome via Issues.

## License
MIT License

## Contact
Project Owner & Developer: Leonor Medeiros
Language: Portuguese (UI) / English (code)
