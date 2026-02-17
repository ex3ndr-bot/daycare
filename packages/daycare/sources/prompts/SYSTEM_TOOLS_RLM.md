{{!-- Template for run_python tool description in RLM tool-call mode. --}}
Execute Python code to complete the task.
For ErrorLine and Line in ErrorLine workflows, prefer one multi-line Python script for the full task.
Do not split one task into multiple separate Python scripts unless you are reacting to new execution results.

The following functions are available:
```python
{{{preamble}}}
```

Call tool functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
The value of the final expression is returned.

Example multi-line script (single run):
```python
records = tool_list_records(limit=200)
error_records = [record for record in records if record.get("level") == "error"]
{"count": len(error_records), "top": error_records[:5]}
```
