import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artistsOverlap,
  cleanPlain,
  cleanTitle,
  factsOf,
  lyricsOf,
  parseLrc,
  pickEntry,
  timingLooksReal,
  type LyricsEntry,
  type SongFacts,
} from './lyrics.logic';

const LRC = `[ar: Someone]
[00:01.50] First line
[00:04.00] Second line
[00:06.25]
[00:07.10] Third line
[00:09.00] <00:09.00>Fourth <00:09.50>line`;

/** Lines a few seconds apart from 0:20 to 3:40, as a timed entry of a 268 s song has them. */
const SUNG = Array.from({ length: 40 }, (_, k) => {
  const s = 20 + k * 5;
  return `[${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.40] Line ${k + 1}`;
}).join('\n');
/** The same lines a second apart from 0:00: timed without listening. */
const ONE_A_SECOND = Array.from(
  { length: 40 },
  (_, k) => `[00:${String(k).padStart(2, '0')}.00] Line ${k + 1}`
).join('\n');

const entry = (over: Partial<LyricsEntry>): LyricsEntry => ({
  id: 1,
  trackName: 'Kesariya',
  artistName: 'Arijit Singh',
  albumName: 'Brahmastra',
  duration: 268,
  syncedLyrics: LRC,
  plainLyrics: 'First line\nSecond line',
  ...over,
});

const kesariya: SongFacts = {
  title: 'Kesariya (From &quot;Brahmastra&quot;)',
  artists: ['Arijit Singh', 'Pritam'],
  album: 'Brahmastra',
  duration: 268,
};

describe('cleanTitle', () => {
  it('drops what Saavn adds to titles', () => {
    assert.equal(cleanTitle('Kesariya (From &quot;Brahmastra&quot;)'), 'Kesariya');
    assert.equal(cleanTitle('Sitaare (From "Ikkis")'), 'Sitaare');
    assert.equal(cleanTitle('Payal feat. Paradox'), 'Payal');
    assert.equal(cleanTitle('Song [Remix] - From Film'), 'Song');
  });
});

describe('parseLrc', () => {
  it('reads timed lines in order, keeps one pause and drops word timings', () => {
    assert.deepEqual(parseLrc(LRC), [
      { t: 1500, text: 'First line' },
      { t: 4000, text: 'Second line' },
      { t: 6250, text: '' },
      { t: 7100, text: 'Third line' },
      { t: 9000, text: 'Fourth line' },
    ]);
  });

  it('repeats a line with several tags and applies the offset', () => {
    const lines = parseLrc(
      '[offset:+500]\n[00:10.00][00:20.00]Chorus\n[00:12]A\n[00:14]B\n[00:16]C'
    );
    assert.deepEqual(
      lines?.map((l) => l.t),
      [9500, 11500, 13500, 15500, 19500]
    );
  });

  it('gives up on text with almost no timings', () => {
    assert.equal(parseLrc('[00:01.00] Only\njust text'), null);
    assert.equal(parseLrc(null), null);
  });
});

describe('cleanPlain', () => {
  it("turns Saavn's markup into lines", () => {
    assert.equal(
      cleanPlain('Get down<br>Get down &amp; up<br><br><br>Jungle boogie'),
      'Get down\nGet down & up\n\nJungle boogie'
    );
  });
});

describe('artistsOverlap', () => {
  it('finds a singer in joined credits', () => {
    assert.ok(artistsOverlap(['Sunidhi Chauhan'], 'Vishal-Shekhar/Sunidhi Chauhan/Vishal Dadlani'));
    assert.ok(
      artistsOverlap(['Arijit Singh'], 'Arijit Singh, Amitabh Bhattacharya (Pagalworld.pw)')
    );
    assert.ok(!artistsOverlap(['Jubin Nautiyal'], 'The Rish'));
  });
});

