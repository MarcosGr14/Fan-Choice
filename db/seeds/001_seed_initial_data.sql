-- ==============================================================================
-- K-POP / J-POP RANKINGS LEAGUE: SEED 001 — DATOS INICIALES (lista de Marcos)
-- PostgreSQL 15+ compatible. Se puede ejecutar más de una vez sin duplicar nada.
-- ==============================================================================

-- 1. PARTICIPANTES (Marcos y Jackie)
-- password_hash = '!SIN_CONTRASENA' NO es un hash válido: nadie puede iniciar
-- sesión hasta que se asigne una contraseña real (se hace en un paso aparte,
-- para no escribir contraseñas en un archivo que va a Git).
INSERT INTO participants (username, display_name, role, password_hash)
VALUES
    ('marcos', 'Marcos', 'admin',       '!SIN_CONTRASENA'),
    ('jackie', 'Jackie', 'participant', '!SIN_CONTRASENA')
ON CONFLICT (username) DO NOTHING;

-- 2. CATÁLOGO DE ARTISTAS (los spotify_artist_id salen de los enlaces de Spotify
-- que pasó Marcos; los marcados con "ID verificado" además coinciden con el
-- endpoint de Duo Charts).
-- image_url = NULL donde no se tiene la imagen: se completa con la sincronización.
INSERT INTO artists_catalog (
    spotify_artist_id, display_name, search_normalized_name, image_url,
    category, artist_type, group_type, music_scene, origin_country, status, is_eligible
) VALUES

