import { describe, expect, it } from "vitest";
import { inferenceErrorAnthropicPromptOverflowIs } from "./inferenceErrorAnthropicPromptOverflowIs.js";

describe("inferenceErrorAnthropicPromptOverflowIs", () => {
    it("returns true for anthropic invalid_request_error prompt-overflow payloads", () => {
        const result = inferenceErrorAnthropicPromptOverflowIs({
            providerId: "anthropic",
            errorMessage:
                '400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 216326 tokens > 200000 maximum"},"request_id":"req_011CYLhsSnjf9m1xYbYsiK7c"}'
        });

        expect(result).toBe(true);
    });

    it("returns false when provider is not anthropic", () => {
        const result = inferenceErrorAnthropicPromptOverflowIs({
            providerId: "openai",
            errorMessage:
                '400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 216326 tokens > 200000 maximum"}}'
        });

        expect(result).toBe(false);
    });

    it("returns false when status code is not 400", () => {
        const result = inferenceErrorAnthropicPromptOverflowIs({
            providerId: "anthropic",
            errorMessage:
                '429 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 216326 tokens > 200000 maximum"}}'
        });

        expect(result).toBe(false);
    });

    it("returns false when error type is not invalid_request_error", () => {
        const result = inferenceErrorAnthropicPromptOverflowIs({
            providerId: "anthropic",
            errorMessage:
                '400 {"type":"error","error":{"type":"rate_limit_error","message":"prompt is too long: 216326 tokens > 200000 maximum"}}'
        });

        expect(result).toBe(false);
    });

    it("returns false when message is missing required overflow fragments", () => {
        const result = inferenceErrorAnthropicPromptOverflowIs({
            providerId: "anthropic",
            errorMessage: '400 {"type":"error","error":{"type":"invalid_request_error","message":"context too big"}}'
        });

        expect(result).toBe(false);
    });
});
