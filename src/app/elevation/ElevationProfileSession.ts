import { loadElevationProfile } from '../../elevation/profile';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import { downloadBlob } from '../../lib/downloadBlob';
import { mapDataImportFormat } from '../hooks/useMapDataImportAnalytics';
import { createProfileBlob, profileFilename, readProfileRoute, type ProfileExportFormat } from './profileSessionIo';
import {
  createProfileSettings, isProfileInteger, profileChartOptions, profileError,
  type LocalProfileRoute, type ProfileLoader, type ProfileRouteBinding, type ProfileSessionState, type ProfileSettings,
} from './profileSessionTypes';

type Dependencies = {
  loadProfile?: ProfileLoader;
  createBlob?: typeof createProfileBlob;
  download?: typeof downloadBlob;
};

function sameCoordinates(a: ProfileRouteBinding['coordinates'], b: ProfileRouteBinding['coordinates']) {
  return a === b || (a !== null && b !== null && a.length === b.length && a.every((point, index) => point[0] === b[index][0] && point[1] === b[index][1]));
}

export class ElevationProfileSession {
  private state: ProfileSessionState;
  private listeners = new Set<() => void>();
  private terrain: AbortController | null = null;
  private reading: AbortController | null = null;
  private exporting: { format: ProfileExportFormat } | null = null;
  private isAlive = true;
  private readonly dependencies;

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  setSetting = <K extends Exclude<keyof ProfileSettings, 'fontSize' | 'fontSizeDraft' | 'printWidthMm' | 'printWidthDraft'>>(key: K, value: ProfileSettings[K]) => {
    this.publish({ settings: { ...this.state.settings, [key]: value } });
  };
  setNumberDraft = (key: 'fontSize' | 'printWidthMm', value: string) => {
    const draftKey = key === 'fontSize' ? 'fontSizeDraft' : 'printWidthDraft';
    const valid = key === 'fontSize' ? isProfileInteger(value, 20, 70) : isProfileInteger(value, 50, 300);
    this.publish({ settings: { ...this.state.settings, [draftKey]: value, ...(valid && { [key]: Number(value) }) } });
  };

  generate = async () => {
    if (!this.canRun() || this.reading) return;
    const owner = new AbortController();
    const previous = this.terrain;
    this.terrain = owner;
    previous?.abort();
    const onAbort = () => trackEditorAction('elevationCancelled');
    owner.signal.addEventListener('abort', onAbort, { once: true });
    trackEditorAction('elevationStarted');
    const coordinates = this.state.localRoute?.coordinates ?? this.state.route.coordinates!;
    this.publish({ status: 'loading', message: undefined, notice: null });
    try {
      const profile = await this.dependencies.loadProfile(coordinates, { signal: owner.signal });
      if (this.terrain === owner) {
        owner.signal.removeEventListener('abort', onAbort);
        trackEditorAction('elevationCompleted');
        this.publish({ profile, status: 'ready' });
      }
    } catch (error) {
      if (this.terrain === owner) {
        owner.signal.removeEventListener('abort', onAbort);
        trackEditorAction('elevationFailed');
        this.publish({ status: 'error', message: profileError(error, 'The elevation profile could not be generated. Try again.') });
      }
    } finally {
      owner.signal.removeEventListener('abort', onAbort);
      if (this.terrain === owner) this.terrain = null;
    }
  };
  cancelTerrain = () => {
    const owner = this.terrain;
    this.terrain = null; owner?.abort();
    this.publish({ status: this.state.profile ? 'ready' : 'idle', message: undefined });
  };

  chooseFile = async (file: File | undefined) => {
    if (!file || !this.canRun()) return;
    const owner = new AbortController();
    const previous = this.reading;
    this.reading = owner;
    previous?.abort();
    const parameters = { format: mapDataImportFormat([file]), source: 'file' as const };
    const onAbort = () => trackEditorAction('elevationImportCancelled', parameters);
    owner.signal.addEventListener('abort', onAbort, { once: true });
    trackEditorAction('elevationImportStarted', parameters);
    this.publish({ readingFilename: file.name, fileError: null, notice: null });
    try {
      const localRoute = await readProfileRoute(file, owner.signal);
      if (this.reading === owner) {
        owner.signal.removeEventListener('abort', onAbort);
        trackEditorAction('elevationImportCompleted', parameters);
        this.changeSource(localRoute);
      }
    } catch (error) {
      if (this.reading === owner) {
        owner.signal.removeEventListener('abort', onAbort);
        trackEditorAction('elevationImportFailed', parameters);
        this.publish({ fileError: profileError(error, 'The profile route file could not be read. Try another GPX, KML, or GeoJSON file.') });
      }
    } finally {
      owner.signal.removeEventListener('abort', onAbort);
      if (this.reading === owner) { this.reading = null; this.publish({ readingFilename: null }); }
    }
  };
  cancelFile = () => {
    const owner = this.reading;
    this.reading = null; owner?.abort();
    this.publish({ readingFilename: null, fileError: null, notice: 'File reading canceled. Your current profile source was kept.' });
  };
  useSelectedRoute = () => { if (this.canRun()) this.changeSource(null); };

