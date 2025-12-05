Design in Figma.

#### **1. List the main screens**

##### **Mobile App**
```
Login / Google Auth
Select Farm / Join Farm / Create Farm
Dashboard
Animals List
Animal Details
Add/Edit Animal
Genealogy Tree
Notifications
Settings / Sync status
Import / Export
```
##### **Web App**
```
Login
Dashboard with extended stats
Animals List
Animal Details
CRUD Animals
Genealogy visualization bigger
User management (add/remove workers)
Premium upgrade
Ads banner integration
Settings

#### **3. Create flow diagrams**
Show paths such as:

##### **User login & farm join flow**
---
Start
   |
Login with Google or Email
   |
Is user in a farm?
  / \
No   Yes
|       |
Create or join farm  -> Open dashboard

##### **Offline sync flow**
```
Action performed offline
     |
Save to local DB
     |
Sync queue
     |
Connection restored -> push pending -> pull latest


##### **Animal lifecycle flow**
---
Create Animal -> Record pregnancy -> Notify expected date -> Birth event -> Add newborn
