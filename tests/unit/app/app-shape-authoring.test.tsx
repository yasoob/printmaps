import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('keeps Area source choices concise without weakening their accessible names', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));

  expect(screen.getByRole('tab', { name: 'Find administrative area' })).toHaveTextContent('Boundaries');
  expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveTextContent('Draw');
  expect(screen.getByRole('tab', { name: 'Travel time' })).toHaveTextContent('Travel time');
});

it('uses roving arrow, Home, and End selection in the Shape tablist', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));

  const administrative = screen.getByRole('tab', { name: 'Find administrative area' });
  const draw = screen.getByRole('tab', { name: 'Draw custom area' });
  expect(administrative).toHaveAttribute('tabindex', '0');
  expect(draw).toHaveAttribute('tabindex', '-1');
  administrative.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{Home}');
  expect(screen.getByRole('tab', { name: 'Find administrative area' })).toHaveFocus();
  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Travel time' })).toHaveFocus();
});

it('merges selected Vienna districts as one fitted undoable shape', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'municipality');
  await user.click(screen.getByRole('checkbox', { name: 'Innere Stadt' }));
  await user.click(screen.getByRole('checkbox', { name: 'Josefstadt' }));
  await user.click(screen.getByRole('button', { name: 'Merge 2 selected districts' }));

  const merged = screen.getByRole('button', { name: 'Select Innere Stadt + Josefstadt' });
  expect(merged).toHaveAttribute('aria-current', 'true');
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-at-9-01-at-9-08');
  expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(merged).not.toBeInTheDocument();
});

it('filters Vienna districts by name without losing hidden selections', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'municipality');
  await user.click(screen.getByRole('checkbox', { name: 'Innere Stadt' }));
  const filter = screen.getByRole('searchbox', { name: 'Filter Vienna districts' });

  await user.type(filter, 'Josef');
  const districts = screen.getByRole('group', { name: 'Vienna districts' });
  expect(within(districts).getAllByRole('checkbox')).toHaveLength(1);
  expect(within(districts).getByRole('checkbox', { name: 'Josefstadt' })).toBeInTheDocument();
  expect(screen.getByText('1 district selected')).toBeInTheDocument();

  await user.clear(filter);
  expect(within(districts).getByRole('checkbox', { name: 'Innere Stadt' })).toBeChecked();
});

it('matches district names independently of browser locale casing', async () => {
  const localeLowerCase = vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function localeSensitiveLowercase(this: string) {
    return String(this).replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();
  });
  const user = userEvent.setup();

  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'municipality');
    await user.type(screen.getByRole('searchbox', { name: 'Filter Vienna districts' }), 'innere');

    expect(screen.getByRole('checkbox', { name: 'Innere Stadt' })).toBeInTheDocument();
  } finally {
    localeLowerCase.mockRestore();
  }
});

