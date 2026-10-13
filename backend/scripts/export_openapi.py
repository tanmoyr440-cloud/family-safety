"""Export FastAPI OpenAPI schema to openapi.json."""

import json
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app  # noqa: E402


def export_openapi() -> None:
    schema = app.openapi()
    output_path = backend_dir / "openapi.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)
    count = len(schema["paths"])
    print(f"OpenAPI schema successfully written to {output_path} with {count} endpoints.")


if __name__ == "__main__":
    export_openapi()
