type InferenceErrorAnthropicPromptOverflowIsOptions = {
    providerId: string;
    errorMessage?: string;
};

/**
 * Detects Anthropic prompt-overflow invalid_request_error payloads.
 * Expects: provider error message is formatted as `400 { ...json... }`.
 */
export function inferenceErrorAnthropicPromptOverflowIs(
    options: InferenceErrorAnthropicPromptOverflowIsOptions
): boolean {
    if (options.providerId !== "anthropic") {
        return false;
    }
    if (!options.errorMessage) {
        return false;
    }

    const extracted = statusAndPayloadExtract(options.errorMessage);
    if (!extracted || extracted.statusCode !== "400") {
        return false;
    }

    const payload = payloadParse(extracted.payload);
    if (!payload) {
        return false;
    }
    if (payload.errorType !== "invalid_request_error") {
        return false;
    }
    if (!payload.message.includes("prompt is too long: ")) {
        return false;
    }
    if (!payload.message.includes("maximum")) {
        return false;
    }
    return true;
}

function statusAndPayloadExtract(value: string): { statusCode: string; payload: string } | null {
    const normalized = value.trim();
    const firstSpace = normalized.indexOf(" ");
    if (firstSpace <= 0) {
        return null;
    }
    const statusCode = normalized.slice(0, firstSpace).trim();
    const payload = normalized.slice(firstSpace + 1).trim();
    if (payload.length === 0 || !payload.startsWith("{")) {
        return null;
    }
    return { statusCode, payload };
}

function payloadParse(value: string): { errorType: string; message: string } | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return null;
    }
    if (!recordIs(parsed)) {
        return null;
    }
    const error = parsed.error;
    if (!recordIs(error)) {
        return null;
    }
    if (typeof error.type !== "string") {
        return null;
    }
    if (typeof error.message !== "string") {
        return null;
    }
    return {
        errorType: error.type,
        message: error.message
    };
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
