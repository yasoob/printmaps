import type { ElevationProfile } from '../elevation/profile';
import {
  createElevationProfileLayout, createElevationProfileMarkers, formatElevationProfileSummary,
  resolveElevationProfileRenderOptions, type ElevationProfileLayout, type ElevationProfileMarker,
  type ElevationProfileRenderOptions, type ResolvedElevationProfileRenderOptions,
} from './elevationProfileLayout';
import {
  fitProfileLine, fitProfileTitle, profileTextBounds, hasProfileTextIntersection, profileTextWidth,
  type ProfileText,
} from './elevationProfileText';

const WIDTH = 900;
const HEIGHT = 450;
const PADDING = 18;
const GAP = 10;

export type ElevationProfileScene = Readonly<{
  layout: ElevationProfileLayout;
  options: ResolvedElevationProfileRenderOptions;
  texts: readonly ProfileText[];
  markers: readonly ElevationProfileMarker[];
}>;

function distanceLabels(layout: ElevationProfileLayout, y: number, fontSize: number, family: ResolvedElevationProfileRenderOptions['fontFamily']): ProfileText[] {
  for (const indices of [[0, 1, 2, 3, 4], [0, 2, 4], [0, 4]]) {
    const labels: ProfileText[] = indices.map((index) => ({
      role: 'distance-axis', text: layout.distanceTicks[index].label, x: layout.distanceTicks[index].x, y, fontSize,
      anchor: index === 0 ? 'start' : (index === 4 ? 'end' : 'middle'),
    }));
    if (labels.every((label, index) => index === 0 || !hasProfileTextIntersection(profileTextBounds(label, family), profileTextBounds(labels[index - 1], family)))) return labels;
  }
  throw new Error('The profile distance labels cannot fit the selected layout.');
}

function markerCandidates(marker: ElevationProfileMarker, layout: ElevationProfileLayout, options: ResolvedElevationProfileRenderOptions): ProfileText[] {
  const { plot } = layout;
  const fontSize = fitProfileLine(marker.label, options.fontSize, plot.width - 28, { family: options.fontFamily, weight: 600 });
  const width = profileTextWidth(marker.label, fontSize, options.fontFamily, 600);
  const x = Math.max(plot.left + 14, Math.min(marker.point.x - width / 2, plot.left + plot.width - width - 14));
  const topBaseline = plot.top + fontSize + 4;
  const bottomBaseline = plot.top + plot.height - fontSize * 0.3 - 4;
  return [marker.point.y - 14, marker.point.y + fontSize + 14, topBaseline, bottomBaseline].map((y) => ({
    role: 'marker', text: marker.label, x, y: Math.max(topBaseline, Math.min(y, bottomBaseline)), fontSize,
  }));
}

function markerLabels(markers: readonly ElevationProfileMarker[], layout: ElevationProfileLayout, options: ResolvedElevationProfileRenderOptions): ProfileText[] {
  const [first, second] = markers.map((marker) => markerCandidates(marker, layout, options));
  if (!first) return [];
  if (!second) return [first[0]];
  for (const a of first) {
    for (const b of second) {
      if (!hasProfileTextIntersection(profileTextBounds(a, options.fontFamily), profileTextBounds(b, options.fontFamily))) return [a, b];
    }
  }
  throw new Error('The profile elevation labels cannot fit the selected layout.');
}

export function createElevationProfileScene(profile: ElevationProfile, title: string, options: ElevationProfileRenderOptions = {}): ElevationProfileScene {
  const resolved = resolveElevationProfileRenderOptions(options);
  const { fontSize, fontFamily, units } = resolved;
  const availableWidth = WIDTH - PADDING * 2;
  const initial = createElevationProfileLayout(profile, WIDTH, HEIGHT, resolved);
  const summary = formatElevationProfileSummary(profile, units);
  const summaryText = `${summary.distance} · ↑ ${summary.ascent} · ↓ ${summary.descent}`;
  const summarySize = fitProfileLine(summaryText, fontSize * 0.375, availableWidth, { family: fontFamily, weight: 400 });
  const sourceSize = fitProfileLine(profile.sourceLabel, fontSize * 0.375, availableWidth, { family: fontFamily, weight: 400 });
  const axisSize = fontSize * 0.35;
  const sourceY = HEIGHT - PADDING - sourceSize * 0.3;
  const summaryY = sourceY - sourceSize - GAP - summarySize * 0.3;
  const distanceY = summaryY - summarySize - GAP - axisSize * 0.3;
  const plotBottom = distanceY - axisSize - GAP;
  const minimumPlotHeight = Math.max(110, resolved.showElevationMarkers ? fontSize * 2.6 + 16 : 110);
  const titleHeight = plotBottom - minimumPlotHeight - PADDING - GAP - axisSize;
  const heading = fitProfileTitle(title, { maximumFontSize: fontSize * 0.6, width: availableWidth, height: titleHeight, family: fontFamily });
  const left = PADDING + Math.max(...initial.elevationTicks.map((tick) => profileTextWidth(tick.label, axisSize, fontFamily))) + GAP;
  const top = PADDING + heading.height + GAP + axisSize;
  const layout = createElevationProfileLayout(profile, WIDTH, HEIGHT, { ...resolved, plotBounds: { left, top, width: WIDTH - PADDING - left, height: plotBottom - top } });
  const markers = resolved.showElevationMarkers ? createElevationProfileMarkers(profile, layout, units) : [];
  const texts: ProfileText[] = [
    ...heading.lines.map((text, index): ProfileText => ({ role: 'title', text, x: PADDING, y: PADDING + heading.fontSize + index * heading.fontSize * 1.4, fontSize: heading.fontSize })),
    ...distanceLabels(layout, distanceY, axisSize, fontFamily),
    ...layout.elevationTicks.map((tick): ProfileText => ({ role: 'elevation-axis', text: tick.label, x: left - GAP, y: tick.y + axisSize * 0.35, fontSize: axisSize, anchor: 'end' })),
    { role: 'summary', text: summaryText, x: PADDING, y: summaryY, fontSize: summarySize },
    { role: 'source', text: profile.sourceLabel, x: WIDTH - PADDING, y: sourceY, fontSize: sourceSize, anchor: 'end' },
    ...markerLabels(markers, layout, resolved),
  ];
  return { layout, options: resolved, texts, markers };
}
