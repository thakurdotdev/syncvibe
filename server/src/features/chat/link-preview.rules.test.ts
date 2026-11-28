import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstLink, isFetchable, isPublicAddress, parsePreview } from './link-preview.rules';

test('the first web link in a message, without the punctuation after it', () => {
  assert.equal(
    firstLink('see https://example.com/a?b=1.')?.toString(),
    'https://example.com/a?b=1'
  );
  assert.equal(firstLink('(https://example.com/x)')?.toString(), 'https://example.com/x');
  assert.equal(
    firstLink('first http://localhost:3000 then https://example.org')?.toString(),
    'https://example.org/'
  );
  assert.equal(firstLink('no links here'), null);
  assert.equal(firstLink('ftp://example.com/file'), null);
  assert.equal(firstLink(null), null);
});

test('only public addresses can be fetched', () => {
  for (const address of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of [
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::a00:1',
    'not an ip',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('links to this machine, the local network or odd ports are never fetched', () => {
  assert.equal(isFetchable(new URL('https://example.com/page')), true);
  assert.equal(isFetchable(new URL('http://example.com:80/')), true);
  for (const url of [
    'http://localhost/',
    'http://app.localhost/',
    'http://printer.local/',
    'http://intranet/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'http://example.com:8080/',
    'https://user:pass@example.com/',
    'file:///etc/passwd',
  ]) {
    assert.equal(isFetchable(new URL(url)), false, url);
  }
});

test('a page describes itself with Open Graph, then its title and description', () => {
  const url = new URL('https://www.example.com/post');
  const og = parsePreview(
    `<html><head><title>Fallback</title>
      <meta property="og:title" content="Tum Hi Ho &amp; More">
      <meta content='A song &#8212; and its story' property='og:description'>
      <meta property="og:site_name" content="Example Music">
    </head></html>`,
    url
  );
  assert.deepEqual(og, {
    url: 'https://www.example.com/post',
    title: 'Tum Hi Ho & More',
    description: 'A song — and its story',
    siteName: 'Example Music',
  });

  const plain = parsePreview(
    '<title>  Plain\n page </title><meta name="description" content="Words">',
    url
  );
  assert.equal(plain?.title, 'Plain page');
  assert.equal(plain?.description, 'Words');
  assert.equal(plain?.siteName, 'example.com');

  assert.equal(parsePreview('<html><body>nothing</body></html>', url), null);
  const long = parsePreview(`<title>${'a'.repeat(500)}</title>`, url);
  assert.equal(long?.title?.length, 200);
});
