import { parsePoiSpreadsheet } from '../../src/domain/poiSpreadsheet';

describe('POI spreadsheet parsing', () => {
  it('parses a pasted tab-separated name, longitude, and latitude list', () => {
    expect(parsePoiSpreadsheet([
      'Name\tLongitude\tLatitude',
      'Café Central\t16.3725\t48.2084',
      'Museum Quarter\t16.3599\t48.2034',
    ].join('\n'))).toEqual([
      { name: 'Café Central', coordinates: [16.3725, 48.2084] },
      { name: 'Museum Quarter', coordinates: [16.3599, 48.2034] },
    ]);
  });

  it.each([
    ['missing a column', 'Museum Quarter\t16.3599'],
    ['an empty name', '\t16.3599\t48.2034'],
    ['a non-decimal longitude', 'Museum Quarter\t0x10\t48.2034'],
    ['an out-of-range longitude', 'Museum Quarter\t181\t48.2034'],
    ['an out-of-range latitude', 'Museum Quarter\t16.3599\t86'],
  ])('rejects a row with %s', (_label, row) => {
    expect(() => parsePoiSpreadsheet(row)).toThrow(/row 1/iu);
  });

  it('rejects more than 300 pasted POIs before parsing the batch', () => {
    const rows = Array.from({ length: 301 }, (_, index) => `POI ${index + 1}\t16.37\t48.21`);
    expect(() => parsePoiSpreadsheet(rows.join('\n'))).toThrow(/300 rows or fewer/iu);
  });

  it('rejects oversized raw input before splitting rows', () => {
    expect(() => parsePoiSpreadsheet(' '.repeat(64_001))).toThrow(/64,000 characters or fewer/iu);
  });

  it.each([
    ['a C1 control', `Hidden\u{0085}name\t16.37\t48.21`],
    ['a bidirectional formatting control', `Hidden\u{202E}name\t16.37\t48.21`],
  ])('rejects a name containing %s', (_label, row) => {
    expect(() => parsePoiSpreadsheet(row)).toThrow(/control characters/iu);
  });

  it.each(['', 'Name\tLongitude\tLatitude'])('rejects a spreadsheet without POI rows', (value) => {
    expect(() => parsePoiSpreadsheet(value)).toThrow(/at least one/iu);
  });
});
