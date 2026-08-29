import { memo } from 'react';
import type { ContentLayer } from '../../domain/project';
import { LayerMenu } from './LayerMenu';
import { PropertyRow, PropertySection } from './PropertyControls';
import { Switch } from './UiControls';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';

type LayerIdentityPropertiesProps = {
  layer: ContentLayer;
  nameDraft: string;
  opacityDraft: string;
  onDelete: () => void;
  onDuplicate: () => void;
  onNameChange: (value: string) => void;
  onNameCommit: () => void;
  onOpacityChange: (value: string) => void;
  onOpacityCommit: () => void;
  onReplace: (trigger: HTMLElement | null) => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
};

function haveSameLayerIdentityCallbacks(previous: LayerIdentityPropertiesProps, next: LayerIdentityPropertiesProps) {
  return previous.onDelete === next.onDelete
    && previous.onDuplicate === next.onDuplicate
    && previous.onNameChange === next.onNameChange
    && previous.onNameCommit === next.onNameCommit
    && previous.onOpacityChange === next.onOpacityChange
    && previous.onOpacityCommit === next.onOpacityCommit
    && previous.onReplace === next.onReplace
    && previous.onToggleLock === next.onToggleLock
    && previous.onToggleVisibility === next.onToggleVisibility;
}

function isSameLayerIdentity(previous: LayerIdentityPropertiesProps, next: LayerIdentityPropertiesProps) {
  return previous.layer.id === next.layer.id
    && previous.layer.name === next.layer.name
    && previous.layer.type === next.layer.type
    && previous.layer.opacity === next.layer.opacity
    && previous.layer.visible === next.layer.visible
    && previous.layer.locked === next.layer.locked
    && previous.nameDraft === next.nameDraft
    && previous.opacityDraft === next.opacityDraft
    && haveSameLayerIdentityCallbacks(previous, next);
}

export const LayerIdentityProperties = memo(function LayerIdentityProperties({
  layer,
  nameDraft,
  opacityDraft,
  onDelete,
  onDuplicate,
  onNameChange,
  onNameCommit,
  onOpacityChange,
  onOpacityCommit,
  onReplace,
  onToggleLock,
  onToggleVisibility,
}: LayerIdentityPropertiesProps) {
  return (
    <>
      <div className="properties-title">
        <h2>{layer.name}</h2>
        <LayerMenu onReplace={onReplace} onDuplicate={onDuplicate} onDelete={onDelete} replaceDisabled={layer.type === 'basemap' || layer.locked} />
      </div>
      <PropertySection title="Layer">
        <PropertyRow label="Name"><input aria-label="Layer name" value={nameDraft} onChange={(event) => onNameChange(event.target.value)} onBlur={onNameCommit} /></PropertyRow>
        <PropertyRow label="Opacity"><InputGroup><InputNumber aria-label="Layer opacity" min={0} max={100} step={1} value={opacityDraft} onChange={(event) => onOpacityChange(event.target.value)} onBlur={onOpacityCommit} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>%</InputGroupAddon></InputGroup></PropertyRow>
        <PropertyRow label="Visible"><Switch aria-label="Toggle layer visibility" isChecked={layer.visible} label="Layer visibility" labelHidden onCheckedChange={onToggleVisibility} /></PropertyRow>
        <PropertyRow label="Locked"><Switch aria-label="Toggle layer lock" isChecked={layer.locked} label="Layer lock" labelHidden onCheckedChange={onToggleLock} /></PropertyRow>
      </PropertySection>
    </>
  );
}, isSameLayerIdentity);
