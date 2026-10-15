"""ASGI Entrypoint for backward compatibility.

Imports and exposes the production-grade application factory from app.main.
"""

from app.main import app, create_app

__all__ = ["app", "create_app"]

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("server:app", host=host, port=port, reload=False)
