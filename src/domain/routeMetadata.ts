export const ROUTE_KINDS = ['straight', 'arc', 'road'] as const;
export type RouteKind = typeof ROUTE_KINDS[number];
export type RouteMetadata = {
  kind: RouteKind;
  closed: boolean;
};

