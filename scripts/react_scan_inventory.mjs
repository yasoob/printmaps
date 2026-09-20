import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import process from 'node:process';
import console from 'node:console';

const [resultsDirectory, outputFile] = process.argv.slice(2);
if (!resultsDirectory || !outputFile) throw new Error('Usage: node scripts/react_scan_inventory.mjs <Playwright output directory> <report.json>');
const root = process.cwd();
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
  uncovered: components.filter(({ observed }) => !observed),
  passiveAliasesAndProviders: [...passive.values()],
  runtime: [...runtime.values()].map((entry) => ({ ...entry, tests: [...entry.tests], sources: [...entry.sources], owners: [...entry.owners] })),
};
fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  runtimeNames: report.runtimeNames, sourceComponents: report.sourceComponents, creationSites: report.sourceCreationSites,
  uncovered: report.uncovered.map(({ name, implementation }) => `${implementation}#${name}`),
}, null, 2));
process.exitCode = report.uncovered.length ? 1 : 0;
