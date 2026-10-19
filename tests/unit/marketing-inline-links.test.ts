import { assertInlineTarget, parseInline, stripInline } from '../../src/marketing/inlineLinks';

describe('marketing inline links', () => {
  it('splits text and internal links', () => {
    expect(parseInline('See the [GPX map maker](/gpx-map-maker/) or [the FAQ](#questions).')).toEqual([
      { kind: 'text', text: 'See the ' },
      { kind: 'link', text: 'GPX map maker', href: '/gpx-map-maker/' },
      { kind: 'text', text: ' or ' },
      { kind: 'link', text: 'the FAQ', href: '#questions' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps plain text and markup-looking text as text segments', () => {
    expect(parseInline('<b>A3</b> [not a link] (300 dpi)')).toEqual([{ kind: 'text', text: '<b>A3</b> [not a link] (300 dpi)' }]);
  });

  it('accepts registered pages, the homepage, the editor and anchors on them', () => {
    for (const href of ['/', '/editor/', '/gpx-map-maker/', '/gpx-map-maker/#questions', '#how-it-works']) {
      expect(() => assertInlineTarget(href, 'test')).not.toThrow();
    }
  });

  it('rejects unknown pages, external URLs and scriptable targets', () => {
    for (const text of ['[x](/no-such-page/)', '[x](https://example.com/)', '[x](javascript:alert(1))', '[x](/gpx-map-maker)', '[x](#bad"id)']) {
      expect(() => parseInline(text), text).toThrow();
    }
  });

  it('strips links to their labels for plain-text outputs', () => {
    expect(stripInline('Read the [size guide](/printable-map-maker/#sizes) first.')).toBe('Read the size guide first.');
  });
});
