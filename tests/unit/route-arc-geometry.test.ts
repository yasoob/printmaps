import { describe, expect, it } from 'vitest';
import {
  arcControlPosition,
  arcPoint,
  createArcGeometry,
  sampleArc,
} from '../../src/domain/routeArcGeometry';

describe('canonical route arc geometry', () => {
  it('stores exactly two endpoint anchors without samples or control points', () => {
    expect(createArcGeometry([[16.3, 48.2], [16.5, 48.2]])).toEqual({
      type: 'Arc',
      anchors: [[16.3, 48.2], [16.5, 48.2]],
    });
  });

  it('derives display samples without mutating canonical anchors', () => {
    const arc = createArcGeometry([[16.3, 48.2], [16.5, 48.2]])!;
    const canonical = structuredClone(arc);

    const samples = sampleArc(arc, 8);

    expect(samples).toHaveLength(9);
    expect(samples[0]).toEqual(arc.anchors[0]);
    expect(samples.at(-1)).toEqual(arc.anchors[1]);
    expect(arc).toEqual(canonical);
  });

  it('produces the same curve locus when the anchor order is reversed', () => {
    const forward = createArcGeometry([[-74, 40.7], [2.35, 48.85]])!;
    const reverse = createArcGeometry([[2.35, 48.85], [-74, 40.7]])!;

    expect(arcControlPosition(reverse)).toEqual(arcControlPosition(forward));
    expect(arcPoint(reverse, 0.25)).toEqual(arcPoint(forward, 0.75));
  });

  it('uses the short side of the dateline and visibly leaves the anchor chord', () => {
    const arc = createArcGeometry([[179, 0], [-179, 0]])!;
    const midpoint = arcPoint(arc, 0.5);

    expect(Math.abs(midpoint[0])).toBeGreaterThan(179);
    expect(Math.abs(midpoint[1])).toBeGreaterThan(0.1);
  });

  it.each([
    ['duplicate anchors', [[1, 1], [1, 1]]],
    ['ambiguous antipodes', [[0, 0], [180, 0]]],
    ['invalid latitude', [[0, 0], [1, 86]]],
  ] as const)('rejects %s', (_label, anchors) => {
    expect(createArcGeometry(anchors)).toBeNull();
  });
});
