import type { IdolSubmission } from '../types/idols';
// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: CAPA DE PERSISTENCIA EN POSTGRES (SUPABASE)
// ==============================================================================
// Lee y escribe las tablas de la migración 001. El LeagueStore sigue trabajando
// en memoria (lecturas síncronas); esta capa solo carga al arrancar y guarda
// los cambios.

import pg from 'pg';
import { CONFIG } from '../config';
import {
  Artist,
  ArchivedSeasonRecord,
  SeasonFrozenResult,
  Season,
  Participant,
  DailyBallot,
  DailyArtistListeningRecord,
  ArtistDailyScore,
  Category,
  SyncStatus,
} from '../types';

// Las columnas DATE (oid 1082) se devuelven como texto 'YYYY-MM-DD', no como Date.
pg.types.setTypeParser(1082, (value: string) => value);

export type ParticipantRecord = Participant & { passwordHash: string };

function todayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000) + 1);
}

function isoOrUndefined(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

export class PostgresPersistence {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
    this.pool.on('error', (err) => {
      console.error('[PostgresPersistence] Error inesperado en el pool:', err.message);
    });
  }

  async withLock<T>(work: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '30s'");
      await client.query('SELECT pg_advisory_xact_lock(726481)');
      const result = await work();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async loadIdolSubmissions(): Promise<IdolSubmission[]> {
    try {
      const { rows } = await this.pool.query('SELECT season_id,participant_id,kind,category,competition_date,idol_ids FROM idol_submissions');
      return rows.map(r => ({seasonId:r.season_id,participantId:r.participant_id,kind:r.kind,category:r.category,competitionDate:r.competition_date,idolIds:r.idol_ids}));
    } catch (error: any) {
      // Keep the existing league available until migration 004 has been applied.
      if (error.code === '42P01') return [];
      throw error;
    }
  }

  async saveIdolSubmission(s: IdolSubmission) {
    await this.pool.query('INSERT INTO idol_submissions (season_id,participant_id,kind,category,competition_date,idol_ids) VALUES ($1,$2,$3,$4,$5,$6)',
      [s.seasonId,s.participantId,s.kind,s.category,s.competitionDate,JSON.stringify(s.idolIds)]);
  }

  async loadArchives(): Promise<ArchivedSeasonRecord[]> {
    const { rows } = await this.pool.query("SELECT payload_after FROM audit_log WHERE action = 'season_closed' ORDER BY created_at DESC");
    return rows.map(r => r.payload_after as ArchivedSeasonRecord);
  }

  async createSeason(season: Season): Promise<void> {
    await this.pool.query('INSERT INTO seasons (id,name,description,status,start_date) VALUES ($1,$2,$3,$4,$5)',
      [season.id, season.name, season.description || null, season.status, season.startDate]);
  }

  async addArtist(a: Artist): Promise<void> {
    await this.pool.query(`INSERT INTO artists_catalog
      (id,spotify_artist_id,display_name,search_normalized_name,image_url,category,artist_type,group_type,music_scene,origin_country,status,is_eligible,eligibility_effective_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [a.id,a.spotifyArtistId,a.displayName,a.searchNormalizedName,a.imageUrl || null,a.category,a.artistType,a.groupType || null,a.musicScene,a.originCountry,a.status,a.isEligible,a.eligibilityEffectiveDate]);
  }

  async archiveSeason(record: ArchivedSeasonRecord, results: SeasonFrozenResult[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query("UPDATE seasons SET status='archived',closed_at=$2,closed_by=$3,updated_at=NOW() WHERE id=$1 AND status='active' RETURNING id",
        [record.season.id,record.closedAt,record.season.closedBy]);
      if (!updated.rowCount) throw new Error('La temporada ya no está activa.');
      for (const r of results) {
        await client.query(`INSERT INTO season_results (season_id,artist_id,category,final_rank,is_category_champion,is_absolute_champion,final_points,total_vote_points,total_bonus_points,total_streams,days_scored)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [record.season.id,r.artistId,r.category,r.finalRank,r.isCategoryChampion,r.isAbsoluteChampion,r.finalPoints,r.totalVotePoints,r.totalBonusPoints,r.totalStreams,r.daysScored]);
      }
      await client.query("UPDATE daily_votes SET is_locked=true WHERE season_id=$1", [record.season.id]);
      await client.query("INSERT INTO audit_log (participant_id,action,target_entity,target_id,payload_after) VALUES ($1,'season_closed','seasons',$2,$3)",
        [record.season.closedBy,record.season.id,JSON.stringify(record)]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async saveListeningRange(from: string, to: string, rows: any[], dates: string[]) {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM daily_listening_stats WHERE competition_date BETWEEN $1 AND $2',[from,to]);
      await client.query(`INSERT INTO daily_listening_stats (artist_id,competition_date,account_1_streams,account_2_streams,combined_streams,calculated_bonus_points,data_status)
        SELECT artist_id,competition_date,account_1_streams,account_2_streams,combined_streams,bonus,'available'
        FROM jsonb_to_recordset($1::jsonb) AS x(artist_id uuid,competition_date date,account_1_streams int,account_2_streams int,combined_streams int,bonus int)`,[JSON.stringify(rows)]);
      await client.query(`UPDATE artists_catalog a SET image_url=x.image_url,updated_at=NOW() FROM
        (SELECT DISTINCT ON (artist_id) artist_id,image_url FROM jsonb_to_recordset($1::jsonb) AS r(artist_id uuid,image_url text,competition_date date)
         WHERE image_url IS NOT NULL ORDER BY artist_id,competition_date DESC) x WHERE a.id=x.artist_id`,[JSON.stringify(rows)]);
      await client.query(`INSERT INTO sync_runs (target_date,provider_name,status,records_processed,execution_duration_ms)
        SELECT d,'SpotifyDuoChartsProvider','success',(SELECT count(*) FROM daily_listening_stats WHERE competition_date=d),0 FROM unnest($1::date[]) d`,[dates]);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }

  async loadLifetime() {
    const { rows } = await this.pool.query('SELECT payload, fetched_at FROM lifetime_listening_snapshot WHERE id=1');
    return rows[0] ? { snapshot: rows[0].payload, fetchedAt: new Date(rows[0].fetched_at).toISOString() } : null;
  }

  async saveLifetime(snapshot: unknown) {
    await this.pool.query(`INSERT INTO lifetime_listening_snapshot (id,payload) VALUES (1,$1)
      ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,fetched_at=NOW()`, [JSON.stringify(snapshot)]);
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ---------------------------------------------------------------- CARGA ---

  async loadParticipants(): Promise<ParticipantRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, username, display_name, role, password_hash, avatar_url
       FROM participants ORDER BY created_at, username`
    );
    return rows.map((r: any) => ({
      id: r.id,
      username: String(r.username).toLowerCase(),
      displayName: r.display_name,
      role: r.role,
      avatarUrl: r.avatar_url || undefined,
      passwordHash: r.password_hash,
    }));
  }

  async loadArtists(): Promise<Artist[]> {
    const { rows } = await this.pool.query(
      `SELECT id, spotify_artist_id, display_name, search_normalized_name, image_url,
              category, artist_type, group_type, music_scene, origin_country,
              status, is_eligible, eligibility_effective_date
       FROM artists_catalog ORDER BY display_name`
    );
    return rows.map((r: any) => ({
      id: r.id,
      spotifyArtistId: r.spotify_artist_id,
      displayName: r.display_name,
      searchNormalizedName: r.search_normalized_name,
      imageUrl: r.image_url || '',
      category: r.category,
      artistType: r.artist_type,
      groupType: r.group_type || undefined,
      musicScene: r.music_scene,
      originCountry: r.origin_country,
      status: r.status,
      isEligible: r.is_eligible,
      eligibilityEffectiveDate: r.eligibility_effective_date,
    }));
  }

  async loadSeasons(): Promise<Season[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, status, start_date, closed_at, closed_by
       FROM seasons ORDER BY start_date, created_at`
    );
    const today = todayInTimezone(CONFIG.LEAGUE_TIMEZONE);
    return rows.map((r: any) => {
      const closedAt = isoOrUndefined(r.closed_at);
      const endDate = closedAt ? closedAt.slice(0, 10) : today;
      return {
        id: r.id,
        name: r.name,
        description: r.description || undefined,
        status: r.status,
        startDate: r.start_date,
        closedAt,
        closedBy: r.closed_by || undefined,
        daysActive: daysBetweenInclusive(r.start_date, endDate),
      };
    });
  }

  async loadBallots(seasonId: string): Promise<DailyBallot[]> {
    const votes = await this.pool.query(
      `SELECT id, season_id, participant_id, category, competition_date, is_locked, updated_at
       FROM daily_votes WHERE season_id = $1`,
      [seasonId]
    );
    const items = await this.pool.query(
      `SELECT i.daily_vote_id, i.artist_id, i.rank_position, i.points_awarded
       FROM daily_vote_items i
       JOIN daily_votes v ON v.id = i.daily_vote_id
       WHERE v.season_id = $1
       ORDER BY i.daily_vote_id, i.rank_position`,
      [seasonId]
    );

    const itemsByVote = new Map<string, DailyBallot['items']>();
    for (const it of items.rows as any[]) {
      const list = itemsByVote.get(it.daily_vote_id) || [];
      list.push({
        rankPosition: it.rank_position,
        artistId: it.artist_id,
        pointsAwarded: it.points_awarded,
      });
      itemsByVote.set(it.daily_vote_id, list);
    }

    return (votes.rows as any[]).map((v) => ({
      id: v.id,
      seasonId: v.season_id,
      participantId: v.participant_id,
      category: v.category as Category,
      competitionDate: v.competition_date,
      isLocked: v.is_locked,
      items: itemsByVote.get(v.id) || [],
      updatedAt: isoOrUndefined(v.updated_at) as string,
    }));
  }

  async loadListeningByDate(): Promise<Map<string, DailyArtistListeningRecord[]>> {
    const { rows } = await this.pool.query(
      `SELECT s.competition_date, s.account_1_streams, s.account_2_streams,
              s.combined_streams, s.data_status, a.spotify_artist_id, a.display_name
       FROM daily_listening_stats s
       JOIN artists_catalog a ON a.id = s.artist_id
       ORDER BY s.competition_date, a.display_name`
    );
    const byDate = new Map<string, DailyArtistListeningRecord[]>();
    for (const r of rows as any[]) {
      const list = byDate.get(r.competition_date) || [];
      list.push({
        spotifyArtistId: r.spotify_artist_id,
        artistName: r.display_name,
        competitionDate: r.competition_date,
        account1Streams: r.account_1_streams,
        account2Streams: r.account_2_streams,
        combinedStreams: r.combined_streams,
        dataStatus: r.data_status,
      });
      byDate.set(r.competition_date, list);
    }
    return byDate;
  }

  async loadSuccessfulSyncDates(): Promise<Set<string>> {
    const { rows } = await this.pool.query("SELECT DISTINCT target_date FROM sync_runs WHERE status='success'");
    return new Set(rows.map(r => r.target_date));
  }

  async loadLastSync(): Promise<{timestamp: string; totalRecords: number; status: SyncStatus} | null> {
    const { rows } = await this.pool.query('SELECT created_at,records_processed,status FROM sync_runs ORDER BY created_at DESC LIMIT 1');
    return rows.length ? {timestamp: isoOrUndefined(rows[0].created_at)!, totalRecords: rows[0].records_processed, status: rows[0].status} : null;
  }

  // -------------------------------------------------------------- GUARDADO ---

  /** Guarda (o reemplaza) la papeleta de un participante para una categoría y día. */
  async saveBallot(ballot: DailyBallot): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO daily_votes (season_id, participant_id, category, competition_date, is_locked)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT uq_participant_daily_vote
         DO UPDATE SET is_locked = EXCLUDED.is_locked, updated_at = NOW()
         RETURNING id`,
        [ballot.seasonId, ballot.participantId, ballot.category, ballot.competitionDate, ballot.isLocked]
      );
      const voteId = rows[0].id;
      await client.query('DELETE FROM daily_vote_items WHERE daily_vote_id = $1', [voteId]);
      for (const item of ballot.items) {
        await client.query(
          `INSERT INTO daily_vote_items (daily_vote_id, artist_id, rank_position, points_awarded)
           VALUES ($1, $2, $3, $4)`,
          [voteId, item.artistId, item.rankPosition, item.pointsAwarded]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reemplaza los streams de un día (idempotente: repetir la sincronización no suma).
   * Los artistas que no están en el catálogo se ignoran.
   */
  async saveListeningStats(
    competitionDate: string,
    records: DailyArtistListeningRecord[],
    scores: Map<string, ArtistDailyScore> | undefined,
    resolveArtist: (spotifyArtistId: string) => Artist | undefined
  ): Promise<{ saved: number; ignored: number }> {
    const rowsByArtist = new Map<string, { record: DailyArtistListeningRecord; artistId: string }>();
    let ignored = 0;
    for (const record of records) {
      const artist = resolveArtist(record.spotifyArtistId);
      if (!artist) {
        ignored += 1;
        continue;
      }
      rowsByArtist.set(artist.id, { record, artistId: artist.id });
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM daily_listening_stats WHERE competition_date = $1', [competitionDate]);
      for (const { record, artistId } of rowsByArtist.values()) {
        if (record.imageUrl) await client.query('UPDATE artists_catalog SET image_url=$2,updated_at=NOW() WHERE id=$1', [artistId,record.imageUrl]);
        const bonus = scores?.get(artistId)?.listeningBonus ?? 0;
        await client.query(
          `INSERT INTO daily_listening_stats
             (artist_id, competition_date, account_1_streams, account_2_streams,
              combined_streams, calculated_bonus_points, data_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            artistId,
            competitionDate,
            record.account1Streams,
            record.account2Streams,
            record.combinedStreams,
            bonus,
            record.dataStatus,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    return { saved: rowsByArtist.size, ignored };
  }

  async logSyncRun(run: {
    targetDate: string;
    providerName: string;
    status: SyncStatus;
    recordsProcessed: number;
    errorMessage?: string;
    durationMs: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO sync_runs
         (target_date, provider_name, status, records_processed, error_message, execution_duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        run.targetDate,
        run.providerName,
        run.status,
        run.recordsProcessed,
        run.errorMessage || null,
        Math.round(run.durationMs),
      ]
    );
  }
}