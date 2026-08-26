import { useEffect, useMemo, useState } from 'react';
import {
  ADMINISTRATIVE_AREAS,
  VIENNA_DISTRICT_LICENSE_URL,
  VIENNA_DISTRICT_SOURCE_URL,
  administrativeAreaById,
  type AdministrativeArea,
  type AdministrativeCountryCode,
  type AdministrativeAreaId,
} from '../../domain/administrativeAreas';
import {
  loadGeneratedAdministrativeIndex,
  loadGeneratedAdministrativeShard,
  type GeneratedAdministrativeIndex,
} from '../../domain/generatedAdministrativeCatalogue';
import { Checkbox } from './UiControls';

type AdministrativeAreaPickerProps = Readonly<{
  onAdd: (area: AdministrativeArea) => void;
  onMerge: (areas: readonly AdministrativeArea[]) => boolean;
}>;

type CatalogueLoadStatus = Readonly<{ countryCode?: string; text: string }>;

function displayedCatalogueStatus(
  catalogue: GeneratedAdministrativeIndex | null,
  countryCode: string,
  loadStatus: CatalogueLoadStatus,
): string {
  const country = catalogue?.countries.find(({ id }) => id === countryCode);
  if (country && loadStatus.countryCode !== countryCode) return `Loading ${country.name} boundaries…`;
  return loadStatus.text;
}

const countryAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'country');
const regionAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'region');
const regionCountries = countryAreas.filter(({ countryCode }) => (
  regionAreas.some((area) => area.countryCode === countryCode)
));
const municipalityAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'municipality');

