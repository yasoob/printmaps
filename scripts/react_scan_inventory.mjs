import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import process from 'node:process';
import console from 'node:console';

const [resultsDirectory, outputFile] = process.argv.slice(2);
if (!resultsDirectory || !outputFile) throw new Error('Usage: node scripts/react_scan_inventory.mjs <Playwright output directory> <report.json>');
const root = process.cwd();
// Source targets that no editor interaction can mount. Each entry names the verified reason and a
// check that must keep holding; the report fails if an entry is observed or its check breaks.
const UNREACHABLE = [
  ...['VideoDialogSurface', 'VideoExportDialog'].map((name) => ({
    key: `src/app/studio/StudioVideoControls.tsx#${name}`,
    reason: 'Only StudioVideoControls creates it, and StudioVideoControls has no creation site since video moved into the Export workspace; covered by unit tests.',
    holds: () => !hasSites('src/app/studio/StudioVideoControls.tsx#StudioVideoControls'),
  })),
  {
    key: 'src/app/components/VideoExportDialog.tsx#View',
    reason: 'The standalone dialog view is only reached through VideoExportDialog (unreachable above); the workspace uses VideoExportPanelView.',
    holds: () => !hasSites('src/app/studio/StudioVideoControls.tsx#StudioVideoControls'),
  },
  ...['SelectGroup', 'SelectLabel', 'SelectSeparator'].map((name) => ({
    key: `src/components/ui/select.tsx#${name}`,
    reason: 'Only the grouped-options branch of SimpleSelect renders it, and no caller passes grouped options.',
    holds: () => !sources.some((file) => !file.endsWith('components/ui/select.tsx') && fs.readFileSync(file, 'utf8').includes('SimpleSelectGroup')),
  })),
];
const hasSites = (key) => sites.has(key);
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const sources = files(path.join(root, 'src')).filter((file) => /\.[jt]sx?$/.test(file));
const program = ts.createProgram(sources, {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  baseUrl: root, paths: { '@/*': ['src/*'] }, allowJs: true,
});
const checker = program.getTypeChecker();
const sites = new Map();
const passive = new Map();
for (const source of program.getSourceFiles()) {
  if (!sources.includes(source.fileName)) continue;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (/^[A-Z]/.test(tag)) {
        let symbol = checker.getSymbolAtLocation(node.tagName);
        if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
        const implementation = declaration ? relative(declaration.getSourceFile().fileName) : null;
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const creation = { file: relative(source.fileName), line, tag };
        if (implementation?.startsWith('src/')) {
          const name = symbol.name;
          const initializer = ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
          const isProvider = initializer && ts.isCallExpression(initializer) && initializer.expression.getText().endsWith('createContext');
          const isIconDelivery = (ts.isBindingElement(declaration) || ts.isParameter(declaration)
            || (initializer && ts.isConditionalExpression(initializer)))
            && checker.getTypeAtLocation(node.tagName).getCallSignatures().every((signature) =>
              signature.declaration && !relative(signature.declaration.getSourceFile().fileName).startsWith('src/'));
          const isPassiveAlias = isIconDelivery || (initializer && (ts.isElementAccessExpression(initializer) || ts.isPropertyAccessExpression(initializer)));
          const collection = isProvider || isPassiveAlias ? passive : sites;
          const key = `${implementation}#${name}`;
          const entry = collection.get(key) ?? { name, implementation, sites: [] };
          entry.sites.push(creation);
          if (initializer && ts.isCallExpression(initializer) && initializer.arguments.length === 1 && ts.isIdentifier(initializer.arguments[0])) {
            entry.runtimeName = initializer.arguments[0].text;
          }
          collection.set(key, entry);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const inventories = files(path.resolve(resultsDirectory)).filter((file) => path.basename(file) === 'runtime-inventory.json')
  .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const runtime = new Map();
for (const inventory of inventories) {
  for (const instance of inventory.instances) {
    const entry = runtime.get(instance.component) ?? { name: instance.component, tests: new Set(), sources: new Set(), owners: new Set(), instances: 0 };
    entry.tests.add(inventory.test);
    if (instance.source) entry.sources.add(instance.source);
    entry.owners.add(instance.ownerPath.join(' > '));
    entry.instances++;
    runtime.set(instance.component, entry);
  }
}
const components = [...sites.values()].map((component) => {
  const observed = runtime.get(component.runtimeName ?? component.name);
  return { ...component, observed: Boolean(observed), interactions: observed ? [...observed.tests].sort() : [] };
}).sort((a, b) => a.implementation.localeCompare(b.implementation) || a.name.localeCompare(b.name));
const report = {
  generatedAt: new Date().toISOString(),
  input: resultsDirectory,
  runtimeNames: runtime.size,
  sourceComponents: components.length,
  sourceCreationSites: components.reduce((total, component) => total + component.sites.length, 0),
  components,
  uncovered: components.filter(({ observed, implementation, name }) => !observed && !UNREACHABLE.some((entry) => entry.key === `${implementation}#${name}`)),
  unreachable: UNREACHABLE.map(({ key, reason, holds }) => {
    const component = components.find(({ implementation, name }) => `${implementation}#${name}` === key);
    return { key, reason, inSource: Boolean(component), observed: Boolean(component?.observed), holds: holds() };
  }),
  passiveAliasesAndProviders: [...passive.values()],
  runtime: [...runtime.values()].map((entry) => ({ ...entry, tests: [...entry.tests], sources: [...entry.sources], owners: [...entry.owners] })),
};
fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  runtimeNames: report.runtimeNames, sourceComponents: report.sourceComponents, creationSites: report.sourceCreationSites,
  uncovered: report.uncovered.map(({ name, implementation }) => `${implementation}#${name}`),
  unreachable: report.unreachable.map(({ key }) => key),
  staleUnreachable: report.unreachable.filter(({ inSource, observed, holds }) => !inSource || observed || !holds),
}, null, 2));
const stale = report.unreachable.some(({ inSource, observed, holds }) => !inSource || observed || !holds);
process.exitCode = report.uncovered.length || stale ? 1 : 0;