it('exposes every Hungarian first-order division through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'HUN');

  const regions = screen.getByRole('group', { name: 'Hungary regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(43);
  expect(within(regions).getByRole('checkbox', { name: 'Budapest' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Csongrád-Csanád' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Veszprém' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Veszprém (city)' })).toBeInTheDocument();
  expect(screen.getByText('Hungary · Natural Earth')).toBeInTheDocument();
});

it('exposes every Czech first-order division through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'CZE');

  const regions = screen.getByRole('group', { name: 'Czechia regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(14);
  expect(within(regions).getByRole('checkbox', { name: 'Prague' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'South Moravian' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Moravian-Silesian' })).toBeInTheDocument();
  expect(screen.getByText('Czechia · Natural Earth')).toBeInTheDocument();
});

it('exposes every Polish voivodeship through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'POL');

  const regions = screen.getByRole('group', { name: 'Poland regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(16);
  expect(within(regions).getByRole('checkbox', { name: 'Masovian' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Łódź' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Kuyavian-Pomeranian' })).toBeInTheDocument();
  expect(screen.getByText('Poland · Natural Earth')).toBeInTheDocument();
});

it('exposes every German federal state through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'DEU');

  const regions = screen.getByRole('group', { name: 'Germany regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(16);
  expect(within(regions).getByRole('checkbox', { name: 'Bavaria' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Berlin' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'North Rhine-Westphalia' })).toBeInTheDocument();
  expect(screen.getByText('Germany · Natural Earth')).toBeInTheDocument();
});

it('exposes every Swiss canton through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'CHE');

  const regions = screen.getByRole('group', { name: 'Switzerland regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(26);
  expect(within(regions).getByRole('checkbox', { name: 'Zürich' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Geneva' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Graubünden' })).toBeInTheDocument();
  expect(screen.getByText('Switzerland · Natural Earth')).toBeInTheDocument();
});

it('exposes every Belgian province through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'BEL');

  const regions = screen.getByRole('group', { name: 'Belgium regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(11);
  expect(within(regions).getByRole('checkbox', { name: 'Brussels Capital' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Antwerp' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Liège' })).toBeInTheDocument();
  expect(screen.getByText('Belgium · Natural Earth')).toBeInTheDocument();
});

it('filters the active region catalogue without losing hidden selections', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'HUN');
  const regions = screen.getByRole('group', { name: 'Hungary regions' });
  await user.click(within(regions).getByRole('checkbox', { name: 'Budapest' }));

  const filter = screen.getByRole('searchbox', { name: 'Filter Hungary regions' });
  await user.type(filter, 'Veszprém');

  expect(within(regions).getAllByRole('checkbox')).toHaveLength(2);
  expect(within(regions).getByRole('checkbox', { name: 'Veszprém' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Veszprém (city)' })).toBeInTheDocument();
  expect(screen.getByText('1 region selected')).toBeInTheDocument();

  await user.clear(filter);
  expect(within(regions).getByRole('checkbox', { name: 'Budapest' })).toBeChecked();
});

it('switches the region catalogue by country without retaining an incompatible selection', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.click(screen.getByRole('checkbox', { name: 'Burgenland' }));

  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'SVK');

  const regions = screen.getByRole('group', { name: 'Slovakia regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(8);
  expect(within(regions).getByRole('checkbox', { name: 'Bratislava' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Burgenland' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add selected area' })).toBeDisabled();

  await user.click(within(regions).getByRole('checkbox', { name: 'Bratislava' }));
  await user.click(screen.getByRole('button', { name: 'Add selected area' }));

  expect(screen.getByRole('button', { name: 'Select Bratislava' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-sk-bl');
});

describe('polygon authoring', () => {
  it('adds one sourced Vienna municipal district as a fitted undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'municipality');
    const districts = screen.getByRole('group', { name: 'Vienna districts' });
    expect(within(districts).getAllByRole('checkbox')).toHaveLength(23);
    await user.click(within(districts).getByRole('checkbox', { name: 'Innere Stadt' }));
    expect(screen.getByRole('link', { name: 'Vienna district boundaries source' })).toHaveAttribute(
      'href', expect.stringContaining('BEZIRKSGRENZEOGD'),
    );
    expect(screen.getByRole('link', { name: 'CC BY 3.0 AT license' })).toHaveAttribute(
      'href', 'https://creativecommons.org/licenses/by/3.0/at/',
    );
    await user.click(screen.getByRole('button', { name: 'Add selected district' }));

    const layer = screen.getByRole('button', { name: 'Select Innere Stadt' });
    expect(layer).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-at-9-01');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(layer).not.toBeInTheDocument();
  });

  it('adds a bundled administrative area as a selected undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    expect(screen.getByRole('tab', { name: 'Find administrative area' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Finish area' })).not.toBeInTheDocument();
    const areaSelect = screen.getByRole('combobox', { name: 'Administrative area' });
    await user.selectOptions(areaSelect, 'AUT');
    await user.click(screen.getByRole('button', { name: 'Add administrative area' }));

    expect(screen.getByRole('button', { name: 'Select Austria' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Austria' })).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-geometry', expect.stringContaining('admin-aut'));
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-aut');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Austria' })).not.toBeInTheDocument();
  });

  it('merges two selected regions into one fitted undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.click(screen.getByRole('checkbox', { name: 'Lower Austria' }));
    await user.click(screen.getByRole('checkbox', { name: 'Vienna' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2 selected areas' }));

    const merged = screen.getByRole('button', { name: 'Select Lower Austria + Vienna' });
    expect(merged).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-at-3-at-9');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(merged).not.toBeInTheDocument();
  });

  it('adds disconnected Tyrol without flattening its parts into editable rings', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.click(screen.getByRole('checkbox', { name: 'Tyrol' }));
    await user.click(screen.getByRole('button', { name: 'Add selected area' }));

    expect(screen.getByRole('button', { name: 'Select Tyrol' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('status', { name: 'Multi-part geometry status' })).toHaveTextContent(
      '2 disconnected parts',
    );
    expect(screen.queryByRole('heading', { name: 'Vertices' })).not.toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-at-7');
  });

  it('guides disconnected or multi-part region selections without naming one country', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.click(screen.getByRole('checkbox', { name: 'Burgenland' }));
    await user.click(screen.getByRole('checkbox', { name: 'Vorarlberg' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2 selected areas' }));

    expect(screen.getByRole('alert', { name: 'Administrative area status' })).toHaveTextContent(
      'Choose connected single-part regions, or add multi-part regions separately.',
    );
    expect(screen.getByRole('button', { name: 'Cancel area' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Burgenland + Vorarlberg' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Vorarlberg' }));
    await user.click(screen.getByRole('checkbox', { name: 'Styria' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2 selected areas' }));
    expect(screen.getByRole('button', { name: 'Select Burgenland + Styria' })).toHaveAttribute('aria-current', 'true');
  });

  it('finishes three map clicks as one selected undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    const finish = screen.getByRole('button', { name: 'Finish area' });
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
    expect(finish).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft'));

    await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
    expect(finish).toBeEnabled();

    await user.click(finish);
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Area 01' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toBeInTheDocument();
  });

  it('cancels an unfinished shape without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Cancel area' }));

    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('keeps Finish disabled until three map vertices are distinct', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    const repeatedPoint = screen.getByRole('button', { name: 'Map route point 1' });
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);

    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
    expect(screen.getByRole('button', { name: 'Finish area' })).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft:true'));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('does not restore an abandoned shape draft after another project opens', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened project';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!input) throw new Error('Project open input unavailable');

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'opened.printmap.json', { type: 'application/json' })] },
    });

    expect(await screen.findByRole('button', { name: 'Opened project' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
  });
});
