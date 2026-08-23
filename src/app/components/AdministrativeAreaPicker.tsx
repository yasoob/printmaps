import { useMemo, useState } from 'react';
import {
  ADMINISTRATIVE_AREAS,
  administrativeAreaById,
  type AdministrativeAreaId,
} from '../../domain/administrativeAreas';

type AdministrativeAreaPickerProps = Readonly<{
  onAdd: (id: AdministrativeAreaId) => void;
  onMerge: (ids: readonly AdministrativeAreaId[]) => boolean;
}>;

export function AdministrativeAreaPicker({ onAdd, onMerge }: AdministrativeAreaPickerProps) {
  const countryAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'country');
  const regionAreas = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'region');
  const [level, setLevel] = useState<'country' | 'region'>('country');
  const [areaId, setAreaId] = useState<AdministrativeAreaId>(countryAreas[0].id as AdministrativeAreaId);
  const [selectedRegionIds, setSelectedRegionIds] = useState<AdministrativeAreaId[]>([]);
  const [regionError, setRegionError] = useState('');
  const selectedRegionIdSet = useMemo(() => new Set(selectedRegionIds), [selectedRegionIds]);
  const selectedArea = administrativeAreaById(areaId);
  const toggleRegion = (id: AdministrativeAreaId, isChecked: boolean) => {
    setRegionError('');
    setSelectedRegionIds((current) => isChecked ? [...current, id] : current.filter((candidate) => candidate !== id));
  };
  const mergeRegions = () => {
    if (!onMerge(selectedRegionIds)) setRegionError('Choose connected single-part regions, or add Tyrol separately.');
  };

  return (
    <>
      <label>Level <select aria-label="Administrative level" value={level} onChange={(event) => setLevel(event.target.value as 'country' | 'region')}><option value="country">Country</option><option value="region">Region</option></select></label>
      {level === 'country' ? (
        <>
          <label>Area <select aria-label="Administrative area" value={areaId} onChange={(event) => setAreaId(event.target.value as AdministrativeAreaId)}>{countryAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <span className="authoring-source">{selectedArea?.level === 'country' ? 'Country' : ''} · Natural Earth</span>
          <button type="button" onClick={() => onAdd(areaId)}>Add administrative area</button>
        </>
      ) : (
        <>
          <fieldset className="administrative-region-options">
            <legend>Regions</legend>
            {regionAreas.map((area) => (
              <label key={area.id}><input type="checkbox" checked={selectedRegionIdSet.has(area.id as AdministrativeAreaId)} onChange={(event) => toggleRegion(area.id as AdministrativeAreaId, event.target.checked)} />{area.name}</label>
            ))}
          </fieldset>
          <span className="authoring-source">Austria · Natural Earth</span>
          <button type="button" disabled={selectedRegionIds.length === 0} onClick={mergeRegions}>{selectedRegionIds.length > 1 ? `Merge ${selectedRegionIds.length} selected areas` : 'Add selected area'}</button>
          {regionError && <span className="administrative-region-error" role="alert" aria-label="Administrative area status">{regionError}</span>}
        </>
      )}
    </>
  );
}
