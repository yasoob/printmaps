type ReactScanRenderHandler = NonNullable<
  import("react-scan").Options["onRender"]
>;
type ReactScanFiber = Parameters<ReactScanRenderHandler>[0];
type ReactScanRender = Parameters<ReactScanRenderHandler>[1][number];

const anonymousComponents = new WeakMap<object, string>();
const fiberInstances = new WeakMap<object, number>();
const identityState = { nextAnonymousId: 1, nextInstanceId: 1 };

function changeKind(type: number): string {
  if (type === 1) return "props";
  if (type === 2) return "state";
  if (type === 3) return "class-state";
  if (type === 4) return "context";
  return "unknown";
}

function isPropsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function changedProps(fiber: ReactScanFiber): string[] {
  const previous = fiber.alternate?.memoizedProps;
  const current = fiber.memoizedProps;
  if (!isPropsRecord(previous) || !isPropsRecord(current)) return [];
  const names = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return [...names]
    .filter((name) => !Object.is(previous[name], current[name]))
    .map((name) => `props:${name}`);
}

function sourcePath(fiber: ReactScanFiber): string | null {
  const stackMatch = fiber._debugStack?.stack.match(
    /(?:^|\/)(src\/[^():\s]+):\d+:\d+/m,
  );
  if (stackMatch?.[1]) return stackMatch[1];
  const fileName = fiber._debugSource?.fileName;
  if (!fileName) return null;
  const sourceIndex = fileName.lastIndexOf("/src/");
  return sourceIndex === -1 ? fileName : fileName.slice(sourceIndex + 1);
}

function objectTypeName(type: object): string | null {
  for (const key of ["displayName", "name"] as const) {
    const value = Reflect.get(type, key);
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function fiberTypeName(fiber: ReactScanFiber): string | null {
  const { type } = fiber;
  if (typeof type === "string") return null;
  if (typeof type === "function") return type.displayName || type.name || null;
  return type && typeof type === "object" ? objectTypeName(type) : null;
}

function resolvedComponentName(
  fiber: ReactScanFiber,
  reportedName: string | null,
): string {
  if (reportedName && reportedName !== "Unknown") return reportedName;
  const type = fiber.type;
  if (
    type === null ||
    (typeof type !== "object" && typeof type !== "function")
  ) {
    return reportedName ?? "Unknown";
  }
  const existing = anonymousComponents.get(type);
  if (existing) return existing;
  const name = `AnonymousComponent#${identityState.nextAnonymousId}`;
  identityState.nextAnonymousId += 1;
  anonymousComponents.set(type, name);
  return name;
}

function instanceId(fiber: ReactScanFiber): number {
  const existing = fiberInstances.get(fiber)
    ?? (fiber.alternate ? fiberInstances.get(fiber.alternate) : undefined);
  if (existing) {
    fiberInstances.set(fiber, existing);
    return existing;
  }
  const id = identityState.nextInstanceId;
  identityState.nextInstanceId += 1;
  fiberInstances.set(fiber, id);
  if (fiber.alternate) fiberInstances.set(fiber.alternate, id);
  return id;
}

function ownerPath(fiber: ReactScanFiber): string[] {
  const owners: string[] = [];
  let owner = fiber.return;
  while (owner) {
    const name = fiberTypeName(owner);
    if (name) owners.push(name);
    owner = owner.return;
  }
  return owners;
}

function renderPhase(phase: number) {
  if (phase === 1) return "mount" as const;
  if (phase === 2) return "update" as const;
  if (phase === 4) return "unmount" as const;
  return "unknown" as const;
}

export function analyzeFiberRender(
  fiber: ReactScanFiber,
  render: ReactScanRender,
) {
  const changes = new Set(changedProps(fiber));
  for (const change of render.changes) {
    changes.add(`${changeKind(change.type)}:${change.name}`);
  }
  return {
    changes: [...changes],
    didCommit: render.didCommit,
    instanceId: instanceId(fiber),
    name: resolvedComponentName(fiber, render.componentName),
    ownerPath: ownerPath(fiber),
    phase: renderPhase(render.phase),
    source: sourcePath(fiber),
  };
}
