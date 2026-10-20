import type { IdolSubmission } from '../types/idols';
// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: PERSISTENT STATE REPOSITORY STORE
// ==============================================================================

import {
  Artist,
  Season,
  Participant,
  DailyBallot,
  DailyArtistListeningRecord,
  ArtistDailyScore,
  ArtistCumulativeStats,
  ArchivedSeasonRecord,
  Category,
  SyncStatus,
  SeasonFrozenResult,
} from '../types';
import {
  INITIAL_PARTICIPANTS,
  INITIAL_ARTISTS,
  ACTIVE_SEASON,
  SAMPLE_HISTORICAL_SEASON,
  INITIAL_BALLOTS,
  MALE_AVATAR_IMG,
  FEMALE_AVATAR_IMG,
} from '../data/mockData';
import {
  computeDailyScores,
  rankLadder,
  determineAbsoluteChampion,
} from '../engine/scoringEngine';
import { CONFIG } from '../config';
import { hashPassword } from '../services/passwordHash';
import { PostgresPersistence } from './postgresPersistence';

export class LeagueStore {
  public idolSubmissions: IdolSubmission[] = [];
  public participants: Map<string, Participant & { passwordHash: string }> = new Map();
  public artists: Map<string, Artist> = new Map();
  public seasons: Map<string, Season> = new Map();
  public activeSeasonId: string = ACTIVE_SEASON.id;
  public ballots: Map<string, DailyBallot> = new Map(); // key: `${participantId}-${category}-${date}`
  public dailyListening: Map<string, DailyArtistListeningRecord[]> = new Map(); // key: date
  public dailyScores: Map<string, Map<string, ArtistDailyScore>> = new Map(); // date -> (artistId -> score)
  public archivedSeasons: Map<string, ArchivedSeasonRecord> = new Map();
  public lastSyncInfo = {
    timestamp: new Date().toISOString(),
    isMock: true,
    status: 'success' as SyncStatus,
    totalRecords: 24,
  };

  // null = modo demo (todo en memoria, con los datos de mockData.ts)
  private persistence: PostgresPersistence | null = null;

  constructor() {
    this.seedInitialState();
  }

  private seedInitialState() {
    // Participants: Alex (admin), Sam (participant)
    // Password for both in dev/demo is 'LeaguePass2026!' (guardada con hash, no en texto plano)
    const demoPasswordHash = hashPassword('LeaguePass2026!');
    for (const p of INITIAL_PARTICIPANTS) {
      this.participants.set(p.username, {
        ...p,
        passwordHash: demoPasswordHash,
      });
    }

    // Curated catalog
    for (const a of INITIAL_ARTISTS) {
      this.artists.set(a.id, a);
    }

    // Seasons
    this.seasons.set(ACTIVE_SEASON.id, { ...ACTIVE_SEASON });
    this.archivedSeasons.set(SAMPLE_HISTORICAL_SEASON.season.id, { ...SAMPLE_HISTORICAL_SEASON });

    // Initial ballots
    for (const b of INITIAL_BALLOTS) {
      const key = `${b.participantId}-${b.category}-${b.competitionDate}`;
      this.ballots.set(key, { ...b });
    }
  }

  // --- PERSISTENCIA (POSTGRES / SUPABASE) ---

  isPersistent(): boolean {
    return this.persistence !== null;
  }

