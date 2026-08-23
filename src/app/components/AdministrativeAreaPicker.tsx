import { useState } from 'react';
import {
  ADMINISTRATIVE_AREAS,
  administrativeAreaById,
  type AdministrativeAreaId,
} from '../../domain/administrativeAreas';

type AdministrativeAreaPickerProps = Readonly<{
  onAdd: (id: AdministrativeAreaId) => void;
}>;

export function AdministrativeAreaPicker({ onAdd }: AdministrativeAreaPickerProps) {
  const [areaId, setAreaId] = useState<AdministrativeAreaId>(ADMINISTRATIVE_AREAS[0].id);
  const selectedArea = administrativeAreaById(areaId);

  return (
    <>
      <label>Area <select aria-label="Administrative area" value={areaId} onChange={(event) => setAreaId(event.target.value as AdministrativeAreaId)}>{ADMINISTRATIVE_AREAS.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
      <span className="authoring-source">{selectedArea?.level === 'country' ? 'Country' : ''} · Natural Earth</span>
      <button type="button" onClick={() => onAdd(areaId)}>Add administrative area</button>
    </>
  );
}
