# RLM Parameter Ordering

RLM positional tool arguments now follow the same required-first ordering in both:
- Python stub signatures (`rlmPreambleBuild`)
- Runtime argument conversion (`rlmArgsConvert`)

This is centralized in `rlmParameterEntriesBuild`.

```mermaid
flowchart LR
  Schema[Tool JSON Schema]
  Order[rlmParameterEntriesBuild\nrequired first, then optional]
  Stub[rlmPreambleBuild\nPython def signature]
  Convert[rlmArgsConvert\npositional arg binding]

  Schema --> Order
  Order --> Stub
  Order --> Convert
```