  /**
   * Si hay DATABASE_URL, reemplaza los datos de ejemplo por los de la base de datos
   * (participantes, artistas, temporadas, votos y streams) y, a partir de ahí,
   * guarda los cambios en ella. Sin DATABASE_URL no hace nada (modo demo).
   * Debe llamarse una vez, antes de que el servidor empiece a escuchar.
   */
  async initFromDatabase(): Promise<void> {
    if (!CONFIG.DATABASE_URL) {
      console.log('[LeagueStore] Sin DATABASE_URL: usando datos de ejemplo en memoria (modo demo).');
      return;
    }
    if (CONFIG.JWT_SECRET_IS_DEFAULT) {
      throw new Error(
        'Con base de datos real hace falta un JWT_SECRET propio en el .env (el valor por defecto está en el código y permitiría falsificar tokens).'
      );
    }

    const persistence = this.persistence || new PostgresPersistence(CONFIG.DATABASE_URL);
    try {
      await persistence.ping();

      const [participants, artists, seasons] = await Promise.all([
        persistence.loadParticipants(),
        persistence.loadArtists(),
        persistence.loadSeasons(),
      ]);
      const activeSeason = seasons.find((s) => s.status === 'active');
      const ballots = activeSeason ? await persistence.loadBallots(activeSeason.id) : [];
      const listening = await persistence.loadListeningByDate();
      const lastSync = await persistence.loadLastSync();
      const archives = await persistence.loadArchives();
      const idolSubmissions = await persistence.loadIdolSubmissions();
      this.idolSubmissions = idolSubmissions;

      // Reemplazar por completo el estado de ejemplo
      this.participants.clear();
      this.artists.clear();
      this.seasons.clear();
      this.ballots.clear();
      this.dailyListening.clear();
      this.dailyScores.clear();
      this.archivedSeasons.clear();
      for (const archive of archives) this.archivedSeasons.set(archive.season.id, archive);

      for (const p of participants) this.participants.set(p.username, p);
      for (const a of artists) {
        this.artists.set(a.id, { ...a, imageUrl: a.imageUrl || '' });
      }
      for (const s of seasons) this.seasons.set(s.id, s);
      this.activeSeasonId = activeSeason ? activeSeason.id : '';
      for (const b of ballots) {
        this.ballots.set(`${b.participantId}-${b.category}-${b.competitionDate}`, b);
      }
      const scoringDates = new Set([...listening.keys(), ...ballots.map((b) => b.competitionDate)]);
      for (const date of scoringDates) {
        this.applyListeningRecords(date, listening.get(date) || []);
      }

      this.lastSyncInfo = {
        timestamp: lastSync ? lastSync.timestamp : new Date().toISOString(),
        isMock: CONFIG.USE_MOCK_LISTENING_DATA,
        status: lastSync ? lastSync.status : 'partial',
        totalRecords: lastSync ? lastSync.totalRecords : 0,
      };

      this.persistence = persistence;
      if (!this.initialized) console.log(
        `[LeagueStore] Cargado desde Postgres: ${participants.length} participantes, ${artists.length} artistas, ` +
          `${seasons.length} temporadas, ${ballots.length} papeletas, ${listening.size} días con streams.`
      );
      if (!activeSeason && !this.initialized) {
        console.warn('[LeagueStore] AVISO: no hay ninguna temporada activa en la base de datos.');
      }
      this.initialized = true;
    } catch (err) {
      if (!this.persistence) await persistence.close().catch(() => undefined);
      throw err;
    }
  }

  private initialized = false;
  private workQueue: Promise<unknown> = Promise.resolve();

  async withFreshState<T>(work: () => Promise<T>): Promise<T> {
    const run = this.workQueue.then(async () => {
      if (!this.persistence) return work();
      return this.persistence.withLock(async () => {
        await this.initFromDatabase();
        return work();
      });
    });
    this.workQueue = run.catch(() => undefined);
    return run;
  }

  async saveIdolSubmission(submission: IdolSubmission) {
    if (this.persistence) await this.persistence.saveIdolSubmission(submission);
    this.idolSubmissions.push(submission);
  }

  async createSeasonPersisted(season: Season) {
    if (this.persistence) await this.persistence.createSeason(season);
    this.seasons.set(season.id, season);
    this.activeSeasonId = season.id;
    this.ballots.clear();
    for (const [date, records] of this.dailyListening) this.applyListeningRecords(date, records);
  }

  async addArtistPersisted(artist: Artist) {
    if (this.persistence) await this.persistence.addArtist(artist);
    this.addArtist(artist);
    for (const [date, records] of this.dailyListening) this.applyListeningRecords(date, records);
  }

  async archiveSeasonPersisted(record: ArchivedSeasonRecord, results: SeasonFrozenResult[]) {
    if (this.persistence) await this.persistence.archiveSeason(record, results);
    this.seasons.set(record.season.id, record.season);
    this.archivedSeasons.set(record.season.id, record);
    this.activeSeasonId = '';
  }

  async saveListeningRange(from: string, to: string, byDate: Map<string,DailyArtistListeningRecord[]>) {
    const rows: any[]=[];
    for(const [date,records] of byDate) {
      const scores=computeDailyScores(this.getAllArtists(),this.getAllBallotsForDate(date),records,date);
      for(const record of records) {
        const artist=this.getArtistBySpotifyId(record.spotifyArtistId);
        if (!artist || !artist.isEligible || artist.status!=='approved') continue;
        rows.push({artist_id:artist.id,competition_date:date,account_1_streams:record.account1Streams,account_2_streams:record.account2Streams,combined_streams:record.combinedStreams,bonus:scores.get(artist.id)?.listeningBonus || 0,image_url:record.imageUrl || null});
      }
    }
    if(this.persistence) await this.persistence.saveListeningRange(from,to,rows,[...byDate.keys()]);
    for(const [date,records] of byDate) this.applyListeningRecords(date,records);
    return rows.length;
  }

