# SECURITY ARCHITECTURE & THREAT MODEL — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED SECURITY ARCHITECTURE  
> **Audience:** Security Engineers, DevOps, Antigravity Agent.

---

## 1. Threat Modeling & Attack Surfaces

| Threat Vector | Severity | Mitigation Strategy |
| :--- | :---: | :--- |
| **Unauthorized Public Signups** | CRITICAL | Registration endpoints are completely absent. All participants are provisioned manually via DB seed or admin CLI. |
| **Tampering with Other Participant's Ballot** | HIGH | Ballot mutation endpoints strictly bind `participant_id` from the verified session/JWT token, never from the request body. |
| **Retroactive Ballot Alteration** | HIGH | Database check constraints and server middleware reject any write where `competition_date < CURRENT_DATE(LEAGUE_TIMEZONE)`. |
| **Accidental or Malicious Season Freeze** | HIGH | `POST /admin/seasons/:id/close` requires role `'admin'`, CSRF validation, and a specific confirmation passphrase (`FREEZE_SEASON`). |
| **Exposure of Duo Charts Secrets** | CRITICAL | Integration tokens reside purely in server environment variables (`DUO_CHARTS_API_SECRET`). Never bundled in frontend code. |
| **SQL Injection** | CRITICAL | All database queries use parameterized SQL (`$1, $2, ...`) via `pg` or typed ORM. Dynamic string concatenation is banned. |
| **Cross-Site Scripting (XSS)** | MEDIUM | React automated DOM escaping, Content Security Policy (CSP) via Helmet headers. |
| **Brute Force Login** | MEDIUM | Rate limiting on `/api/v1/auth/login` (maximum 5 attempts per 15 minutes per IP). |

---

## 2. Authentication & Authorization Architecture

### 2.1. Password Hashing
- Algorithm: `bcrypt` with minimum work factor of 12 (`saltRounds = 12`).
- Timing attack mitigation: Constant-time comparison via `bcrypt.compare`.

### 2.2. Session Security
- Transport: JSON Web Tokens (JWT) signed with `HS256` or `RS256` using `JWT_SECRET` ($\ge 32$ random bytes).
- Transmission: Secure, HTTP-Only, `SameSite=Strict` cookies or `Authorization: Bearer` header.
- Token Lifetime: Maximum 7 days with optional sliding renewal.

### 2.3. Role-Based Access Control (RBAC)
```typescript
export function requireRole(allowedRoles: ('participant' | 'admin')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}
```

---

## 3. Environment Variable Protection

The following variables must NEVER be checked into version control or logged:
- `DATABASE_URL` (Supabase / Railway connection string)
- `JWT_SECRET`
- `DUO_CHARTS_API_SECRET`
- `ADMIN_INITIAL_PASSWORD`

All variables are declared with dummy values in `.env.example`.
