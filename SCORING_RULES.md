# SCORING RULES SPECIFICATION — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED MATHEMATICAL SPECIFICATION  
> **Audience:** Software Engineers, QA, Antigravity Agent.

---

## 1. Daily Point Sources

An artist's daily score for any calendar date $D$ within an active season $S$ is strictly defined as:

$$\text{Daily Points}(A, D) = \text{Vote Points}(A, D) + \text{Listening Bonus}(A, D)$$

---

## 2. Daily Ballot Points

Each authorized participant ($P_1, P_2$) registers a strict ranked ballot of 5 unique artists per category:

| Ballot Position | Points Awarded |
| :---: | :---: |
| **1st Place** | **5 pts** |
| **2nd Place** | **4 pts** |
| **3rd Place** | **3 pts** |
| **4th Place** | **2 pts** |
| **5th Place** | **1 pt** |

### Category Aggregation:
$$\text{Vote Points}(A, D) = \text{Points}_{P_1}(A, D) + \text{Points}_{P_2}(A, D)$$

- **Maximum Daily Vote Points per Artist:** $5 + 5 = 10\text{ pts}$ (achieved if both participants rank the artist #1).
- **Minimum Daily Vote Points:** $0\text{ pts}$ (if unranked by both participants).

---

## 3. Spotify Verified Listening Bonus

The bonus is computed using the **combined daily streams** across both participants' Spotify accounts for the calendar date $D$.

### Tiered Bonus Mapping:

| Combined Daily Streams ($S_D$) | Bonus Points Awarded | Rationale |
| :---: | :---: | :--- |
| **0 streams** | **0 pts** | No verified listening activity |
| **1 – 2 streams** | **1 pt** | Casual listening signal |
| **3 – 5 streams** | **2 pts** | Moderate daily rotation |
| **6 – 9 streams** | **3 pts** | High daily engagement |
| **10 – 15 streams** | **4 pts** | Heavy streaming session |
| **16+ streams** | **5 pts** | Fanatic / repeat loop maximum cap |

- **Maximum Daily Listening Bonus per Artist:** $5\text{ pts}$.
- **Maximum Combined Daily Points per Artist:** $10 + 5 = 15\text{ pts}$.

### Delayed Data Ingestion & Idempotency Rule:
- If Spotify scrobbles for date $D$ arrive late, or if a sync runs multiple times for the same date:
  $$\text{New Daily Score} = \text{Recalculate}(Ballots_D, Streams_D^{\text{latest}})$$
- The database update **replaces** the existing daily score row for $(Season, Artist, D)$; it **never adds** on top. Cumulative season points are updated via `SUM(total_daily_points)`.

---

## 4. Cumulative Season Points

For an active season with competition dates $\{D_1, D_2, \dots, D_N\}$:

$$\text{Season Points}(A) = \sum_{i=1}^{N} \text{Daily Points}(A, D_i)$$

$$\text{Season Streams}(A) = \sum_{i=1}^{N} \text{Combined Streams}(A, D_i)$$

---

## 5. Deterministic Tie-Breaking Algorithm

When two or more artists share identical total season points, ties are broken using this strict, deterministic cascade:

1. **Primary Criterion:** Total Cumulative Season Points ($\downarrow$).
2. **Tie-Breaker 1 (Vote Dominance):** Total cumulative points earned strictly through participant votes ($\downarrow$).
3. **Tie-Breaker 2 (Verified Stream Volume):** Total cumulative combined streams during the season ($\downarrow$).
4. **Tie-Breaker 3 (Consistency):** Number of distinct competition days where the artist earned $\ge 1$ point ($\downarrow$).
5. **Tie-Breaker 4 (Top Placement Frequency):** Number of times the artist was ranked 1st place (5 pts) on any ballot ($\downarrow$).
6. **Tie-Breaker 5 (Lexicographical Stability):** Alphabetical comparison of canonical `spotify_artist_id` ascending ($A \rightarrow Z$). Guarantees 100% stable ordering with zero randomness.

---

## 6. Absolute League Champion

The **Absolute League Champion** is the single artist with the highest score across **both** Male and Female categories.
- Evaluated over the full population of approved competing artists.
- Applies the exact same 5-step deterministic tie-breaking cascade.
- Displayed prominently in the Hero Banner on the primary interface.
