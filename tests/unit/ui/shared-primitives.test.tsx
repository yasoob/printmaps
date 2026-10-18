import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette, Square } from 'lucide-react';
import { Button } from '../../../src/components/ui/button';
import { ColorField } from '../../../src/components/ui/color-field';
import { Dialog } from '../../../src/components/ui/dialog';
import { Notice } from '../../../src/components/ui/notice';
import { SimpleSelect } from '../../../src/components/ui/select';
import { Slider } from '../../../src/components/ui/slider';
import { StudioModeTabs } from '../../../src/app/components/StudioModeTabs';
import { chooseOption, selectedValue } from '../select-support';
import { SegmentedControl } from '../../../src/components/ui/segmented-control';
import {
  StudioDialog,
  StudioDialogActions,
  StudioDialogBody,
  StudioDialogButton,
  StudioDialogHeader,
} from '../../../src/components/ui/studio-dialog';
import { ToggleSection } from '../../../src/components/ui/toggle-section';
import { PropertyRow, PropertySubheading } from '../../../src/app/components/PropertyControls';
import { Switch } from '../../../src/app/components/UiControls';
import { StudioColor, StudioSelect, StudioToggle } from '../../../src/app/studio/StudioFields';

function SegmentedHarness({ onValueChange = vi.fn() }: { onValueChange?: (value: string) => void }) {
  const [value, setValue] = useState<'fill' | 'outline' | 'none'>('fill');
  return (
    <SegmentedControl
      label="Area style"
      value={value}
      options={[
        { value: 'fill', label: 'Fill', icon: Palette },
        { value: 'outline', label: 'Outline', icon: Square },
        { value: 'none', label: 'None', disabled: true },
      ]}
      onValueChange={(next) => { onValueChange(next); setValue(next); }}
    />
  );
}

function ToggleHarness() {
  const [checked, setChecked] = useState(false);
  return <ToggleSection title="North compass" switchLabel="Show compass" checked={checked} onCheckedChange={setChecked}>
    <PropertyRow label="Corner"><select aria-label="Compass corner"><option>Top right</option></select></PropertyRow>
  </ToggleSection>;
}

