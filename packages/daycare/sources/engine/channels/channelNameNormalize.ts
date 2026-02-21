const CHANNEL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/**
 * Normalizes and validates a channel name for storage and signal keys.
 * Expects: lowercase letters, numbers, hyphen, underscore; max 80 chars.
 */
export function channelNameNormalize(name: string): string {
    const normalized = name.trim().toLowerCase();
    if (!CHANNEL_NAME_PATTERN.test(normalized)) {
        throw new Error(
            "Channel name must be Slack-style: lowercase letters, numbers, hyphen, underscore (max 80 chars)."
        );
    }
    return normalized;
}
