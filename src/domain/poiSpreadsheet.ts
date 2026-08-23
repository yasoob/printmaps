import { MAX_MERCATOR_LATITUDE } from './project';
import { isPoiLabelValid, MAX_POI_LABEL_CHARACTERS } from './poiMarkers';

export type PoiSpreadsheetEntry = {
  name: string;
  coordinates: [number, number];
};

export const MAX_POI_SPREADSHEET_ROWS = 300;
export const MAX_POI_SPREADSHEET_CHARACTERS = 64_000;
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

function coordinateValue(value: string, bounds: readonly [number, number], label: string, row: number): number {
  if (!DECIMAL_NUMBER.test(value.trim())) {
    throw new Error(`Spreadsheet row ${row} ${label} must be a decimal number.`);
  }
  const coordinate = Number(value);
  const [minimum, maximum] = bounds;
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    throw new Error(`Spreadsheet row ${row} ${label} must be between ${minimum} and ${maximum}.`);
  }
  return coordinate;
}

export function parsePoiSpreadsheet(value: string): PoiSpreadsheetEntry[] {
  if (value.length > MAX_POI_SPREADSHEET_CHARACTERS) {
    throw new Error(`Paste ${MAX_POI_SPREADSHEET_CHARACTERS.toLocaleString('en-US')} characters or fewer.`);
  }
  const rows = value.split(/\r?\n/u).filter((row) => row.trim());
  const dataRows = rows[0]?.toLowerCase() === 'name\tlongitude\tlatitude' ? rows.slice(1) : rows;
  if (dataRows.length === 0) throw new Error('Paste at least one POI row.');
  if (dataRows.length > MAX_POI_SPREADSHEET_ROWS) {
    throw new Error(`Paste ${MAX_POI_SPREADSHEET_ROWS} rows or fewer.`);
  }
  return dataRows.map((row, index) => {
    const rowNumber = index + 1;
    const columns = row.split('\t');
    if (columns.length !== 3) {
      throw new Error(`Spreadsheet row ${rowNumber} must contain Name, Longitude, and Latitude columns.`);
    }
    const [rawName, longitude, latitude] = columns;
    const name = rawName.trim();
    if (!name || !isPoiLabelValid(name)) {
      throw new Error(`Spreadsheet row ${rowNumber} name must be 1–${MAX_POI_LABEL_CHARACTERS} characters without control characters.`);
    }
    return {
      name,
      coordinates: [
        coordinateValue(longitude, [-180, 180], 'longitude', rowNumber),
        coordinateValue(latitude, [-MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE], 'latitude', rowNumber),
      ],
    };
  });
}
