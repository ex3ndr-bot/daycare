#!/usr/bin/env bash
WINNING=7
if [ "$1" = "$WINNING" ]; then
  echo "correct"
else
  echo "wrong"
fi
