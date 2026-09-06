import { signal } from '@dnd-kit/state';
import type { DragDropManager, DragEndEvent } from '@dnd-kit/react';
import { createLayerDropCompletion } from '../../src/app/hooks/layerDropCompletion';

function setup(kind = 'keydown') {
  const row = document.createElement('li');
  const handle = document.createElement('button');
  const external = document.createElement('input');
  row.append(handle);
  document.body.append(row, external);
  handle.focus();
  const idle = signal(false);
  let finishRendering!: () => void;
  let canRestore = true;
  const rendering = new Promise<void>((resolve) => { finishRendering = resolve; });
  const manager = {
    plugins: [],
    renderer: { rendering },
    dragOperation: { status: { get idle() { return idle.value; } } },
  } as unknown as DragDropManager;
  const suspension = { resume: vi.fn(), abort: vi.fn() };
  const event = {
    operation: { source: { handle, element: row }, activatorEvent: new Event(kind) },
    suspend: vi.fn(() => suspension),
  } as unknown as DragEndEvent;
  const onComplete = vi.fn();
  const scope = createLayerDropCompletion({ manager, event, canRestoreFocus: () => canRestore, onComplete });
  return {
    scope, handle, external, row, suspension, onComplete,
    render: async () => { finishRendering(); await rendering; await Promise.resolve(); },
    nativeIdle: () => { idle.value = true; },
    changeOwner: () => { canRestore = false; },
  };
}

describe('owned native layer-drop completion', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('retains cleanup until native idle rather than releasing at dragend or renderer completion', async () => {
    const fixture = setup();
    expect(fixture.onComplete).not.toHaveBeenCalled();
    await fixture.render();
    expect(fixture.suspension.resume).toHaveBeenCalledOnce();
    expect(fixture.onComplete).not.toHaveBeenCalled();
    fixture.nativeIdle();
    expect(fixture.onComplete).toHaveBeenCalledOnce();
    expect(fixture.handle).toHaveFocus();
  });

  it('restores lost keyboard focus at native completion only when the same owner still has it', async () => {
    const fixture = setup();
    fixture.handle.blur();
    await fixture.render();
    expect(document.body).toHaveFocus();
    fixture.nativeIdle();
    expect(fixture.handle).toHaveFocus();
    fixture.external.focus();
    await Promise.resolve();
    expect(fixture.external).toHaveFocus();
  });

  it('invalidates on a new focus target before native completion and never reclaims it', async () => {
    const fixture = setup();
    await fixture.render();
    fixture.external.focus();
    fixture.nativeIdle();
    expect(fixture.external).toHaveFocus();
    expect(fixture.onComplete).toHaveBeenCalledOnce();
  });

  it.each(['filter', 'epoch'])('retires %s ownership without a focus event and skips restoration', async () => {
    const fixture = setup();
    fixture.handle.blur();
    fixture.changeOwner();
    fixture.scope.invalidate();
    await fixture.render();
    fixture.nativeIdle();
    expect(document.body).toHaveFocus();
    expect(fixture.suspension.resume).toHaveBeenCalledOnce();
  });

  it('does not focus a pointer-drag handle', async () => {
    const fixture = setup('pointerdown');
    fixture.handle.blur();
    await fixture.render();
    fixture.nativeIdle();
    expect(document.body).toHaveFocus();
  });

  it('does not focus a removed source', async () => {
    const fixture = setup();
    fixture.row.remove();
    await fixture.render();
    fixture.nativeIdle();
    expect(document.body).toHaveFocus();
  });

  it('aborts suspended native cleanup on teardown and ignores late rendering/completion', async () => {
    const fixture = setup();
    fixture.handle.blur();
    fixture.scope.dispose();
    expect(fixture.suspension.abort).toHaveBeenCalledOnce();
    expect(fixture.onComplete).toHaveBeenCalledOnce();
    await fixture.render();
    fixture.nativeIdle();
    expect(fixture.suspension.resume).not.toHaveBeenCalled();
    expect(fixture.onComplete).toHaveBeenCalledOnce();
    expect(document.body).toHaveFocus();
  });
});