  export = async (format: ProfileExportFormat) => {
    const snapshot = this.state;
    if (!snapshot.profile || !this.canExport()) return;
    trackEditorAction('elevationExportStarted', { format });
    if (!isProfileInteger(snapshot.settings.fontSizeDraft, 20, 70) || !isProfileInteger(snapshot.settings.printWidthDraft, 50, 300)) {
      trackEditorAction('elevationExportFailed', { format });
      this.publish({ exportError: 'Use a font size of 20–70 and a print width of 50–300 mm before downloading.' });
      return;
    }
    const owner = { format };
    this.exporting = owner;
    const name = snapshot.localRoute?.name ?? snapshot.route.name;
    this.publish({ exporting: true, exportError: null });
    try {
      const blob = await this.dependencies.createBlob(format, snapshot.profile, name, profileChartOptions(snapshot));
      if (this.exporting === owner) {
        this.dependencies.download(blob, profileFilename(name, format));
        trackEditorAction('elevationExportCompleted', { format });
      }
    } catch (error) {
      if (this.exporting === owner) {
        trackEditorAction('elevationExportFailed', { format });
        this.publish({ exportError: profileError(error, 'The elevation profile could not be downloaded. Try again.') });
      }
    } finally {
      if (this.exporting === owner) { this.exporting = null; this.publish({ exporting: false }); }
    }
  };

  constructor(route: ProfileRouteBinding, dependencies: Dependencies = {}) {
    this.dependencies = { loadProfile: dependencies.loadProfile ?? loadElevationProfile, createBlob: dependencies.createBlob ?? createProfileBlob, download: dependencies.download ?? downloadBlob };
    this.state = { route, localRoute: null, settings: createProfileSettings(), profile: null, status: 'idle', readingFilename: null, fileError: null, exporting: false, exportError: null, notice: null };
  }
  private publish(patch: Partial<ProfileSessionState>) {
    if (!this.isAlive) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private canRun() { return this.isAlive && this.state.route.coordinates !== null; }
  private canExport() { return this.canRun() && !this.reading && !this.exporting; }
  private retireJobs() {
    const terrain = this.terrain, reading = this.reading;
    if (this.exporting) trackEditorAction('elevationExportCancelled', { format: this.exporting.format });
    this.terrain = null; this.reading = null; this.exporting = null;
    terrain?.abort(); reading?.abort();
  }
  private changeSource(localRoute: LocalProfileRoute | null) {
    const notice = this.exporting ? 'The profile source changed. The pending profile download was canceled.' : null;
    this.retireJobs();
    this.publish({ localRoute, profile: null, status: 'idle', message: undefined, fileError: null, readingFilename: null, exporting: false, exportError: null, notice });
  }
  dispose() { this.retireJobs(); this.isAlive = false; this.listeners.clear(); }
  suspend() {
    this.retireJobs();
    this.publish({ status: this.state.profile ? 'ready' : 'idle', readingFilename: null, exporting: false });
    this.isAlive = false;
  }
  resume() { this.isAlive = true; }
  syncRoute(route: ProfileRouteBinding) {
    if (!this.isAlive || route === this.state.route) return;
    const previous = this.state.route;
    const hasChanged = previous.kind !== route.kind
      || (previous.coordinates === null) !== (route.coordinates === null)
      || (!this.state.localRoute && !sameCoordinates(previous.coordinates, route.coordinates));
    if (hasChanged) {
      const notice = this.reading ? 'The route changed while reading. Choose the profile file again.'
        : (this.exporting ? 'The profile source changed. The pending profile download was canceled.'
          : 'The route changed. Generate a new elevation profile.');
      this.retireJobs();
      this.publish({ route, profile: null, status: 'idle', message: undefined, readingFilename: null, exporting: false, exportError: null, fileError: null, notice });
    } else if (previous.name !== route.name || previous.color !== route.color || previous.coordinates !== route.coordinates) {
      this.publish({ route });
    }
  }
}
