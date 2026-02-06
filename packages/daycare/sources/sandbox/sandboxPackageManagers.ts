export const SANDBOX_PACKAGE_MANAGERS = ["go", "node", "python"] as const;

export type SandboxPackageManager = (typeof SANDBOX_PACKAGE_MANAGERS)[number];

export const SANDBOX_PACKAGE_MANAGER_DOMAINS: Record<SandboxPackageManager, string[]> = {
  go: [
    "proxy.golang.org",
    "sum.golang.org",
    "index.golang.org",
    "golang.org"
  ],
  node: ["registry.npmjs.org", "registry.yarnpkg.com"],
  python: ["pypi.org", "files.pythonhosted.org", "pypi.python.org"]
};
