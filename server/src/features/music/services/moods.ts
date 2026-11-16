/**
 * Moods, read from the names of editor-made playlists ("Best Of Romance - Hindi", "Intense
 * Workout"). Audio alone couldn't tell moods apart in testing; editors' lists can.
 * Patterns are Postgres regular expressions, matched case-insensitively.
 */
export interface Mood {
  key: string;
  title: string;
  pattern: string;
}

export const MOODS: Mood[] = [
  { key: 'romantic', title: 'Romantic', pattern: '(love|romantic|romance|ishq|pyaar|valentine)' },
  { key: 'sad', title: 'Sad', pattern: '(sad|heartbreak|broken|breakup|dard|tears|bewafa)' },
  { key: 'party', title: 'Party', pattern: '(party|dance|club|bhangra|wedding|shaadi)' },
  {
    key: 'chill',
    title: 'Chill',
    pattern: '(lo-?fi|chill|unplugged|acoustic|calm|relax|soft|sleep|rain|monsoon)',
  },
  { key: 'workout', title: 'Workout', pattern: '(workout|gym|treadmill|running|cardio)' },
  { key: 'hiphop', title: 'Hip hop', pattern: '(hip ?hop|rap)' },
  {
    key: 'retro',
    title: 'Retro',
    pattern: '(retro|old is gold|golden|classic|evergreen|[0-9]0s|purane)',
  },
  {
    key: 'devotional',
    title: 'Bhakti',
    pattern:
      '(devotional|bhakti|bhajan|aart[iy]|devi geet|chhath|mantra|krishna|shiv|hanuman|ganesh|navratri)',
  },
];

export const moodByKey = (key: string): Mood | undefined => MOODS.find((mood) => mood.key === key);
