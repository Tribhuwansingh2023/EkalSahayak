"""ASGI Entrypoint for backward compatibility.

Imports and exposes the production-grade application factory from app.main.
"""

from app.main import app, create_app

__all__ = ["app", "create_app"]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
