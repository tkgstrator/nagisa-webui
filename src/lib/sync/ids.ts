import { v5 as uuidv5 } from 'uuid'

/** UUIDv5 NAMESPACE。scripts/db/seed.ts と同一値。 */
export const ID_NAMESPACE = uuidv5('animetracker', uuidv5.DNS)
export const animeUuid = (provider: string, contentId: string) => uuidv5(`${provider}:${contentId}`, ID_NAMESPACE)
export const seasonUuid = (provider: string, contentId: string, seasonStableId: string) =>
  uuidv5(`${provider}:${contentId}:${seasonStableId}`, ID_NAMESPACE)
export const episodeUuid = (provider: string, contentId: string, seasonStableId: string, episodeNumber: number) =>
  uuidv5(`${provider}:${contentId}:${seasonStableId}:${episodeNumber}`, ID_NAMESPACE)
