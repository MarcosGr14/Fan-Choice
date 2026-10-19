// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: VOTING SERVICE
// ==============================================================================

import { Category, DailyBallot, BallotItem, Artist } from '../types';

export interface SubmitBallotInput {
  seasonId: string;
  participantId: string;
  category: Category;
  items: Array<{ rankPosition: 1 | 2 | 3 | 4 | 5; artistId: string }>;
  competitionDate?: string; // YYYY-MM-DD
  currentTime?: Date;
  timezone?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class VotingService {
  private timezone: string;

  constructor(timezone: string = 'America/Panama') {
    this.timezone = timezone;
  }

  /**
   * Calculates the current competition date string (YYYY-MM-DD) in the league timezone.
   */
  getCompetitionDate(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }

  /**
   * Checks whether the voting window for a given competition date is still open.
   * Lockout occurs at 23:59:59.999 local league time.
   */
  isVotingOpen(competitionDate: string, currentTime: Date = new Date()): boolean {
    const today = this.getCompetitionDate(currentTime);
    // Voting is strictly open for the active calendar date in league timezone
    return competitionDate === today;
  }

  /**
   * Pure validation for ballot submissions.
   */
  validateBallot(
    input: SubmitBallotInput,
    approvedCatalog: Map<string, Artist>
  ): ValidationResult {
    const errors: string[] = [];

    // 1. Verify category
    if (input.category !== 'male' && input.category !== 'female') {
      errors.push(`Categoría inválida: '${input.category}'. Debe ser 'male' o 'female'.`);
    }

    // 2. Verify item count (must be exactly 5)
    if (!Array.isArray(input.items) || input.items.length !== 5) {
      errors.push(`La papeleta debe contener exactamente 5 artistas seleccionados (se recibieron ${input.items?.length || 0}).`);
      return { isValid: false, errors };
    }

    // 3. Verify unique artists
    const artistIds = new Set<string>();
    const positions = new Set<number>();

    for (const item of input.items) {
      if (!item || typeof item.artistId !== 'string' || !Number.isInteger(item.rankPosition)) {
        errors.push('Cada selección necesita un artista y una posición entera.');
        continue;
      }
      if (artistIds.has(item.artistId)) {
        errors.push(`Artista duplicado en la papeleta: ${item.artistId}. Cada artista debe ser único.`);
      }
      artistIds.add(item.artistId);

      if (positions.has(item.rankPosition)) {
        errors.push(`Posición duplicada en la papeleta: #${item.rankPosition}. Cada posición (1 al 5) debe ser única.`);
      }
      positions.add(item.rankPosition);

      if (item.rankPosition < 1 || item.rankPosition > 5) {
        errors.push(`Posición fuera de rango: #${item.rankPosition}. Debe estar entre 1 y 5.`);
      }

      // 4. Validate artist in catalog
      const artist = approvedCatalog.get(item.artistId);
      if (!artist) {
        errors.push(`El artista ID '${item.artistId}' no existe en el catálogo aprobado.`);
      } else {
        if (!artist.isEligible || artist.status !== 'approved' || artist.eligibilityEffectiveDate > (input.competitionDate || this.getCompetitionDate(input.currentTime))) {
          errors.push(`El artista '${artist.displayName}' no está actualmente elegible para competir.`);
        }
        if (artist.category !== input.category) {
          errors.push(
            `Conflicto de categoría: el artista '${artist.displayName}' pertenece a '${artist.category}', pero se vota en '${input.category}'.`
          );
        }
      }
    }

    // Verify all 5 positions (1..5) are present
    for (let pos = 1; pos <= 5; pos++) {
      if (!positions.has(pos)) {
        errors.push(`Falta la posición obligatoria #${pos} en la papeleta.`);
      }
    }

    // 5. Verify daily voting window
    const targetDate = input.competitionDate || this.getCompetitionDate(input.currentTime);
    if (!this.isVotingOpen(targetDate, input.currentTime)) {
      errors.push(`El período de votación para el día ${targetDate} está cerrado.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Constructs the normalized DailyBallot with points awarded per position.
   */
  buildBallot(input: SubmitBallotInput): DailyBallot {
    const targetDate = input.competitionDate || this.getCompetitionDate(input.currentTime);

    const pointsMapping: Record<number, 5 | 4 | 3 | 2 | 1> = {
      1: 5,
      2: 4,
      3: 3,
      4: 2,
      5: 1,
    };

    const ballotItems: BallotItem[] = input.items.map((item) => ({
      rankPosition: item.rankPosition,
      artistId: item.artistId,
      pointsAwarded: pointsMapping[item.rankPosition],
    }));

    return {
      id: `ballot-${input.participantId}-${input.category}-${targetDate}`,
      seasonId: input.seasonId,
      participantId: input.participantId,
      category: input.category,
      competitionDate: targetDate,
      isLocked: false,
      items: ballotItems,
      updatedAt: (input.currentTime || new Date()).toISOString(),
    };
  }
}
