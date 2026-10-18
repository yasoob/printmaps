import { Globe2, LoaderCircle, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useState } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { GeneratedAdministrativeCountry, GeneratedAdministrativeShard } from '../../domain/generatedAdministrativeCatalogue';
import { useCountryBoundaryCatalogue } from '../hooks/useCountryBoundaryCatalogue';
import { ShadcnSingleCombobox } from './ShadcnCombobox';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import { PropertyRow } from './PropertyControls';
import { ToolCardActions } from './ToolAuthoringCard';

type AdministrativeAreaPickerProps = Readonly<{
  id?: string;
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
      <PropertyRow label="Boundary">
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
          onValueChange={(area) => {
            if (area && area.id !== selectedArea?.id) trackEditorAction('boundarySelected');
            setSelectedArea(area);
          }}
        />
      </PropertyRow>
      <ToolCardActions>
        <Button variant="ghost" aria-label="Cancel area" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!selectedArea} onClick={() => {
          if (!selectedArea) return;
          trackEditorAction('boundaryAddRequested');
          onAdd(selectedArea);
        }}>Add area</Button>
      </ToolCardActions>
    </>
  );
}

export function AdministrativeAreaPicker({ id, onAdd, onCancel }: AdministrativeAreaPickerProps) {
  const catalogue = useCountryBoundaryCatalogue();
  const countries = catalogue.state.catalogue?.countries ?? [];
  const chooseCountry = (country: GeneratedAdministrativeCountry | null) => {
    if (country && country.id !== catalogue.state.country?.id) trackEditorAction('boundaryCountrySelected');
    if (country) catalogue.selectCountry(country);
  };
  const cancel = () => { trackEditorAction('boundaryPickerCancelled'); onCancel(); };
  const status = catalogue.state.error
    || (catalogue.state.isLoading ? `Loading ${catalogue.state.country?.name ?? 'countries'}…` : '');

  return (
    <div id={id} className="administrative-boundary-picker">
      <PropertyRow label="Country">
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
      </PropertyRow>
      {catalogue.state.error
        ? <Notice tone="error" role="status" aria-label="Administrative catalogue status">{catalogue.state.error}</Notice>
        : (
          <span className="administrative-catalogue-status" role="status" aria-label="Administrative catalogue status">
            {catalogue.state.isLoading ? <LoaderCircle className="is-spinning" aria-hidden="true" size={14} /> : null}
            {status}
          </span>
        )}
      {catalogue.state.shard
        ? <BoundaryChooser key={catalogue.state.shard.country.id} onAdd={onAdd} onCancel={cancel} shard={catalogue.state.shard} />
        : (
          <>
            <PropertyRow label="Boundary">
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
            </PropertyRow>
            <ToolCardActions>
              <Button variant="ghost" aria-label="Cancel area" onClick={cancel}>Cancel</Button>
              <Button variant="primary" disabled>Add area</Button>
            </ToolCardActions>
          </>
        )}
    </div>
  );
}
