import type { FeatureHighlight } from '../featureIcons';
import type { MarketingImage } from '../media';

/**
A media entry plus optional on-page caption text. `title` is the bold caption line.
*/
export type SectionImage = MarketingImage & {
  caption?: string;
  title?: string;
};

type SectionBase = {
  /**
  Anchor id; defaults to a slug of the title.
  */
  id?: string;
  title: string;
  paragraphs?: readonly string[];
};

/**
Default section (no `kind`): heading, paragraphs, optional highlights, points and images.
*/
export type ProseSection = SectionBase & {
  kind?: 'prose';
  paragraphs: readonly string[];
  highlights?: readonly FeatureHighlight[];
  image?: SectionImage;
  /**
  `below` (default) or `beside`, which puts text and image side by side on wide screens.
  */
  imagePosition?: 'below' | 'beside';
  imageRow?: readonly SectionImage[];
  points?: readonly string[];
  showExportFormats?: boolean;
  showPhotoshopHandoff?: boolean;
};

/**
Numbered how-to steps. Never emits HowTo schema.
*/
export type StepsSection = SectionBase & {
  kind: 'steps';
  steps: readonly {
    title: string;
    body: string;
    image?: SectionImage;
  }[];
};

/**
`true` renders a check, `false` a cross, strings render as text.
*/
export type ComparisonCell = boolean | string | { value: boolean | string; note?: string };

export type ComparisonSection = SectionBase & {
  kind: 'comparison';
  /**
  Column headings after the row-label column, e.g. ['Print Map Studio', 'printmaps.net'].
  */
  columns: readonly string[];
  /**
  Zero-based index into `columns` to tint as the primary column.
  */
  highlightColumn?: number;
  rowHeader?: string;
  rows: readonly { label: string; cells: readonly ComparisonCell[] }[];
  caption?: string;
  footnotes?: readonly string[];
};

/**
Plain data table, e.g. paper sizes with millimetres and pixel dimensions.
*/
export type TableSection = SectionBase & {
  kind: 'table';
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /**
  Render the first cell of each row as a row header (default true).
  */
  firstColumnIsHeader?: boolean;
  caption?: string;
  footnotes?: readonly string[];
};

/**
Term/definition pairs, e.g. a glossary or spec sheet.
*/
export type DefinitionsSection = SectionBase & {
  kind: 'definitions';
  items: readonly { term: string; definition: string }[];
};

export type GallerySection = SectionBase & {
  kind: 'gallery';
  images: readonly SectionImage[];
  columns?: 2 | 3 | 4;
};

export type CalloutSection = SectionBase & {
  kind: 'callout';
  tone?: 'tip' | 'note' | 'important';
  paragraphs: readonly string[];
  link?: { href: string; label: string };
};

/**
 * Muted looping clip. Pass a media entry that has a `video` field; its `src` is the poster.
 * Plays only while visible and never when the reader prefers reduced motion.
 */
export type VideoSection = SectionBase & {
  kind: 'video';
  media: MarketingImage;
  caption?: string;
  /**
  WebVTT captions, if the clip has speech or on-screen text worth transcribing.
  */
  tracks?: readonly { src: string; srclang: string; label: string; kind?: 'captions' | 'subtitles' | 'descriptions' }[];
};

/**
One image with numbered annotations beside it.
*/
export type ExampleSection = SectionBase & {
  kind: 'example';
  image: SectionImage;
  notes: readonly { title: string; body: string }[];
};

export type PageSection =
  | ProseSection
  | StepsSection
  | ComparisonSection
  | TableSection
  | DefinitionsSection
  | GallerySection
  | CalloutSection
  | VideoSection
  | ExampleSection;