-- === MALE: BOY GROUPS K-POP ===
('7nqOGRxlXj7N2JYbgNEjYH', 'SEVENTEEN',       'seventeen svt',               'https://i.scdn.co/image/ab6761610000e5eb8da3a229445fd3cd896cdd5c', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('1khChLj7REGqjM043PlYyn', 'Xdinary Heroes',  'xdinary heroes',              'https://i.scdn.co/image/ab6761610000e5eb167548a8688859d1a18a26cc', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('2jOm3cYujQx6o1dxuiuqaX', 'RIIZE',           'riize',                       'https://i.scdn.co/image/ab6761610000e5eb50c63abdb4c2f17093aaf63f', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('2F4oTJOWkcD1JaTeKEa9h6', 'LNGSHOT',         'lngshot longshot',            'https://i.scdn.co/image/ab6761610000e5eb866f74c2edeb8dad4ffd7b7d', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('3KonOYiLsU53m4yT7gNotP', 'TREASURE',        'treasure',                    'https://i.scdn.co/image/ab6761610000e5eb4b4f8f2f8b8a9557d5dcfde2', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('6F4yXjmhQBqo6HVr6K234k', 'KickFlip',        'kickflip',                    'https://i.scdn.co/image/ab6761610000e5eb892aed520cc8b9e93b9edc19', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('5qRSs6mvI17zrkJpOHkCoM', 'iKON',            'ikon',                        'https://i.scdn.co/image/ab6761610000e5eb8eb5e57e526ceb14f06ea203', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),
('5t5FqBwTcgKTaWmfEbwQY9', 'ENHYPEN',         'enhypen enha',                'https://i.scdn.co/image/ab6761610000e5ebf28334d02274b673b8201299', 'male', 'group', 'boy_group', 'kpop', 'KR', 'approved', TRUE),

-- === MALE: SOLISTAS K-POP ===
('0UntV1Bw2hk3fbRrm9eMP6', 'B.I',             'b i bi',                      'https://i.scdn.co/image/ab6761610000e5eb4e2e216c2b0cea636899333a', 'male', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE),
('3olOSNzFWX5z21YMEFFVMw', 'EVAN',            'evan',                        'https://i.scdn.co/image/ab6761610000e5eb9f00604281900d1181fc79ce', 'male', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE),
('4WndMgZGitK4uQdKcmVHua', 'YUTA',            'yuta',                        'https://i.scdn.co/image/ab6761610000e5eb04e0db7ed45ebcb1d345c71a', 'male', 'soloist', NULL, 'kpop', 'JP', 'approved', TRUE),
('6y9nlaoynxSvoTGY09Vdcy', 'WOODZ',           'woodz',                       'https://i.scdn.co/image/ab6761610000e5ebbca2d3a56c90d3a50fb0597d', 'male', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE),
('5DIi2JWfQPTKffaVBlIYRn', 'SIK-K',           'sik k sikk',                  'https://i.scdn.co/image/ab6761610000e5eb1a6cc6e3939ab528f3b4feea', 'male', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE),

-- === FEMALE: GIRL GROUPS K-POP ===
('7n2Ycct7Beij7Dj7meI4X0', 'TWICE',           'twice',                       'https://i.scdn.co/image/ab6761610000e5eb3d8820046fd455b38d644864', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('28ot3wh4oNmoFOdVajibBl', 'NMIXX',           'nmixx',                       'https://i.scdn.co/image/ab6761610000e5ebf5cc61db85f105ac0873ac8f', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('0LOK81e9H5lr61HlGGHqwA', 'XG',              'xg',                          'https://i.scdn.co/image/ab6761610000e5eb3402cc21386cdeb1608ebb37', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('2uxeKIw5ancTu92x28Ctkf', 'tuide',           'tuide',                       'https://i.scdn.co/image/ab6761610000e5eb379a57f438c5baa648fd75aa', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('3D2TVeexyIXOtc8F4qEZ6P', 'Girlset',         'girlset',                     'https://i.scdn.co/image/ab6761610000e5eb4c08e6667f9516db37cccd4e', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('1z4g3DjTBBZKhvAroFlhOM', 'Red Velvet',      'red velvet',                  'https://i.scdn.co/image/ab6761610000e5ebd6c6537054755d396684e629', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('63sat2XSMKdwKfqspmYQKP', 'KiiiKiii',        'kiiikiii',                    'https://i.scdn.co/image/ab6761610000e5ebbb46a2477f053c63ff093867', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('6YVMFz59CuY7ngCxTxjpxE', 'aespa',           'aespa',                       'https://i.scdn.co/image/ab6761610000e5eb053bbb910dda6d4ab0618b8b', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('6RHTUrRF63xao58xh9FXYJ', 'IVE',             'ive',                         'https://i.scdn.co/image/ab6761610000e5ebe9134cc9371327f8238b1840', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('4SpbR6yFEvexJuaBpgAU5p', 'LE SSERAFIM',     'le sserafim',                 'https://i.scdn.co/image/ab6761610000e5ebd4037f03c5f92e7e6ea89b9e', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('7fNeWBcx24ttY7l6TxFDJx', 'Alice Syndrome',  'alice syndrome',              'https://i.scdn.co/image/ab6761610000e5ebb46c743bc16a5fd5f4606237', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('5deOsjuFTKrNMJW3rKuL8S', 'RESCENE',         'rescene',                     'https://i.scdn.co/image/ab6761610000e5eb34198dac17e0f63b61c49c36', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),
('6HvZYsbFfjnjFrWF950C9d', 'NewJeans',        'newjeans nj',                 'https://i.scdn.co/image/ab6761610000e5eb841bdcf28a956f3a384ffcf4', 'female', 'group', 'girl_group', 'kpop', 'KR', 'approved', TRUE),

-- === FEMALE: SOLISTAS K-POP ===
('6AkddQqEu75QRbsCo12zce', 'Yves',            'yves',                        'https://i.scdn.co/image/ab6761610000e5eb6722c8f24981d997089d1dfd', 'female', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE),
('7F1iAHRYxR3MY7yAEuFqgL', 'Jihyo',           'jihyo',                       'https://i.scdn.co/image/ab6761610000e5eb23bc8f178f9fd3e56f6f6a27', 'female', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE),
('0qtqWLjAkheu9MaVCQ3FXa', 'Chaeyoung',       'chaeyoung',                   'https://i.scdn.co/image/ab6761610000e5ebe1fd23eadc9b6e668bffa77f', 'female', 'soloist', NULL, 'kpop', 'KR', 'approved', TRUE)

ON CONFLICT (spotify_artist_id) DO UPDATE
SET display_name           = EXCLUDED.display_name,
    search_normalized_name = EXCLUDED.search_normalized_name,
    image_url              = COALESCE(EXCLUDED.image_url, artists_catalog.image_url),
    category               = EXCLUDED.category,
    artist_type            = EXCLUDED.artist_type,
    group_type             = EXCLUDED.group_type,
    music_scene            = EXCLUDED.music_scene,
    origin_country         = EXCLUDED.origin_country,
    updated_at             = NOW();

-- 3. TEMPORADA INAUGURAL
INSERT INTO seasons (id, name, description, status, start_date)
VALUES (
    '7fa490a1-8d2b-4299-bbcb-e31e50529d21',
    'Season 1: Sonic Genesis',
    'Inaugural competitive season for the K-pop / J-pop Rankings League.',
    'active',
    CURRENT_DATE
)
ON CONFLICT DO NOTHING;