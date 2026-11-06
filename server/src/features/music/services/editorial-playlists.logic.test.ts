import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSearchQueries, contentKey, isSingleArtist } from './editorial-playlists.logic';

const song = (id: string, primaryArtist = 'a') => ({ id, primaryArtist });

describe('isSingleArtist', () => {
  it('is true only when one artist has most of the songs', () => {
    assert.ok(isSingleArtist([song('1'), song('2'), song('3', 'b')]));
    assert.ok(!isSingleArtist([song('1'), song('2'), song('3', 'b'), song('4', 'c')]));
    assert.ok(!isSingleArtist([]));
  });
});

describe('contentKey', () => {
  it('ignores song order', () => {
    assert.equal(contentKey([song('1'), song('2')]), contentKey([song('2'), song('1')]));
    assert.notEqual(contentKey([song('1')]), contentKey([song('2')]));
  });
});

describe('buildSearchQueries', () => {
  it('searches each term per language, then each artist in their language', () => {
    const queries = buildSearchQueries(['hindi'], [{ language: 'hindi', artist: 'Arijit Singh' }]);
    assert.ok(queries.includes('romantic hindi'));
    assert.equal(queries.at(-1), 'Arijit Singh hindi');
  });
});
