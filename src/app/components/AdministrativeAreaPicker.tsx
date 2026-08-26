import { useMemo, useState } from 'react';
import {
  ADMINISTRATIVE_AREAS,
  VIENNA_DISTRICT_LICENSE_URL,
  VIENNA_DISTRICT_SOURCE_URL,
  administrativeAreaById,
  type AdministrativeArea,
  type AdministrativeCountryCode,
  type AdministrativeAreaId,
} from '../../domain/administrativeAreas';
import { Checkbox } from './UiControls';

type AdministrativeAreaPickerProps = Readonly<{
  onAdd: (id: AdministrativeAreaId) => void;
  onMerge: (ids: readonly AdministrativeAreaId[]) => boolean;
}>;

const countryAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'country');
const regionAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'region');
const regionCountries = countryAreas.filter(({ countryCode }) => (
  regionAreas.some((area) => area.countryCode === countryCode)
));
const municipalityAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'municipality');

function RegionAreaPicker({ onMerge }: Pick<AdministrativeAreaPickerProps, 'onMerge'>) {
  const [countryCode, setCountryCode] = useState<AdministrativeCountryCode>('AUT');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<AdministrativeAreaId[]>([]);
  const [error, setError] = useState('');
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCountry = administrativeAreaById(countryCode);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAreas = regionAreas.filter((area) => (
    area.countryCode === countryCode
    && (normalizedQuery.length === 0 || area.name.toLowerCase().includes(normalizedQuery))
  ));

  return (
    <>
      <label>Country <select aria-label="Region country" value={countryCode} onChange={(event) => {
        setCountryCode(event.target.value as AdministrativeCountryCode);
        setQuery('');
        setSelectedIds([]);
        setError('');
      }}>{regionCountries.map((area) => <option key={area.id} value={area.countryCode}>{area.name}</option>)}</select></label>
      <label className="administrative-filter">Search <input type="search" aria-label={`Filter ${selectedCountry?.name ?? 'selected'} regions`} value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <fieldset className="administrative-region-options">
        <legend>{selectedCountry?.name} regions</legend>
        {filteredAreas.map((area) => (
          <Checkbox key={area.id} isChecked={selectedIdSet.has(area.id as AdministrativeAreaId)} label={area.name} onCheckedChange={(isChecked) => {
            setError('');
            setSelectedIds((current) => isChecked ? [...current, area.id as AdministrativeAreaId] : current.filter((candidate) => candidate !== area.id));
          }} />
        ))}
      </fieldset>
      <span aria-live="polite">{selectedIds.length} {selectedIds.length === 1 ? 'region' : 'regions'} selected</span>
      <span className="authoring-source">{selectedCountry?.name} · Natural Earth</span>
      <button type="button" disabled={selectedIds.length === 0} onClick={() => {
        if (!onMerge(selectedIds)) setError('Choose connected single-part regions, or add Tyrol separately.');
      }}>{selectedIds.length > 1 ? `Merge ${selectedIds.length} selected areas` : 'Add selected area'}</button>
      {error && <span className="administrative-region-error" role="alert" aria-label="Administrative area status">{error}</span>}
    </>
  );
}

export function AdministrativeAreaPicker({ onAdd, onMerge }: AdministrativeAreaPickerProps) {
  const [level, setLevel] = useState<AdministrativeArea['level']>('country');
  const [countryAreaId, setCountryAreaId] = useState<AdministrativeAreaId>(countryAreas[0].id as AdministrativeAreaId);
  const [municipalityQuery, setMunicipalityQuery] = useState('');
  const [selectedMunicipalityIds, setSelectedMunicipalityIds] = useState<AdministrativeAreaId[]>([]);
  const [municipalityError, setMunicipalityError] = useState('');
  const selectedMunicipalityIdSet = useMemo(() => new Set(selectedMunicipalityIds), [selectedMunicipalityIds]);
  const normalizedMunicipalityQuery = municipalityQuery.trim().toLowerCase();
  const filteredMunicipalityAreas = normalizedMunicipalityQuery.length === 0
    ? municipalityAreas
    : municipalityAreas.filter(({ name }) => name.toLowerCase().includes(normalizedMunicipalityQuery));
  const selectedCountry = administrativeAreaById(countryAreaId);
  const toggleMunicipality = (id: AdministrativeAreaId, isChecked: boolean) => {
    setMunicipalityError('');
    setSelectedMunicipalityIds((current) => isChecked ? [...current, id] : current.filter((candidate) => candidate !== id));
  };
  const mergeMunicipalities = () => {
    if (!onMerge(selectedMunicipalityIds)) setMunicipalityError('Choose connected Vienna districts.');
  };


  return (
    <>
      <label>Level <select aria-label="Administrative level" value={level} onChange={(event) => setLevel(event.target.value as AdministrativeArea['level'])}><option value="country">Country</option><option value="region">Region</option><option value="municipality">Municipality</option></select></label>
      {level === 'country' ? (
        <>
          <label>Area <select aria-label="Administrative area" value={countryAreaId} onChange={(event) => setCountryAreaId(event.target.value as AdministrativeAreaId)}>{countryAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <span className="authoring-source">{selectedCountry?.level === 'country' ? 'Country' : ''} · Natural Earth</span>
          <button type="button" onClick={() => onAdd(countryAreaId)}>Add administrative area</button>
        </>
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
