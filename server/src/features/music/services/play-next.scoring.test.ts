import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasPlausibleLength,
  hasVariantTag,
  isVersionOfSeed,
  rankWithDiversity,
  scoreSong,
  type SongEntry,
} from './play-next.scoring';

const song = (overrides: Partial<SongEntry> = {}): SongEntry => ({
  id: 1,
  songId: 'a',
  name: 'Song',
  singers: [],
  musicDirectors: [],
  lyricists: [],
  albumName: '',
  albumId: '',
  language: 'hindi',
  duration: 240,
  playCount: 0,
  year: 0,
  isVariant: false,
  ...overrides,
});

describe('isVersionOfSeed', () => {
  it('catches copies, covers and remixes of the playing song', () => {
    assert.ok(isVersionOfSeed('Hanuman Chalisa', 'Hanuman Chalisa'));
    assert.ok(isVersionOfSeed('Raataan Lambiyan (Lofi Flip)', 'Raataan Lambiyan'));
    assert.ok(isVersionOfSeed('Munbe Vaa - Cover Version', 'Munbe Vaa'));
    assert.ok(isVersionOfSeed('New York X Munbe Vaa', 'Munbe Vaa'));
    assert.ok(isVersionOfSeed('Kala Chashma Club Mix DJ Notorious', 'Kala Chashma'));
    assert.ok(isVersionOfSeed('Kala Chashma', 'Kala Chashma Club Mix DJ Notorious'));
    assert.ok(isVersionOfSeed('Saiyaara Reprise - Female', 'Saiyaara'));
  });

  it('leaves different songs alone', () => {
    assert.ok(!isVersionOfSeed('Tum Hi Aana', 'Tum Hi Ho'));
    assert.ok(!isVersionOfSeed('Baarish Ban Jaana', 'Baarish'));
    assert.ok(!isVersionOfSeed('Aashiqui 2 Mashup', 'Tum Hi Ho'));
  });
});

describe('hasVariantTag', () => {
  it('recognises variant titles', () => {
    assert.ok(hasVariantTag('9XM Smashup # 55'));
    assert.ok(hasVariantTag('Saturday Saturday (Sped Up)'));
    assert.ok(hasVariantTag('Sanam Re (Lounge Mix)'));
    assert.ok(hasVariantTag('Mere Dil Mein (Dialogue Version)'));
  });

  it('does not match words that only contain a tag', () => {
    assert.ok(!hasVariantTag('Mixed Feelings'));
    assert.ok(!hasVariantTag('Trapped'));
  });
});

describe('hasPlausibleLength', () => {
  it('keeps long tracks away from normal songs', () => {
    assert.ok(!hasPlausibleLength(song({ duration: 1716 }), song({ duration: 230 })));
    assert.ok(!hasPlausibleLength(song({ duration: 30 }), song({ duration: 230 })));
  });

  it('lets long tracks follow long tracks, and keeps songs of unknown length', () => {
    assert.ok(hasPlausibleLength(song({ duration: 3201 }), song({ duration: 723 })));
    assert.ok(hasPlausibleLength(song({ duration: 0 }), song({ duration: 230 })));
  });
});

describe('scoreSong', () => {
  const seed = song({ singers: ['arijit singh'], musicDirectors: ['pritam'] });

  it('ignores how long a song is', () => {
    const short = scoreSong(song({ singers: ['arijit singh'], duration: 200 }), seed);
    const long = scoreSong(song({ singers: ['arijit singh'], duration: 280 }), seed);
    assert.equal(short, long);
  });

  it('never lets co-listening outweigh a shared singer', () => {
    const coListenedOnly = scoreSong(song(), seed, 1000);
    const sameSinger = scoreSong(song({ singers: ['arijit singh'] }), seed);
    assert.ok(sameSinger > coListenedOnly);
  });

  it('keeps a shared singer from pulling in another language', () => {
    const otherLanguage = scoreSong(song({ singers: ['arijit singh'], language: 'tamil' }), seed);
    const sameLanguage = scoreSong(song({ singers: ['arijit singh'] }), seed);
    assert.ok(otherLanguage < 25, 'below the minimum score');
    assert.ok(sameLanguage > otherLanguage);
  });
});

describe('scoreSong with playlist links', () => {
  const seed = song({ singers: ['arijit singh'] });

  it('adds points for a link, up to a cap', () => {
    const none = scoreSong(song(), seed);
    assert.equal(scoreSong(song(), seed, 0, 0.25) - none, 30);
    assert.equal(scoreSong(song(), seed, 0, 5) - none, 70);
  });

  it('lets a strong link beat a shared singer alone', () => {
    const strongLink = scoreSong(song(), seed, 0, 0.5);
    const sharedSinger = scoreSong(song({ singers: ['arijit singh'] }), seed);
    assert.ok(strongLink > sharedSinger);
  });
});

describe('rankWithDiversity', () => {
  const item = (songId: string, score: number, topSinger: string, name = songId) => ({
    songId,
    score,
    name,
    topSinger,
  });

  it('keeps strong matches above weak ones from other singers', () => {
    const ranked = rankWithDiversity(
      [
        item('a1', 100, 'a'),
        item('a2', 90, 'a'),
        item('b1', 80, 'b'),
        item('c1', 30, 'c'),
        item('d1', 20, 'd'),
      ],
      5
    );
    assert.deepEqual(ranked, ['a1', 'b1', 'a2', 'c1', 'd1']);
  });

  it('caps songs per singer and drops repeated titles', () => {
    const ranked = rankWithDiversity(
      [
        item('1', 9, 'a'),
        item('2', 8, 'a'),
        item('3', 7, 'a'),
        item('4', 6, 'a'),
        item('5', 5, 'a'),
        item('6', 4, 'b', '1'),
      ],
      10
    );
    assert.deepEqual(ranked, ['1', '2', '3', '4']);
  });

  it('respects the limit', () => {
    assert.equal(rankWithDiversity([item('a', 2, 'a'), item('b', 1, 'b')], 1).length, 1);
  });
});
