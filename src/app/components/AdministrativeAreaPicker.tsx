import { Globe2, LoaderCircle, MapPinned } from 'lucide-react';
import { useState } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { GeneratedAdministrativeCountry, GeneratedAdministrativeShard } from '../../domain/generatedAdministrativeCatalogue';
import { useCountryBoundaryCatalogue } from '../hooks/useCountryBoundaryCatalogue';
import { ShadcnSingleCombobox } from './ShadcnCombobox';

type AdministrativeAreaPickerProps = Readonly<{
  onAdd: (area: AdministrativeArea) => void;
  onCancel: () => void;
}>;

function boundaryDescription(area: AdministrativeArea) {
  return area.level === 'country' ? 'Entire country' : 'Region';
}

function BoundaryChooser({ onAdd, onCancel, shard }: Readonly<{
  onAdd: AdministrativeAreaPickerProps['onAdd'];
  onCancel: AdministrativeAreaPickerProps['onCancel'];
  shard: GeneratedAdministrativeShard;
}>) {
  const [selectedArea, setSelectedArea] = useState<AdministrativeArea | null>(shard.country);
  const boundaries = [shard.country, ...shard.regions];
  return (
    <>
      <div className="administrative-combobox-field">
        <label htmlFor="administrative-boundary">Boundary</label>
        <ShadcnSingleCombobox
          description={boundaryDescription}
          emptyLabel="No matching regions."
          icon={<MapPinned aria-hidden="true" size={15} />}
          inputId="administrative-boundary"
          itemId={(area) => area.id}
          itemLabel={(area) => area.name}
          items={boundaries}
          label="Boundary"
          placeholder="Entire country or regions…"
          value={selectedArea}
          onValueChange={setSelectedArea}
        />
      </div>
      <div className="administrative-picker-footer">
        <button type="button" aria-label="Cancel area" onClick={onCancel}>Cancel</button>
        <button className="primary-button" type="button" disabled={!selectedArea} onClick={() => { if (selectedArea) onAdd(selectedArea); }}>Add area</button>
      </div>
    </>
  );
}

export function AdministrativeAreaPicker({ onAdd, onCancel }: AdministrativeAreaPickerProps) {
  const catalogue = useCountryBoundaryCatalogue();
  const countries = catalogue.state.catalogue?.countries ?? [];
  const chooseCountry = (country: GeneratedAdministrativeCountry | null) => {
    if (country) catalogue.selectCountry(country);
  };
  const status = catalogue.state.error
    || (catalogue.state.isLoading ? `Loading ${catalogue.state.country?.name ?? 'countries'}…` : '');

  return (
    <div className="administrative-boundary-picker">
      <div className="administrative-combobox-field">
        <label htmlFor="administrative-country">Country</label>
        <ShadcnSingleCombobox
          description={() => 'Country'}
          disabled={!catalogue.state.catalogue}
          emptyLabel="No matching countries."
          icon={<Globe2 aria-hidden="true" size={15} />}
          inputId="administrative-country"
          itemId={(country) => country.id}
          itemLabel={(country) => country.name}
          items={countries}
          label="Country"
          placeholder="Choose a country…"
          value={catalogue.state.country}
          onValueChange={chooseCountry}
        />
      </div>
      {catalogue.state.shard
        ? <BoundaryChooser key={catalogue.state.shard.country.id} onAdd={onAdd} onCancel={onCancel} shard={catalogue.state.shard} />
        : (
          <>
            <div className="administrative-combobox-field">
              <label htmlFor="administrative-boundary">Boundary</label>
              <ShadcnSingleCombobox
                description={() => ''}
                disabled
                emptyLabel="Choose a country first."
                icon={<MapPinned aria-hidden="true" size={15} />}
                inputId="administrative-boundary"
                itemId={(area: AdministrativeArea) => area.id}
                itemLabel={(area) => area.name}
                items={[]}
                label="Boundary"
                placeholder={catalogue.state.isLoading ? 'Loading boundaries…' : 'Choose a country first…'}
                value={null}
                onValueChange={() => {}}
              />
            </div>
            <div className="administrative-picker-footer">
              <button type="button" aria-label="Cancel area" onClick={onCancel}>Cancel</button>
              <button className="primary-button" type="button" disabled>Add area</button>
            </div>
          </>
        )}
      <span role="status" aria-label="Administrative catalogue status">
        {catalogue.state.isLoading ? <LoaderCircle className="is-spinning" aria-hidden="true" size={12} /> : null}
        {status}
      </span>
    </div>
  );
}
