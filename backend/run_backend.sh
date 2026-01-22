#!/bin/bash
cd "$(dirname "$0")"


# Use absolute paths for SSL to prevent file not found errors
KEY_Path="$(pwd)/key.pem"
CERT_Path="$(pwd)/cert.pem"

# Run with uv and uvicorn
uv run uvicorn main:app --host 0.0.0.0 --port 5000 --ssl-keyfile "$KEY_Path" --ssl-certfile "$CERT_Path" --reload
