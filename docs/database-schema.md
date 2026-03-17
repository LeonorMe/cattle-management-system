# Database Schema

This document outlines the core tables for the Cattle Management System.

## Tables

### Users
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| email | String | Unique email |
| name | String | Full name |
| password_hash | String | Hashed password |
| farm_id | UUID | Foreign Key -> Farms.id |

### Farms
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| name | String | Farm name |
| location | String | Optional location |
| owner_id | UUID | Foreign Key -> Users.id |

### Animals
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| farm_id | UUID | Foreign Key -> Farms.id |
| registration_id | String | Unique tag/id |
| name | String | Optional name |
| breed | String | e.g., Angus, Hereford |
| gender | Enum | M/F |
| birth_date | Date | |
| mother_id | UUID | Foreign Key -> Animals.id (Self-ref) |
| father_id | UUID | Foreign Key -> Animals.id (Self-ref) |
| status | Enum | Active, Sold, Deceased |

### Events
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| animal_id | UUID | Foreign Key -> Animals.id |
| event_type | Enum | Vaccination, Medication, Birth, Heat, Pregnancy |
| event_date | Date | |
| description | Text | Details |
| sync_status | Enum | Pending, Synced |
