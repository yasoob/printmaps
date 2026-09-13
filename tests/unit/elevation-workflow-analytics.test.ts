import { ElevationProfileSession } from '../../src/app/elevation/ElevationProfileSession';
import type { ProfileRouteBinding } from '../../src/app/elevation/profileSessionTypes';
import type { ElevationProfile } from '../../src/elevation/profile';
import { deferred, recordWorkflowAnalytics } from './workflowAnalyticsTestUtils';

const { events, gtag } = recordWorkflowAnalytics();
const binding: ProfileRouteBinding = {
  coordinates: [[16, 48], [17, 49]], name: 'Private route name', color: '#123456', kind: 'straight',
};
const profile: ElevationProfile = {
  samples: [{ coordinate: [16, 48], distanceMeters: 0, elevationMeters: 100 }],
  totalDistanceMeters: 1000, minimumElevationMeters: 100, maximumElevationMeters: 120,
  totalAscentMeters: 20, totalDescentMeters: 0, sourceLabel: 'Copernicus DEM GLO-90 via Open-Meteo',
};
const fileContents = JSON.stringify({
  type: 'Feature', properties: { name: 'Private route source' },
  geometry: { type: 'LineString', coordinates: [[17, 49], [18, 50]] },
});

it('tracks only explicit terrain jobs and suppresses late outcomes after cancellation', async () => {
  const pending = deferred<ElevationProfile>();
  const loadProfile = vi.fn().mockResolvedValueOnce(profile)
    .mockRejectedValueOnce(new Error('Private provider reason')).mockReturnValueOnce(pending.promise);
  const session = new ElevationProfileSession(binding, { loadProfile });
  session.syncRoute({ ...binding, name: 'Another private title' });
  session.suspend();
  session.resume();
  expect(events()).toEqual([]);
  await session.generate();
  await session.generate();
  const canceled = session.generate();
  session.cancelTerrain();
  pending.resolve(profile);
  await canceled;
  session.dispose();
  expect(events()).toEqual([
    { action: 'elevationStarted' }, { action: 'elevationCompleted' },
    { action: 'elevationStarted' }, { action: 'elevationFailed' },
    { action: 'elevationStarted' }, { action: 'elevationCancelled' },
  ]);
});

it('reports private elevation source imports without treating a successful source change as cancellation', async () => {
  const session = new ElevationProfileSession(binding);
  await session.chooseFile(new File([fileContents], 'Private.geojson'));
  await session.chooseFile(new File(['Private invalid data'], 'Private.gpx'));
  const pending = deferred<string>();
  const file = new File([], 'Private.kml');
  vi.spyOn(file, 'text').mockReturnValue(pending.promise);
  const canceled = session.chooseFile(file);
  session.cancelFile();
  pending.resolve(fileContents);
  await canceled;
  expect(events()).toEqual([
    { action: 'elevationImportStarted', format: 'geojson', source: 'file' },
    { action: 'elevationImportCompleted', format: 'geojson', source: 'file' },
    { action: 'elevationImportStarted', format: 'gpx', source: 'file' },
    { action: 'elevationImportFailed', format: 'gpx', source: 'file' },
    { action: 'elevationImportStarted', format: 'kml', source: 'file' },
    { action: 'elevationImportCancelled', format: 'kml', source: 'file' },
  ]);
  session.dispose();
});

it('tracks completed, failed and retired elevation exports without leaking route or chart contents', async () => {
  const pending = deferred<Blob>();
  const createBlob = vi.fn().mockResolvedValueOnce(new Blob(['Private chart']))
    .mockRejectedValueOnce(new Error('Private render failure')).mockReturnValueOnce(pending.promise);
  const download = vi.fn();
  const session = new ElevationProfileSession(binding, { loadProfile: async () => profile, createBlob, download });
  await session.generate();
  gtag.mockClear();
  await session.export('svg');
  await session.export('png');
  const canceled = session.export('pdf');
  session.dispose();
  pending.resolve(new Blob(['Private stale chart']));
  await canceled;
  expect(download).toHaveBeenCalledOnce();
  expect(events()).toEqual([
    { action: 'elevationExportStarted', format: 'svg' }, { action: 'elevationExportCompleted', format: 'svg' },
    { action: 'elevationExportStarted', format: 'png' }, { action: 'elevationExportFailed', format: 'png' },
    { action: 'elevationExportStarted', format: 'pdf' }, { action: 'elevationExportCancelled', format: 'pdf' },
  ]);
});
