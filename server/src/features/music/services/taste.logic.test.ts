import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanTaste, EMPTY_TASTE } from './taste.logic';

describe('cleanTaste', () => {
  it('keeps known languages once, in lower case, and drops the rest', () => {
    const taste = cleanTaste(
      { languages: ['Hindi', 'hindi', 'klingon', 3, ' punjabi '] },
      EMPTY_TASTE
    );
    assert.deepEqual(taste.languages, ['hindi', 'punjabi']);
  });

  it('keeps well-formed artists once each and leaves fields that were not sent', () => {
    const current = { ...EMPTY_TASTE, languages: ['english'] };
    const taste = cleanTaste(
      {
        artists: [
          { id: '1', name: 'Arijit Singh', image: 'https://x/y.jpg' },
          { id: '1', name: 'Arijit Singh' },
          { id: 2, name: 'Bad id' },
          { id: '3', name: '   ' },
        ],
      },
      current
    );
    assert.deepEqual(
      taste.artists.map((artist) => artist.id),
      ['1']
    );
    assert.deepEqual(taste.languages, ['english']);
    assert.equal(taste.shareListening, true);
  });

  it('only changes sharing when a boolean is sent', () => {
    assert.equal(cleanTaste({ shareListening: 'no' }, EMPTY_TASTE).shareListening, true);
    assert.equal(cleanTaste({ shareListening: false }, EMPTY_TASTE).shareListening, false);
  });
});
