#!/bin/bash

# Serve production build
cd apps/web/dist
python3 -m http.server 9001
