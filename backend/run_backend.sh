#!/bin/bash
cd "$(dirname "$0")"
uvicorn main:app --reload --host 0.0.0.0 --port 5000 --ssl-keyfile key.pem --ssl-certfile cert.pem