  private lifetimeSnapshot: {snapshot: unknown; fetchedAt: string} | null = null;
  async loadLifetime() {
    return this.persistence ? this.persistence.loadLifetime() : this.lifetimeSnapshot;
  }
  async saveLifetime(snapshot: unknown) {
    if (this.persistence) await this.persistence.saveLifetime(snapshot);
    this.lifetimeSnapshot = {snapshot, fetchedAt: new Date().toISOString()};
  }

  async successfulSyncDates(): Promise<Set<string>> {
    return this.persistence ? this.persistence.loadSuccessfulSyncDates() : new Set(this.dailyListening.keys());
  }

  async close(): Promise<void> {
    if (this.persistence) {
      await this.persistence.close();
      this.persistence = null;
    }
  }

  /** Registra una ejecución de sincronización (no interrumpe nada si falla). */
  async logSyncRun(run: {
    targetDate: string;
    providerName: string;
    status: SyncStatus;
    recordsProcessed: number;
    errorMessage?: string;
    durationMs: number;
  }): Promise<void> {
    if (!this.persistence) return;
    try {
      await this.persistence.logSyncRun(run);
    } catch (err: any) {
      console.error('[LeagueStore] No se pudo registrar la ejecución en sync_runs:', err.message);
    }
  }

  // --- PARTICIPANTS ---
  getParticipantByUsername(username: string) {
    return this.participants.get(username.toLowerCase());
  }

  getParticipantById(id: string) {
    for (const p of this.participants.values()) {
      if (p.id === id) return p;
    }
    return undefined;
  }

  // --- SEASONS ---
  getActiveSeason(): Season | undefined {
    for (const s of this.seasons.values()) {
      if (s.status === 'active') return s;
    }
    return undefined;
  }

  getAllSeasons(): Season[] {
    return Array.from(this.seasons.values());
  }

  // --- ARTISTS ---
  getAllArtists(): Artist[] {
    return Array.from(this.artists.values());
  }

  getArtistById(id: string): Artist | undefined {
    return this.artists.get(id);
  }

  getArtistBySpotifyId(spotifyArtistId: string): Artist | undefined {
    for (const a of this.artists.values()) {
      if (a.spotifyArtistId === spotifyArtistId) return a;
    }
    return undefined;
  }

  addArtist(artist: Artist) {
    this.artists.set(artist.id, artist);
  }

  // --- BALLOTS ---
  getBallot(participantId: string, category: Category, competitionDate: string): DailyBallot | undefined {
    return this.ballots.get(`${participantId}-${category}-${competitionDate}`);
  }

  async saveBallot(ballot: DailyBallot) {
    if (this.persistence) await this.persistence.saveBallot(ballot);
    const key = `${ballot.participantId}-${ballot.category}-${ballot.competitionDate}`;
    this.ballots.set(key, ballot);
    this.applyListeningRecords(ballot.competitionDate, this.getListeningRecords(ballot.competitionDate));
  }

  getAllBallotsForDate(competitionDate: string): DailyBallot[] {
    const list: DailyBallot[] = [];
    for (const b of this.ballots.values()) {
      if (b.competitionDate === competitionDate) {
        list.push(b);
      }
    }
    return list;
  }

  // --- LISTENING RECORDS & SCORING ---

  /** Guarda en memoria y recalcula los puntajes del día (idempotente). */
  private applyListeningRecords(
    competitionDate: string,
    records: DailyArtistListeningRecord[]
  ): Map<string, ArtistDailyScore> {
    this.dailyListening.set(competitionDate, records);

    const allArtists = this.getAllArtists();
    const ballots = this.getAllBallotsForDate(competitionDate);
    const scores = computeDailyScores(allArtists, ballots, records, competitionDate);
    this.dailyScores.set(competitionDate, scores);
    return scores;
  }

  /** Versión síncrona: guarda en memoria y deja la escritura a Postgres en segundo plano. */
  saveListeningRecords(competitionDate: string, records: DailyArtistListeningRecord[]) {
    const scores = this.applyListeningRecords(competitionDate, records);

    if (this.persistence) {
      this.persistence
        .saveListeningStats(competitionDate, records, scores, (id) => this.getArtistBySpotifyId(id))
        .catch((err: any) => {
          console.error(`[LeagueStore] No se pudieron guardar los streams de ${competitionDate} en Postgres:`, err.message);
        });
    }
  }