describe('SegmentedControl', () => {
  it('exposes a labelled radio group with one tab stop and arrow-key selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<><button type="button">Before</button><SegmentedHarness onValueChange={onValueChange} /></>);
    const group = screen.getByRole('radiogroup', { name: 'Area style' });
    expect(group).toHaveClass('studio-segmented');
    const fill = screen.getByRole('radio', { name: 'Fill' });
    expect(fill).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(fill).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const outline = screen.getByRole('radio', { name: 'Outline' });
    expect(outline).toHaveFocus();
    expect(outline).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('outline');
  });

  it('selects the first and last enabled options with Home and End', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SegmentedHarness onValueChange={onValueChange} />);
    screen.getByRole('radio', { name: 'Fill' }).focus();
    await user.keyboard('{End}');
    const outline = screen.getByRole('radio', { name: 'Outline' });
    expect(outline).toHaveFocus();
    expect(outline).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('outline');
    await user.keyboard('{Home}');
    const fill = screen.getByRole('radio', { name: 'Fill' });
    expect(fill).toHaveFocus();
    expect(fill).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('fill');
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('does not select disabled options on click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SegmentedHarness onValueChange={onValueChange} />);
    await user.click(screen.getByRole('radio', { name: 'None' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('ColorField', () => {
  it('names the color input, shows an uppercase hex value and reports changes', () => {
    const onChange = vi.fn();
    render(<ColorField label="Route color" value="#ffffff" onChange={onChange} />);
    const input = screen.getByLabelText('Route color');
    expect(input).toHaveAttribute('type', 'color');
    expect(screen.getByText('#FFFFFF')).toHaveAttribute('aria-hidden', 'true');
    input.focus();
    // jsdom has no picker; dispatch the same input event the platform picker would.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '#00ff00');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('forwards native input props such as an accessible description', () => {
    render(<><p id="color-help">Custom image supplies its own color.</p>
      <ColorField label="POI color" value="#123456" disabled aria-describedby="color-help" onChange={vi.fn()} /></>);
    const input = screen.getByLabelText('POI color');
    expect(input).toHaveAccessibleDescription('Custom image supplies its own color.');
    expect(input).toBeDisabled();
  });

  it('is reachable through StudioColor with a short visible row label', () => {
    render(<StudioColor label="Compass color" rowLabel="Color" value="#1f1f1f" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Compass color')).toHaveAttribute('type', 'color');
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.queryByText('Compass color')).not.toBeInTheDocument();
  });
});

describe('StudioFields row labels', () => {
  it('keeps the accessible name separate from the visible row label', () => {
    render(<>
      <StudioSelect label="Compass corner" rowLabel="Corner" value="tr" options={[{ value: 'tr', label: 'Top right' }]} onChange={vi.fn()} />
      <StudioToggle label="Label grid lines" rowLabel="Labels" checked onChange={vi.fn()} />
    </>);
    expect(screen.getByRole('combobox', { name: 'Compass corner' })).toBeInTheDocument();
    expect(screen.getByText('Corner')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Label grid lines' })).toBeChecked();
  });
});

describe('ToggleSection', () => {
  it('reveals dependent fields only while its separately named switch is on', async () => {
    const user = userEvent.setup();
    render(<ToggleHarness />);
    expect(screen.getByRole('heading', { name: 'North compass', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'North compass' })).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Show compass' });
    expect(screen.queryByRole('combobox', { name: 'Compass corner' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Compass corner' })).toBeInTheDocument();
  });

  it('defaults the switch name to the title', () => {
    render(<ToggleSection title="Show legend" checked={false} onCheckedChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch', { name: 'Show legend' })).toBeDisabled();
  });
});

describe('Notice', () => {
  it('announces errors assertively and other tones politely', () => {
    render(<>
      <Notice tone="error" title="MP4 unavailable">This browser cannot encode video.</Notice>
      <Notice tone="info" action={<Button size="sm" variant="secondary">Retry</Button>}>Links cannot be revoked.</Notice>
    </>);
    expect(screen.getByRole('alert')).toHaveTextContent('MP4 unavailable');
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('status')).toHaveTextContent('Links cannot be revoked.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('maps variants and legacy aliases to one shared class family', () => {
    render(<>
      <Button>Export</Button>
      <Button variant="outline">Legacy</Button>
      <Button variant="ghost" size="icon" aria-label="Close" />
    </>);
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('data-variant', 'primary');
    expect(screen.getByRole('button', { name: 'Legacy' })).toHaveAttribute('data-variant', 'secondary');
    const icon = screen.getByRole('button', { name: 'Close' });
    expect(icon).toHaveClass('studio-button');
    expect(icon).toHaveAttribute('data-size', 'icon');
  });

  it('blocks activation and announces progress while busy', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button busy onClick={onClick}>Download PNG</Button>);
    const button = screen.getByRole('button', { name: 'Download PNG' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('StudioDialog shell', () => {
  it('renders the standard header with an aligned close button and sized surface', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <StudioDialog size="sm" className="share-dialog">
          <StudioDialogHeader title="Share this map" description="Anyone with the link can view." />
          <StudioDialogBody>Body</StudioDialogBody>
          <StudioDialogActions start={<span>Snapshot</span>}>
            <StudioDialogButton variant="destructive">Discard</StudioDialogButton>
            <StudioDialogButton variant="primary">Done</StudioDialogButton>
          </StudioDialogActions>
        </StudioDialog>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Share this map' });
    expect(dialog).toHaveAttribute('data-size', 'sm');
    expect(dialog).toHaveClass('studio-dialog', 'share-dialog');
    expect(dialog).toHaveAccessibleDescription('Anyone with the link can view.');
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Discard' })).toHaveAttribute('data-variant', 'destructive');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it('can omit the close button when a decision is required', () => {
    render(
      <Dialog open>
        <StudioDialog>
          <StudioDialogHeader title="Start a new project?" showClose={false} />
        </StudioDialog>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Start a new project?' })).toHaveAttribute('data-size', 'md');
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});

describe('field grammar', () => {
  it('supports stacked rows, sub-headings and trailing switches', () => {
    render(<>
      <PropertySubheading>Margins</PropertySubheading>
      <PropertyRow label="Caption" layout="stacked"><textarea aria-label="Caption" /></PropertyRow>
      <Switch label="Visible" labelPlacement="start" isChecked onCheckedChange={vi.fn()} />
    </>);
    expect(screen.getByRole('heading', { name: 'Margins', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Caption' }).closest('.property-row')).toHaveAttribute('data-layout', 'stacked');
    expect(screen.getByRole('switch', { name: 'Visible' }).closest('.studio-switch')).toHaveAttribute('data-label-placement', 'start');
  });
});

function SelectHarness({ onValueChange }: { onValueChange: (value: string) => void }) {
  const [value, setValue] = useState<'metric' | 'imperial' | 'nautical'>('metric');
  return (
    <SimpleSelect
      label="Scale units"
      value={value}
      options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }, { value: 'nautical', label: 'Nautical', disabled: true }]}
      onValueChange={(next) => { onValueChange(next); setValue(next); }}
    />
  );
}

describe('SimpleSelect', () => {
  it('shows the selected label, exposes the raw value and commits a chosen option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SelectHarness onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Scale units' });
    expect(trigger).toHaveTextContent('Metric');
    expect(selectedValue(trigger)).toBe('metric');
    await chooseOption(user, 'Scale units', 'Imperial');
    expect(onValueChange).toHaveBeenCalledWith('imperial');
    expect(trigger).toHaveTextContent('Imperial');
    expect(trigger).toHaveAttribute('data-value', 'imperial');
  });

  it('supports grouped options and leaves disabled options unselectable', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SimpleSelect label="Units" value="m" onValueChange={onValueChange} options={[
      { label: 'Metric', options: [{ value: 'm', label: 'Meters' }, { value: 'km', label: 'Kilometers', disabled: true }] },
      { label: 'Imperial', options: [{ value: 'mi', label: 'Miles' }] },
    ]} />);
    await user.click(screen.getByRole('combobox', { name: 'Units' }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('group', { name: 'Imperial' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Kilometers' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(listbox).getByRole('option', { name: 'Miles' }));
    expect(onValueChange).toHaveBeenCalledWith('mi');
  });

  it('uses the same helper for native selects during migration', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<select aria-label="Legacy units" defaultValue="a" onChange={(event) => onChange(event.target.value)}><option value="a">Alpha</option><option value="b">Beta</option></select>);
    await chooseOption(user, 'Legacy units', 'Beta');
    expect(onChange).toHaveBeenCalledWith('b');
    expect(selectedValue(screen.getByRole('combobox', { name: 'Legacy units' }))).toBe('b');
  });
});

describe('Slider', () => {
  it('renders one named thumb for a single value', () => {
    render(<Slider value={40} min={0} max={100} thumbLabels="Contrast" onValueChange={vi.fn()} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    expect(screen.getByRole('slider', { name: 'Contrast' })).toHaveAttribute('aria-valuenow', '40');
  });
});

describe('StudioModeTabs', () => {
  it('keeps tab semantics, reports the activation source and activates with arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function TabsHarness() {
      const [value, setValue] = useState<'map' | 'layout'>('map');
      return <StudioModeTabs label="Inspector" idPrefix="t" value={value} choices={[{ value: 'map', label: 'Map' }, { value: 'layout', label: 'Layout', shortLabel: 'Lay.' }]}
        onValueChange={(next, activation) => { onValueChange(next, activation); setValue(next); }} />;
    }
    render(<TabsHarness />);
    const layout = screen.getByRole('tab', { name: 'Layout' });
    expect(layout).toHaveAttribute('aria-controls', 't-layout-panel');
    await user.click(layout);
    expect(onValueChange).toHaveBeenLastCalledWith('layout', { source: 'pointer' });
    expect(layout).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('map', { source: 'keyboard' });
  });
});
