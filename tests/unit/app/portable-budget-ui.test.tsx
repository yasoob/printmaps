import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { byteBudgetProject } from '../../fixtures/portableBudget';
import type { ProjectDocument } from '../../../src/domain/project';
import { stubMobileViewport } from './mobileViewport';
import { MapStyleCustomizer } from '../../../src/app/components/MapStyleCustomizer';

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../../../src/map/MapCanvas', () => ({ MapCanvas: () => null }));
vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument: download }));
const initial = byteBudgetProject();

function setup() {
  const repository = { save: vi.fn(), load: vi.fn(), discard: vi.fn(), close: vi.fn() };
  render(<App initialDocument={initial} autosaveRepository={repository} />);
  return { user: userEvent.setup(), repository };
}

async function downloaded(user: ReturnType<typeof userEvent.setup>): Promise<ProjectDocument> {
  await user.click(screen.getByRole('button', { name: 'Project' }));
  await user.click(screen.getByRole('menuitem', { name: 'Download project' }));
  await user.keyboard('{Escape}');
  return download.mock.calls.at(-1)![0];
}

it('retains valid-but-over-budget numeric drafts and project title choices without autosave or false committed values', async () => {
  const { user, repository } = setup();
  const width = screen.getByRole('spinbutton', { name: 'Page width' });
  fireEvent.change(width, { target: { value: '298.125' } });
  fireEvent.blur(width);
  expect(width).toHaveValue(298.125);
  expect(width).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('10 MB portable limit');
  expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A4');
  expect(await downloaded(user)).toEqual(initial);
  fireEvent.change(width, { target: { value: '297' } });
  fireEvent.blur(width);
  expect(width).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A4');
  await user.click(screen.getByRole('button', { name: initial.title }));
  const title = screen.getByRole('textbox', { name: 'Project title' });
  fireEvent.change(title, { target: { value: initial.title + ' bigger' } });
  fireEvent.keyDown(title, { key: 'Enter' });
  expect(title).toHaveValue(initial.title + ' bigger');
  expect(title).toHaveAttribute('aria-invalid', 'true');
  fireEvent.keyDown(title, { key: 'Escape' });
  expect(repository.save).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
}, 30_000);

it('retains layer name, opacity and POI label drafts and reports their rejected canonical mutations', async () => {
  const { user, repository } = setup();
  await user.click(screen.getByRole('button', { name: 'Select Marker 5' }));
  const opacity = screen.getByRole('spinbutton', { name: 'Layer opacity' });
  fireEvent.change(opacity, { target: { value: '99' } });
  fireEvent.blur(opacity);
  expect(opacity).toHaveValue(99);
  expect(screen.getByRole('alert')).toHaveTextContent('10 MB portable limit');
  const name = screen.getByRole('textbox', { name: 'Layer name' });
  fireEvent.change(name, { target: { value: 'A much longer name' } });
  fireEvent.blur(name);
  expect(name).toHaveValue('A much longer name');
  expect(name).toHaveAttribute('aria-invalid', 'true');
  const label = screen.getByRole('textbox', { name: 'POI label' });
  fireEvent.change(label, { target: { value: 'A bigger label' } });
  fireEvent.blur(label);
  expect(label).toHaveValue('A bigger label');
  expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('10 MB portable limit'))).toBe(true);
  expect(await downloaded(user)).toEqual(initial);
  expect(repository.save).not.toHaveBeenCalled();
}, 30_000);

it('rolls back controlled preset, visibility and palette choices with actionable operation feedback', async () => {
  const { user, repository } = setup();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Page preset' }), 'Custom');
  expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A4');
  expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('portable limit'))).toBe(true);
  const details = screen.getByRole('button', { name: /Map details/ });
  if (details.getAttribute('aria-expanded') !== 'true') await user.click(details);
  await user.click(screen.getByRole('checkbox', { name: 'Show roads' }));
  expect(screen.getByRole('checkbox', { name: 'Show roads' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Customize colors' }));
  const color = screen.getByLabelText('Water color');
  fireEvent.input(color, { target: { value: '#123456' } });
  expect(color).not.toHaveValue('#123456');
  expect(screen.getByRole('alert')).toHaveTextContent('portable limit');
  expect(repository.save).not.toHaveBeenCalled();
}, 30_000);

it('retains a rejected mobile project rename in its modal until corrected or cancelled', async () => {
  stubMobileViewport();
  const { user, repository } = setup();
  await user.click(screen.getByRole('button', { name: 'Project' }));
  await user.click(screen.getByRole('menuitem', { name: 'Rename project' }));
  const title = screen.getByRole('textbox', { name: 'Project name' });
  fireEvent.change(title, { target: { value: initial.title + ' bigger' } });
  await user.click(screen.getByRole('button', { name: 'Rename' }));
  expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
  expect(title).toHaveValue(initial.title + ' bigger');
  expect(title).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('portable limit');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(repository.save).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
}, 30_000);

it('does not carry a palette rejection into a replacement with identical displayed color values', () => {
  const failure = vi.fn(() => ({ ok: false as const, error: 'Project byte limit' }));
  const actions = {
    onAdjustmentChange: failure, onColorChange: failure, onReset: failure, onResetMapStyle: failure,
    onToneChange: failure, onBack: vi.fn(),
  };
  const customization = initial.style.customization;
  const view = render(<MapStyleCustomizer {...actions} customization={customization} preset="paper" />);
  fireEvent.input(screen.getByLabelText('Water color'), { target: { value: '#123456' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Project byte limit');
  view.rerender(<MapStyleCustomizer {...actions} customization={{ ...customization }} preset="paper" />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
