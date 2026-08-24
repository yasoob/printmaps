import { useMemo, useState } from 'react';
import {
  ADMINISTRATIVE_AREAS,
  VIENNA_DISTRICT_LICENSE_URL,
  VIENNA_DISTRICT_SOURCE_URL,
  administrativeAreaById,
  type AdministrativeArea,
  type AdministrativeAreaId,
} from '../../domain/administrativeAreas';
import { Checkbox } from './UiControls';

type AdministrativeAreaPickerProps = Readonly<{
  onAdd: (id: AdministrativeAreaId) => void;
  onMerge: (ids: readonly AdministrativeAreaId[]) => boolean;
}>;

export function AdministrativeAreaPicker({ onAdd, onMerge }: AdministrativeAreaPickerProps) {
  const countryAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'country');
  const regionAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'region');
  const municipalityAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'municipality');
  const [level, setLevel] = useState<AdministrativeArea['level']>('country');
  const [countryAreaId, setCountryAreaId] = useState<AdministrativeAreaId>(countryAreas[0].id as AdministrativeAreaId);
  const [municipalityAreaId, setMunicipalityAreaId] = useState<AdministrativeAreaId>(municipalityAreas[0].id as AdministrativeAreaId);
  const [selectedRegionIds, setSelectedRegionIds] = useState<AdministrativeAreaId[]>([]);
  const [regionError, setRegionError] = useState('');
  const selectedRegionIdSet = useMemo(() => new Set(selectedRegionIds), [selectedRegionIds]);
  const selectedCountry = administrativeAreaById(countryAreaId);
  const toggleRegion = (id: AdministrativeAreaId, isChecked: boolean) => {
    setRegionError('');
    setSelectedRegionIds((current) => isChecked ? [...current, id] : current.filter((candidate) => candidate !== id));
  };
  const mergeRegions = () => {
    if (!onMerge(selectedRegionIds)) setRegionError('Choose connected single-part regions, or add Tyrol separately.');
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
        <>
          <fieldset className="administrative-region-options">
            <legend>Regions</legend>
            {regionAreas.map((area) => (
              <Checkbox key={area.id} isChecked={selectedRegionIdSet.has(area.id as AdministrativeAreaId)} label={area.name} onCheckedChange={(isChecked) => toggleRegion(area.id as AdministrativeAreaId, isChecked)} />
            ))}
          </fieldset>
          <span className="authoring-source">Austria · Natural Earth</span>
          <button type="button" disabled={selectedRegionIds.length === 0} onClick={mergeRegions}>{selectedRegionIds.length > 1 ? `Merge ${selectedRegionIds.length} selected areas` : 'Add selected area'}</button>
          {regionError && <span className="administrative-region-error" role="alert" aria-label="Administrative area status">{regionError}</span>}
        </>
      ) : (
        <>
          <label>District <select aria-label="Vienna district" value={municipalityAreaId} onChange={(event) => setMunicipalityAreaId(event.target.value as AdministrativeAreaId)}>{municipalityAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <span className="authoring-source"><a aria-label="Vienna district boundaries source" href={VIENNA_DISTRICT_SOURCE_URL} rel="noreferrer" target="_blank">Vienna OGD</a> · <a aria-label="CC BY 3.0 AT license" href={VIENNA_DISTRICT_LICENSE_URL} rel="noreferrer" target="_blank">CC BY 3.0 AT</a></span>
          <button type="button" onClick={() => onAdd(municipalityAreaId)}>Add municipal district</button>
        </>
      ))}
    </>
  );
}