function CountryAreaPicker({ onAdd }: Pick<AdministrativeAreaPickerProps, 'onAdd'>) {
  const [countryCode, setCountryCode] = useState<AdministrativeCountryCode>('AUT');
  const [catalogue, setCatalogue] = useState<GeneratedAdministrativeIndex | null>(null);
  const [loaded, setLoaded] = useState<{ countryCode: string; country: AdministrativeArea } | null>(null);
  const [loadStatus, setLoadStatus] = useState('Loading worldwide country catalogue…');

  useEffect(() => {
    const controller = new AbortController();
    void loadGeneratedAdministrativeIndex(controller.signal).then((index) => {
      if (!controller.signal.aborted) setCatalogue(index);
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) {
        setLoadStatus(`Worldwide catalogue unavailable. Using bundled countries. ${loadError instanceof Error ? loadError.message : ''}`.trim());
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!catalogue) return;
    const country = catalogue.countries.find(({ id }) => id === countryCode);
    if (!country) return;
    const controller = new AbortController();
    void loadGeneratedAdministrativeShard(country, catalogue.sourceVersion, controller.signal).then((shard) => {
      if (controller.signal.aborted) return;
      setLoaded({ countryCode, country: shard.country });
      setLoadStatus(`${country.name} boundary loaded.`);
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) {
        setLoadStatus(`${country.name} boundary unavailable. ${loadError instanceof Error ? loadError.message : 'Try again.'}`);
      }
    });
    return () => controller.abort();
  }, [catalogue, countryCode]);

  const countryOptions = catalogue?.countries ?? countryAreas.map(({ id, name }) => ({ id, name }));
  const selectedCountryName = countryOptions.find(({ id }) => id === countryCode)?.name ?? countryCode;
  const fallbackCountry = catalogue ? undefined : countryAreas.find(({ id }) => id === countryCode);
  const selectedCountry = loaded?.countryCode === countryCode ? loaded.country : fallbackCountry;

  return (
    <>
      <label>Area <select aria-label="Administrative area" value={countryCode} onChange={(event) => {
        const nextCountryCode = event.target.value;
        const nextCountryName = countryOptions.find(({ id }) => id === nextCountryCode)?.name ?? nextCountryCode;
        setCountryCode(nextCountryCode);
        setLoaded(null);
        setLoadStatus(`Loading ${nextCountryName} boundary…`);
      }}>{countryOptions.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label>
      <span role="status" aria-label="Administrative country status">{loadStatus}</span>
      <span className="authoring-source">{selectedCountryName} · Natural Earth</span>
      <button type="button" disabled={!selectedCountry} onClick={() => { if (selectedCountry) onAdd(selectedCountry); }}>Add administrative area</button>
    </>
  );
}

function RegionAreaPicker({ onMerge }: Pick<AdministrativeAreaPickerProps, 'onMerge'>) {
  const [countryCode, setCountryCode] = useState<AdministrativeCountryCode>('AUT');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<AdministrativeAreaId[]>([]);
  const [error, setError] = useState('');
  const [catalogue, setCatalogue] = useState<GeneratedAdministrativeIndex | null>(null);
  const [loaded, setLoaded] = useState<{ countryCode: string; regions: readonly AdministrativeArea[] } | null>(null);
  const [loadStatus, setLoadStatus] = useState<CatalogueLoadStatus>({
    text: 'Loading worldwide region catalogue…',
  });
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    const controller = new AbortController();
    void loadGeneratedAdministrativeIndex(controller.signal).then((index) => {
      if (!controller.signal.aborted) setCatalogue(index);
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) {
        setLoadStatus({
          text: `Worldwide catalogue unavailable. Using bundled regions. ${loadError instanceof Error ? loadError.message : ''}`.trim(),
        });
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!catalogue) return;
    const country = catalogue.countries.find(({ id }) => id === countryCode);
    if (!country) return;
    const controller = new AbortController();
    void loadGeneratedAdministrativeShard(country, catalogue.sourceVersion, controller.signal).then((shard) => {
      if (controller.signal.aborted) return;
      setLoaded({ countryCode, regions: shard.regions });
      setLoadStatus({
        countryCode,
        text: `${shard.regions.length} ${country.name} ${shard.regions.length === 1 ? 'region' : 'regions'} loaded.`,
      });
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) {
        setLoadStatus({
          countryCode,
          text: `${country.name} boundaries unavailable. ${loadError instanceof Error ? loadError.message : 'Try again.'}`,
        });
      }
    });
    return () => controller.abort();
  }, [catalogue, countryCode]);

  const fallbackRegions = regionAreas.filter((area) => area.countryCode === countryCode);
  const activeRegions = loaded?.countryCode === countryCode ? loaded.regions : fallbackRegions;
  const countryOptions = catalogue?.countries.filter(({ levels }) => levels.includes('region'))
    ?? regionCountries.map(({ countryCode: id, name }) => ({ id, name }));
  const selectedCountryName = countryOptions.find(({ id }) => id === countryCode)?.name ?? countryCode;
  const displayedLoadStatus = displayedCatalogueStatus(catalogue, countryCode, loadStatus);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAreas = activeRegions.filter((area) => (
    normalizedQuery.length === 0 || area.name.toLowerCase().includes(normalizedQuery)
  ));
  const selectedAreas = selectedIds.map((id) => activeRegions.find((area) => area.id === id)).filter((area): area is AdministrativeArea => area !== undefined);

  return (
    <>
      <label>Country <select aria-label="Region country" value={countryCode} onChange={(event) => {
        const nextCountryCode = event.target.value;
        const nextCountry = countryOptions.find(({ id }) => id === nextCountryCode);
        setCountryCode(nextCountryCode);
        setLoaded(null);
        setLoadStatus({
          countryCode: nextCountryCode,
          text: `Loading ${nextCountry?.name ?? nextCountryCode} boundaries…`,
        });
        setQuery('');
        setSelectedIds([]);
        setError('');
      }}>{countryOptions.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label>
      <label className="administrative-filter">Search <input type="search" aria-label={`Filter ${selectedCountryName} regions`} value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <fieldset className="administrative-region-options" aria-busy={displayedLoadStatus.startsWith('Loading')}>
        <legend>{selectedCountryName} regions</legend>
        {filteredAreas.map((area) => (
          <Checkbox key={area.id} isChecked={selectedIdSet.has(area.id)} label={area.name} onCheckedChange={(isChecked) => {
            setError('');
            setSelectedIds((current) => isChecked ? [...current, area.id] : current.filter((candidate) => candidate !== area.id));
          }} />
        ))}
      </fieldset>
      <span role="status" aria-label="Administrative catalogue status">{displayedLoadStatus}</span>
      <span aria-live="polite">{selectedIds.length} {selectedIds.length === 1 ? 'region' : 'regions'} selected</span>
      <span className="authoring-source">{selectedCountryName} · Natural Earth</span>
      <button type="button" disabled={selectedAreas.length === 0} onClick={() => {
        if (!onMerge(selectedAreas)) setError('Choose connected single-part regions, or add multi-part regions separately.');
      }}>{selectedIds.length > 1 ? `Merge ${selectedIds.length} selected areas` : 'Add selected area'}</button>
      {error && <span className="administrative-region-error" role="alert" aria-label="Administrative area status">{error}</span>}
    </>
  );
}

