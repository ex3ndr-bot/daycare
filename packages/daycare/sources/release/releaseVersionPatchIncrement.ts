const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Increments the patch segment of a semantic version.
 * Expects: value is a valid semver string.
 */
export function releaseVersionPatchIncrement(value: string): string {
  const match = SEMVER_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid semantic version: ${value}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;

  return `${major}.${minor}.${patch}`;
}
