import { MusicTaste } from '@/models/index';
import { cleanTaste, EMPTY_TASTE, type Taste } from './taste.logic';

export { LANGUAGES, type Taste } from './taste.logic';

export const getTaste = async (userId: number): Promise<Taste> => {
  const row = await MusicTaste.findByPk(userId, { raw: true });
  if (!row) return EMPTY_TASTE;
  return {
    languages: row.languages ?? [],
    artists: row.artists ?? [],
    shareListening: row.shareListening ?? true,
  };
};

export const saveTaste = async (
  userId: number,
  input: Partial<Record<keyof Taste, unknown>>
): Promise<Taste> => {
  const taste = cleanTaste(input, await getTaste(userId));
  await MusicTaste.upsert({ userId, ...taste });
  return taste;
};