  /**
   * Versión para la sincronización: espera a que Postgres confirme el guardado y
   * lanza error si falla, para que la sincronización se reporte como fallida.
   */
  async saveListeningRecordsPersisted(
    competitionDate: string,
    records: DailyArtistListeningRecord[]
  ): Promise<{ saved: number; ignored: number }> {
    const scores = computeDailyScores(this.getAllArtists(), this.getAllBallotsForDate(competitionDate), records, competitionDate);
    const result = this.persistence
      ? await this.persistence.saveListeningStats(competitionDate, records, scores, (id) => this.getArtistBySpotifyId(id))
      : { saved: records.length, ignored: 0 };
    for (const record of records) {
      const artist = this.getArtistBySpotifyId(record.spotifyArtistId);
      if (artist && record.imageUrl) artist.imageUrl = record.imageUrl;
    }
    this.applyListeningRecords(competitionDate, records);
    return result;
  }

  getListeningRecords(competitionDate: string): DailyArtistListeningRecord[] {
    return this.dailyListening.get(competitionDate) || [];
  }

  // --- LEAGUE STANDINGS CALCULATION ---
  computeCumulativeStandings(targetDate?: string): {
    maleStats: ArtistCumulativeStats[];
    femaleStats: ArtistCumulativeStats[];
    absoluteChampion: ArtistCumulativeStats | null;
  } {
    const allArtists = this.getAllArtists();
    const activeSeason = this.getActiveSeason();
    const endDate = targetDate || new Intl.DateTimeFormat('en-CA', {
      timeZone: CONFIG.LEAGUE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    const statsMap = new Map<string, ArtistCumulativeStats>();

    // Initialize stats
    for (const artist of allArtists) {
      if (!artist.isEligible || artist.status !== 'approved') continue;
      statsMap.set(artist.id, {
        artist,
        cumulativePoints: 0,
        cumulativeVotePoints: 0,
        cumulativeBonusPoints: 0,
        cumulativeStreams: 0,
        daysWithPoints: 0,
        firstPlaceVotesCount: 0,
        todayPoints: 0,
        todayVotePoints: 0,
        todayListeningBonus: 0,
        todayStreams: 0,
        currentRank: 0,
        previousRank: 0,
        rankDelta: 0,
        isNewEntry: false,
      });
    }

    // Accumulate across all days up to targetDate
    for (const [date, scoresForDate] of this.dailyScores.entries()) {
      if (!activeSeason || date < activeSeason.startDate || date > endDate) continue;

      const isToday = date === endDate;

      for (const [artistId, score] of scoresForDate.entries()) {
        const stats = statsMap.get(artistId);
        if (!stats) continue;

        stats.cumulativePoints += score.totalDailyPoints;
        stats.cumulativeVotePoints += score.votePoints;
        stats.cumulativeBonusPoints += score.listeningBonus;
        stats.cumulativeStreams += score.dailyStreams;

        if (score.totalDailyPoints > 0) {
          stats.daysWithPoints += 1;
        }

        if (isToday) {
          stats.todayPoints = score.totalDailyPoints;
          stats.todayVotePoints = score.votePoints;
          stats.todayListeningBonus = score.listeningBonus;
          stats.todayStreams = score.dailyStreams;
        }
      }
    }

    // Count first place finishes across ballots
    for (const b of this.ballots.values()) {
      if (!activeSeason || b.seasonId !== activeSeason.id || b.competitionDate < activeSeason.startDate || b.competitionDate > endDate) continue;
      for (const item of b.items) {
        if (item.rankPosition === 1) {
          const stats = statsMap.get(item.artistId);
          if (stats) stats.firstPlaceVotesCount += 1;
        }
      }
    }

    const maleStatsList = Array.from(statsMap.values()).filter((s) => s.artist.category === 'male');
    const femaleStatsList = Array.from(statsMap.values()).filter((s) => s.artist.category === 'female');

    const rankedMale = rankLadder(maleStatsList);
    const rankedFemale = rankLadder(femaleStatsList);
    const absoluteChampion = determineAbsoluteChampion([...rankedMale, ...rankedFemale]);

    return {
      maleStats: rankedMale,
      femaleStats: rankedFemale,
      absoluteChampion,
    };
  }
}

export const leagueStore = new LeagueStore();