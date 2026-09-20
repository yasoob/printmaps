import type { VideoOptions } from '../../video/types';

type Choice<T extends string | number> = Readonly<{ value: T; label: string }>;

function VideoChoice<T extends string | number>({ label, value, choices, onChange }: Readonly<{
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
}>) {
  return <label className="video-export-choice">
    <span>{label}</span>
    <select value={value} onChange={(event) => {
      const choice = choices.find((item) => String(item.value) === event.target.value);
      if (choice) onChange(choice.value);
    }}>
      {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </select>
  </label>;
}

const MOTIONS: readonly Choice<VideoOptions['motion']>[] = [{ value: 'orbit', label: 'Orbit (one full turn)' }, { value: 'sway', label: 'Sway (gentle back and forth)' }];
const DURATIONS: readonly Choice<VideoOptions['durationSeconds']>[] = [{ value: 5, label: '5 seconds' }, { value: 10, label: '10 seconds' }, { value: 15, label: '15 seconds' }];
const FRAME_RATES: readonly Choice<VideoOptions['fps']>[] = [{ value: 30, label: '30 fps target' }, { value: 60, label: '60 fps target' }];
const ASPECTS: readonly Choice<VideoOptions['aspect']>[] = [
  { value: 'page', label: 'Poster aspect' }, { value: '16:9', label: '16:9 landscape' },
  { value: '9:16', label: '9:16 portrait' }, { value: '1:1', label: '1:1 square' }, { value: '4:5', label: '4:5 portrait' },
];
const QUALITIES: readonly Choice<VideoOptions['quality']>[] = [{ value: 'standard', label: 'Standard (up to 1280 px)' }, { value: 'high', label: 'High (up to 1920 px)' }];

export function VideoExportSettings({ settings, busy, onChange }: Readonly<{
  settings: VideoOptions;
  busy: boolean;
  onChange: (settings: VideoOptions) => void;
}>) {
  return <fieldset className="video-export-settings" disabled={busy}>
    <legend>Video settings</legend>
    <VideoChoice label="Motion" value={settings.motion} choices={MOTIONS} onChange={(motion) => onChange({ ...settings, motion })} />
    <VideoChoice label="Duration" value={settings.durationSeconds} choices={DURATIONS} onChange={(durationSeconds) => onChange({ ...settings, durationSeconds })} />
    <VideoChoice label="Target frame rate" value={settings.fps} choices={FRAME_RATES} onChange={(fps) => onChange({ ...settings, fps })} />
    <VideoChoice label="Video aspect" value={settings.aspect} choices={ASPECTS} onChange={(aspect) => onChange({ ...settings, aspect })} />
    <VideoChoice label="Video quality" value={settings.quality} choices={QUALITIES} onChange={(quality) => onChange({ ...settings, quality })} />
  </fieldset>;
}
