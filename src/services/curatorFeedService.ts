import { SAMPLE_CURATORS, type Curator } from '../data/curators';

export type { Curator, CuratorItem } from '../data/curators';

/** The 추천 tab's source. Never rejects: a failed feed is an empty list. */
export interface CuratorFeedService {
  list(): Promise<Curator[]>;
}

/** Prototype feed bundled with the app (plan P6); a server feed replaces it later. */
export class StaticCuratorFeed implements CuratorFeedService {
  constructor(private readonly load: () => Curator[] | Promise<Curator[]> = () => SAMPLE_CURATORS) {}

  async list(): Promise<Curator[]> {
    try {
      const curators = await this.load();
      return Array.isArray(curators) ? curators : [];
    } catch {
      return [];
    }
  }
}

export const curatorFeedService: CuratorFeedService = new StaticCuratorFeed();
