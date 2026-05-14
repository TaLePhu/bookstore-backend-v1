import path from 'path';
import Module from 'module';

const rootDir = __dirname;
const aliases: Record<string, string> = {
  '@': rootDir,
  '@config': path.join(rootDir, 'config'),
  '@controllers': path.join(rootDir, 'controllers'),
  '@services': path.join(rootDir, 'services'),
  '@repositories': path.join(rootDir, 'repositories'),
  '@entities': path.join(rootDir, 'entities'),
  '@dtos': path.join(rootDir, 'dtos'),
  '@middlewares': path.join(rootDir, 'middlewares'),
  '@routes': path.join(rootDir, 'routes'),
  '@utils': path.join(rootDir, 'utils'),
};

const moduleWithInternals = Module as typeof Module & {
  _resolveFilename: (...args: any[]) => string;
  __bookstoreAliasesRegistered?: boolean;
};

if (!moduleWithInternals.__bookstoreAliasesRegistered) {
  const originalResolveFilename = moduleWithInternals._resolveFilename;

  moduleWithInternals._resolveFilename = function resolveAlias(request: string, ...args: any[]) {
    const alias = Object.keys(aliases)
      .sort((left, right) => right.length - left.length)
      .find((key) => request === key || request.startsWith(`${key}/`));

    if (alias) {
      const mappedRequest = path.join(aliases[alias], request.slice(alias.length));
      return originalResolveFilename.call(this, mappedRequest, ...args);
    }

    return originalResolveFilename.call(this, request, ...args);
  };

  moduleWithInternals.__bookstoreAliasesRegistered = true;
}
