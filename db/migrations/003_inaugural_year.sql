-- Requested baseline for Season 1. Does not change subsequent or archived seasons.
BEGIN;
SELECT pg_advisory_xact_lock(726481);
UPDATE seasons SET start_date='2026-01-01',updated_at=NOW()
WHERE id='7fa490a1-8d2b-4299-bbcb-e31e50529d21' AND status='active';
UPDATE artists_catalog SET eligibility_effective_date='2026-01-01',updated_at=NOW()
WHERE spotify_artist_id IN ('7nqOGRxlXj7N2JYbgNEjYH','1khChLj7REGqjM043PlYyn','2jOm3cYujQx6o1dxuiuqaX','2F4oTJOWkcD1JaTeKEa9h6','3KonOYiLsU53m4yT7gNotP','6F4yXjmhQBqo6HVr6K234k','5qRSs6mvI17zrkJpOHkCoM','5t5FqBwTcgKTaWmfEbwQY9','0UntV1Bw2hk3fbRrm9eMP6','3olOSNzFWX5z21YMEFFVMw','4WndMgZGitK4uQdKcmVHua','6y9nlaoynxSvoTGY09Vdcy','5DIi2JWfQPTKffaVBlIYRn','7n2Ycct7Beij7Dj7meI4X0','28ot3wh4oNmoFOdVajibBl','0LOK81e9H5lr61HlGGHqwA','2uxeKIw5ancTu92x28Ctkf','3D2TVeexyIXOtc8F4qEZ6P','1z4g3DjTBBZKhvAroFlhOM','63sat2XSMKdwKfqspmYQKP','6YVMFz59CuY7ngCxTxjpxE','6RHTUrRF63xao58xh9FXYJ','4SpbR6yFEvexJuaBpgAU5p','7fNeWBcx24ttY7l6TxFDJx','5deOsjuFTKrNMJW3rKuL8S','6HvZYsbFfjnjFrWF950C9d','6AkddQqEu75QRbsCo12zce','7F1iAHRYxR3MY7yAEuFqgL','0qtqWLjAkheu9MaVCQ3FXa')
AND EXISTS (SELECT 1 FROM seasons WHERE id='7fa490a1-8d2b-4299-bbcb-e31e50529d21' AND status='active');
COMMIT;
