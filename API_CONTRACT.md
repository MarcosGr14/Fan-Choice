# API CONTRACT SPECIFICATION — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED REST CONTRACT  
> **Base URL:** `/api/v1`  
> **Standard Headers:** `Content-Type: application/json`, `Accept: application/json`  
> **Authentication:** `Authorization: Bearer <JWT_TOKEN>` or Secure HTTP-Only Cookie session

---

## 1. Authentication & Session Endpoints

### 1.1. `POST /api/v1/auth/login`
Authenticates one of the two participants or admin.
- **Request Body:**
```json
{
  "username": "alex",
  "password": "SecretPassword123!"
}
```
- **Response 200 OK:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": "e4b3c9a1-7d2e-4b68-9a3f-1d8c9a2f3e4d",
    "username": "alex",
    "displayName": "Alex",
    "role": "admin",
    "avatarUrl": "/assets/avatars/alex.png"
  }
}
```
- **Errors:** `401 Unauthorized` (Invalid credentials), `429 Too Many Requests` (Rate limit).

### 1.2. `GET /api/v1/auth/me`
Retrieves currently authenticated session.
- **Response 200 OK:** Current user object + active league permissions.

---

## 2. Public / Participant League Endpoints

### 2.1. `GET /api/v1/league/overview`
Retrieves live snapshot for the main competition screen.
- **Query Params:** `?date=YYYY-MM-DD` (Optional, defaults to active competition date in `LEAGUE_TIMEZONE`)
- **Response 200 OK:**
```json
{
  "season": {
    "id": "7fa490a1-8d2b-4299-bbcb-e31e50529d21",
    "name": "Season 2: Autumn Sonic Clash",
    "status": "active",
    "startDate": "2026-09-01",
    "daysActive": 47,
    "timezone": "America/Panama"
  },
  "absoluteChampion": {
    "artistId": "3Nrfpe0tUJi4K4DXYWgMUX",
    "displayName": "BTS",
    "category": "male",
    "totalPoints": 284,
    "totalStreams": 1420,
    "leadMargin": 12,
    "imageUrl": "/assets/images/bts.jpg"
  },
  "maleTop10": [
    {
      "rank": 1,
      "previousRank": 1,
      "rankDelta": 0,
      "isNewEntry": false,
      "artistId": "3Nrfpe0tUJi4K4DXYWgMUX",
      "displayName": "BTS",
      "artistType": "group",
      "musicScene": "kpop",
      "originCountry": "KR",
      "totalSeasonPoints": 284,
      "todayPoints": 9,
      "todayVotePoints": 5,
      "todayListeningBonus": 4,
      "seasonStreams": 1420,
      "todayStreams": 14,
      "imageUrl": "/assets/images/bts.jpg"
    }
  ],
  "femaleTop10": [
    {
      "rank": 1,
      "previousRank": 2,
      "rankDelta": 1,
      "isNewEntry": false,
      "artistId": "6RHTUrOAwM0eu2vNk2697t",
      "displayName": "NewJeans",
      "artistType": "group",
      "musicScene": "kpop",
      "originCountry": "KR",
      "totalSeasonPoints": 272,
      "todayPoints": 10,
      "todayVotePoints": 5,
      "todayListeningBonus": 5,
      "seasonStreams": 1390,
      "todayStreams": 18,
      "imageUrl": "/assets/images/newjeans.jpg"
    }
  ],
  "todayHighlights": {
    "biggestGainer": { "displayName": "Fujii Kaze", "delta": 3 },
    "topDailyPoints": { "displayName": "NewJeans", "points": 10 },
    "newEntries": []
  },
  "syncStatus": {
    "lastSyncTimestamp": "2026-10-17T20:30:00Z",
    "isMockProvider": true,
    "status": "up_to_date"
  }
}
```

### 2.2. `GET /api/v1/votes/today`
Returns the current voting state for the authenticated participant for today.
- **Response 200 OK:**
```json
{
  "competitionDate": "2026-10-17",
  "isLocked": false,
  "secondsRemaining": 7800,
  "timezone": "America/Panama",
  "maleBallot": {
    "status": "saved",
    "items": [
      { "rankPosition": 1, "pointsAwarded": 5, "artistId": "uuid-1", "displayName": "BTS" },
      { "rankPosition": 2, "pointsAwarded": 4, "artistId": "uuid-2", "displayName": "Stray Kids" },
      { "rankPosition": 3, "pointsAwarded": 3, "artistId": "uuid-3", "displayName": "SEVENTEEN" },
      { "rankPosition": 4, "pointsAwarded": 2, "artistId": "uuid-4", "displayName": "Fujii Kaze" },
      { "rankPosition": 5, "pointsAwarded": 1, "artistId": "uuid-5", "displayName": "TXT" }
    ]
  },
  "femaleBallot": {
    "status": "unsubmitted",
    "items": []
  }
}
```

### 2.3. `PUT /api/v1/votes/ballot`
Saves or updates a participant's daily 5-item ballot.
- **Request Body:**
```json
{
  "category": "female",
  "competitionDate": "2026-10-17",
  "items": [
    { "rankPosition": 1, "artistId": "uuid-newjeans" },
    { "rankPosition": 2, "artistId": "uuid-aespa" },
    { "rankPosition": 3, "artistId": "uuid-twice" },
    { "rankPosition": 4, "artistId": "uuid-yoasobi" },
    { "rankPosition": 5, "artistId": "uuid-ive" }
  ]
}
```
- **Validation Rules Enforced on Server:**
  - Season must be `active`.
  - Date must equal `CURRENT_DATE` in `LEAGUE_TIMEZONE`.
  - `items` must have exactly 5 elements.
  - `rankPosition` must uniquely cover {1, 2, 3, 4, 5}.
  - All 5 `artistId` must be unique.
  - All 5 artists must exist, be `approved`, be `is_eligible = true`, and match the payload `category`.
- **Response 200 OK:**
```json
{
  "success": true,
  "message": "Ballot saved successfully",
  "updatedAt": "2026-10-17T21:45:12Z"
}
```
- **Errors:** 
  - `400 Bad Request` (Duplicates, missing positions, invalid category).
  - `403 Forbidden` (Date is locked or season is closed).

---

## 3. Historical Archive Endpoints

### 3.1. `GET /api/v1/archive/seasons`
Lists all archived/closed seasons with high-level summaries.

### 3.2. `GET /api/v1/archive/seasons/:seasonId`
Returns complete frozen results, final Top 10 tables, champion, and audit info for the closed season.

---

## 4. Administrative Endpoints (Role = 'admin')

### 4.1. `POST /api/v1/admin/seasons`
Creates and immediately activates a new season. Fails if another season is active.
- **Request Body:**
```json
{
  "name": "Season 3: Winter Sonic Showdown",
  "description": "Winter clash between Alex and Sam",
  "startDate": "2026-10-18"
}
```

### 4.2. `POST /api/v1/admin/seasons/:seasonId/close`
Atomically closes and seals the season.
- **Request Body:**
```json
{
  "confirmCode": "FREEZE_SEASON",
  "adminNotes": "Official end of Season 2 after 47 days of competition."
}
```
- **Response 200 OK:** Summary of frozen standings, champion, and archive record ID.

### 4.3. `POST /api/v1/admin/artists`
Adds a new artist to the curated catalog.
- **Request Body:**
```json
{
  "spotifyArtistId": "1uNFoZAHBGtllmzznpCI3s",
  "displayName": "Justin Park",
  "category": "male",
  "artistType": "soloist",
  "musicScene": "kpop",
  "originCountry": "KR",
  "imageUrl": "https://..."
}
```

### 4.4. `POST /api/v1/admin/sync/trigger`
Manually triggers listening data ingestion for a given date (idempotent).
