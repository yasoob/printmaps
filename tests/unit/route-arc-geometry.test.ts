import { describe, expect, it } from 'vitest';
import {
  arcControlPosition,
  arcPoint,
  createArcGeometry,
  rebasePathLongitudes,
  sampleArc,
  sampledPathMidpoint,
} from '../../src/domain/routeArcGeometry';

describe('canonical route arc geometry', () => {
  it('stores connected anchors and one signed curvature per segment', () => {
    expect(createArcGeometry([[16.3, 48.2], [16.5, 48.2]])).toEqual({
      type: 'Arc',
      anchors: [[16.3, 48.2], [16.5, 48.2]],
      curvatures: [0.35],
    });
    expect(createArcGeometry([[0, 0], [1, 0], [2, 0]], [0.2, -0.4])).toEqual({
      type: 'Arc',
      anchors: [[0, 0], [1, 0], [2, 0]],
      curvatures: [0.2, -0.4],
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

  it('samples every connected segment and flips bend direction with the sign', () => {
    const arc = createArcGeometry([[0, 0], [1, 0], [2, 0]], [0.35, -0.35])!;
    const samples = sampleArc(arc, 4);

    expect(samples).toHaveLength(9);
    expect(samples[4]).toEqual([1, 0]);
    expect(samples[2][1]).toBeGreaterThan(0);
    expect(samples[6][1]).toBeLessThan(0);
  });

  it('uses the short side of the dateline and visibly leaves the anchor chord', () => {
    const arc = createArcGeometry([[179, 0], [-179, 0]])!;
    const midpoint = arcPoint(arc, 0.5);
    const samples = sampleArc(arc);

    expect(Math.abs(midpoint[0])).toBeGreaterThan(179);
    expect(Math.abs(midpoint[1])).toBeGreaterThan(0.1);
    expect(samples.every((sample, index) => index === 0 || Math.abs(sample[0] - samples[index - 1][0]) < 1)).toBe(true);
    expect(samples.at(-1)?.[0]).toBe(181);
  });

  it('places a path marker at half the sampled path length instead of the middle vertex', () => {
    expect(sampledPathMidpoint([[0, 0], [1, 0], [101, 0]])).toEqual([50.5, 0]);
    expect(sampledPathMidpoint([[179, 0], [181, 0], [183, 0]])).toEqual([181, 0]);
  });

  it('rebases a complete continuous path onto one camera world copy', () => {
    expect(rebasePathLongitudes([[179, 0], [181, 0], [183, 0]], -179)).toEqual([
      [-181, 0], [-179, 0], [-177, 0],
    ]);
    expect(rebasePathLongitudes([[0, 0], [170, 0], [190, 0]], 0)).toEqual([
      [0, 0], [170, 0], [190, 0],
    ]);
  });

  it.each([
    ['duplicate anchors', [[1, 1], [1, 1]]],
    ['ambiguous antipodes', [[0, 0], [180, 0]]],
    ['invalid latitude', [[0, 0], [1, 86]]],
  ] as const)('rejects %s', (_label, anchors) => {
    expect(createArcGeometry(anchors)).toBeNull();
  });

  it('rejects missing, extra, and out-of-range segment curvature', () => {
    expect(createArcGeometry([[0, 0], [1, 0], [2, 0]], [0.2])).toBeNull();
    expect(createArcGeometry([[0, 0], [1, 0]], [0.2, 0.3])).toBeNull();
    expect(createArcGeometry([[0, 0], [1, 0]], [1.01])).toBeNull();
  });
});
