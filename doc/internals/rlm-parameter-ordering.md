# RLM Parameter Ordering

RLM positional tool arguments now follow the same required-first ordering in both:
- Python stub signatures (`montyPreambleBuild`)
- Runtime argument conversion (`rlmArgsConvert`)

This is centralized in `montyParameterEntriesBuild`.

```mermaid
flowchart LR
  Schema[Tool JSON Schema]
  Order[montyParameterEntriesBuild\nrequired first, then optional]
  Stub[montyPreambleBuild\nPython def signature]
  Convert[rlmArgsConvert\npositional arg binding]

  Schema --> Order
  Order --> Stub
  Order --> Convert
```
