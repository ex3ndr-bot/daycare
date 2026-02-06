export const SANDBOX_PACKAGE_MANAGERS = ["go", "java", "node", "python"] as const;

export type SandboxPackageManager = (typeof SANDBOX_PACKAGE_MANAGERS)[number];

export const SANDBOX_PACKAGE_MANAGER_DOMAINS: Record<SandboxPackageManager, string[]> = {
  go: [
    "proxy.golang.org",
    "sum.golang.org",
    "index.golang.org",
    "golang.org"
  ],
  java: [
    "repo.maven.apache.org",
    "repo1.maven.org",
    "plugins.gradle.org",
    "services.gradle.org"
  ],
  // Node preset intentionally covers npm, pnpm, yarn, and bun workflows.
  node: [
    "registry.npmjs.org",
    "registry.yarnpkg.com",
    "repo.yarnpkg.com",
    "bun.sh"
  ],
  python: ["pypi.org", "files.pythonhosted.org", "pypi.python.org"]
};
