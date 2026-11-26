import { api } from '@/utils/hooks/useApi';

export interface LyricLine {
  /** Milliseconds from the start of the song. */
  t: number;
  text: string;
}

export type Lyrics =
  | { kind: 'synced'; lines: LyricLine[]; source: string }
  | { kind: 'plain'; text: string; source: string }
  | { kind: 'none' };

export const getLyrics = async (songId: string): Promise<Lyrics> =>
  (await api.get(`/api/music/lyrics/${encodeURIComponent(songId)}`)).data?.data ?? {
    kind: 'none',
  };

/** Says these are another song's lyrics; the server looks again and answers with what it found. */
export const reportLyrics = async (songId: string): Promise<Lyrics> =>
  (await api.post(`/api/music/lyrics/${encodeURIComponent(songId)}/report`)).data?.data ?? {
    kind: 'none',
  };