export function AdministrativeAreaPicker({ onAdd, onMerge }: AdministrativeAreaPickerProps) {
  const [level, setLevel] = useState<AdministrativeArea['level']>('country');
  const [municipalityQuery, setMunicipalityQuery] = useState('');
  const [selectedMunicipalityIds, setSelectedMunicipalityIds] = useState<AdministrativeAreaId[]>([]);
  const [municipalityError, setMunicipalityError] = useState('');
  const selectedMunicipalityIdSet = useMemo(() => new Set(selectedMunicipalityIds), [selectedMunicipalityIds]);
  const normalizedMunicipalityQuery = municipalityQuery.trim().toLowerCase();
  const filteredMunicipalityAreas = normalizedMunicipalityQuery.length === 0
    ? municipalityAreas
    : municipalityAreas.filter(({ name }) => name.toLowerCase().includes(normalizedMunicipalityQuery));
  const toggleMunicipality = (id: AdministrativeAreaId, isChecked: boolean) => {
    setMunicipalityError('');
    setSelectedMunicipalityIds((current) => isChecked ? [...current, id] : current.filter((candidate) => candidate !== id));
  };
  const mergeMunicipalities = () => {
    const selectedAreas = selectedMunicipalityIds.map((id) => administrativeAreaById(id)).filter((area): area is AdministrativeArea => area !== undefined);
    if (!onMerge(selectedAreas)) setMunicipalityError('Choose connected Vienna districts.');
  };


  return (
    <>
      <label>Level <select aria-label="Administrative level" value={level} onChange={(event) => setLevel(event.target.value as AdministrativeArea['level'])}><option value="country">Country</option><option value="region">Region</option><option value="municipality">Municipality</option></select></label>
      {level === 'country' ? (
        <CountryAreaPicker onAdd={onAdd} />
      ) : (level === 'region' ? (
        <RegionAreaPicker onMerge={onMerge} />
      ) : (
        <>
          <label className="administrative-filter">Search <input type="search" aria-label="Filter Vienna districts" value={municipalityQuery} onChange={(event) => setMunicipalityQuery(event.currentTarget.value)} /></label>
          <fieldset className="administrative-region-options">
            <legend>Vienna districts</legend>
            {filteredMunicipalityAreas.map((area) => (
              <Checkbox key={area.id} isChecked={selectedMunicipalityIdSet.has(area.id as AdministrativeAreaId)} label={area.name} onCheckedChange={(isChecked) => toggleMunicipality(area.id as AdministrativeAreaId, isChecked)} />
            ))}
          </fieldset>
          <span aria-live="polite">{selectedMunicipalityIds.length} {selectedMunicipalityIds.length === 1 ? 'district' : 'districts'} selected</span>
          <span className="authoring-source"><a aria-label="Vienna district boundaries source" href={VIENNA_DISTRICT_SOURCE_URL} rel="noreferrer" target="_blank">Vienna OGD</a> · <a aria-label="CC BY 3.0 AT license" href={VIENNA_DISTRICT_LICENSE_URL} rel="noreferrer" target="_blank">CC BY 3.0 AT</a></span>
          <button type="button" disabled={selectedMunicipalityIds.length === 0} onClick={mergeMunicipalities}>{selectedMunicipalityIds.length > 1 ? `Merge ${selectedMunicipalityIds.length} selected districts` : 'Add selected district'}</button>
          {municipalityError && <span className="administrative-region-error" role="alert" aria-label="Administrative area status">{municipalityError}</span>}
        </>
      ))}
    </>
  );
}
