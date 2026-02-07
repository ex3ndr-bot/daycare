# Monty Python plugin

## Overview
The Monty Python plugin registers a `python` tool that runs sandboxed Python snippets using `@pydantic/monty`.

## Tool
- `python`
  - Params: `code`, optional `inputs`, optional `typeCheck`, optional `scriptName`, optional `limits`
  - Returns the evaluated output from the Python snippet.
  - Returns a structured tool error for parse, type-check, and runtime failures.

## Notes
- The plugin resolves Monty from `node_modules/@pydantic/monty/index.js` at runtime.
- This path-based load is intentional for `@pydantic/monty@0.0.3`, where the package root export points to a missing `wrapper.js` file.