describe('pickEntry', () => {
  it('takes the entry that is this song', () => {
    const picked = pickEntry(kesariya, [
      entry({ id: 2, artistName: 'Some Cover Band', albumName: 'Covers' }),
      entry({ id: 3 }),
    ]);
    assert.equal(picked?.id, 3);
  });

  it('rejects a song of the same name by someone else', () => {
    const barbaad: SongFacts = {
      title: 'Barbaad',
      artists: ['Jubin Nautiyal'],
      album: 'Saiyaara',
      duration: 200,
    };
    assert.equal(
      pickEntry(barbaad, [
        entry({ trackName: 'Barbaad', artistName: 'The Rish', albumName: 'X', duration: 201 }),
      ]),
      null
    );
  });

  it('accepts the same title, length and album when the credits differ', () => {
    const song: SongFacts = {
      title: 'Saiyaara',
      artists: ['Faheem Abdullah'],
      album: 'Saiyaara',
      duration: 371,
    };
    const picked = pickEntry(song, [
      entry({
        trackName: 'Saiyaara',
        artistName: 'Tanishk Bagchi',
        albumName: 'Saiyaara',
        duration: 372,
      }),
    ]);
    assert.ok(picked);
  });

  it('rejects another recording of a different length', () => {
    assert.equal(pickEntry(kesariya, [entry({ duration: 240 })]), null);
  });

  it('skips entries reported wrong', () => {
    assert.equal(pickEntry(kesariya, [entry({ id: 9 })], new Set(['9'])), null);
  });

  it("rejects lyrics in another language's script", () => {
    const pushpa: SongFacts = {
      ...kesariya,
      title: 'Pushpa Pushpa',
      language: 'hindi',
      album: null,
    };
    const tamil =
      '[00:01.00] புஷ்பா புஷ்பா புஷ்பா புஷ்பா\n[00:02.00] புஷ்பா புஷ்பா புஷ்பா\n[00:03.00] a\n[00:04.00] b';
    assert.equal(
      pickEntry(pushpa, [entry({ trackName: 'Pushpa Pushpa', syncedLyrics: tamil })]),
      null
    );
    const hindi =
      '[00:01.00] पुष्पा पुष्पा पुष्पा पुष्पा\n[00:02.00] पुष्पा पुष्पा पुष्पा\n[00:03.00] a\n[00:04.00] b';
    assert.ok(pickEntry(pushpa, [entry({ trackName: 'Pushpa Pushpa', syncedLyrics: hindi })]));
  });

  it('accepts a Hindi song with Punjabi verses in Gurmukhi', () => {
    const haaniya: SongFacts = { ...kesariya, title: 'Haaniya Ve', language: 'hindi', album: null };
    const mixed = [
      '[00:01.00] कोई अखियों से पूछे तो',
      '[00:02.00] ਮੈਂ ਨਾ ਰਹਿਣਾ, ਜੀ ਰਹਿਣਾ ਤੇਰੇ ਬਾਅਦ ਵੇ',
      '[00:03.00] ਛੱਡ ਜਾਣਾ, ਮੈਂ ਜਾਣਾ ਜੱਗ ਸਾਥ ਵੇ',
      '[00:04.00] ਹਾਨੀਆ ਵੇ, ਹਾਨੀਆ ਵੇ',
    ].join('\n');
    assert.ok(pickEntry(haaniya, [entry({ trackName: 'Haaniya Ve', syncedLyrics: mixed })]));
  });

  it('prefers timed lyrics', () => {
    const picked = pickEntry(kesariya, [
      entry({ id: 4, syncedLyrics: null }),
      entry({ id: 5, syncedLyrics: SUNG }),
    ]);
    assert.equal(picked?.id, 5);
  });

  it('prefers timings that follow the song over a matching album', () => {
    const picked = pickEntry(kesariya, [
      entry({ id: 6, syncedLyrics: ONE_A_SECOND }),
      entry({ id: 7, albumName: 'Kesariya - Single', syncedLyrics: SUNG }),
    ]);
    assert.equal(picked?.id, 7);
  });
});

describe('timingLooksReal', () => {
  it('accepts lines sung across the song', () => {
    assert.ok(timingLooksReal(parseLrc(SUNG)!, 268));
  });

  it('rejects a line a second from the start', () => {
    assert.equal(timingLooksReal(parseLrc(ONE_A_SECOND)!, 268), false);
  });

  it('rejects a whole verse per time', () => {
    const verses = Array.from(
      { length: 8 },
      (_, k) =>
        `[0${k}:10.00] Ik din akele the hum tum... Tum mujh mein main tum mein gum... Mere kaanon mein aahista se`
    ).join('\n');
    assert.equal(timingLooksReal(parseLrc(verses)!, 540), false);
  });

  it('keeps an entry with made-up timings as plain words', () => {
    assert.equal(
      lyricsOf(entry({ syncedLyrics: ONE_A_SECOND, plainLyrics: null }), 268)?.kind,
      'plain'
    );
  });
});

describe('lyricsOf', () => {
  it('reads timings kept in the plain text', () => {
    const result = lyricsOf(
      entry({
        syncedLyrics: null,
        plainLyrics: '[00:01.00] a\n[00:02.00] b\n[00:03.00] c\n[00:04.00] d',
      })
    );
    assert.equal(result?.kind, 'synced');
  });
});

describe('factsOf', () => {
  it('matches on singers, not lyricists or actors', () => {
    const facts = factsOf({
      name: 'Kesariya (From &quot;Brahmastra&quot;)',
      duration: '268',
      album: { name: 'Brahmastra' },
      artist_map: {
        artists: [
          { name: 'Amitabh Bhattacharya', role: 'lyricist' },
          { name: 'Arijit Singh', role: 'singer' },
          { name: 'Ranbir Kapoor', role: 'starring' },
        ],
      },
    });
    assert.deepEqual(facts.artists, ['Arijit Singh']);
    assert.equal(facts.album, 'Brahmastra');
    assert.equal(facts.duration, 268);
  });
});
