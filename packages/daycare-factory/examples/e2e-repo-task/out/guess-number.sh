#!/usr/bin/env bash
guess="$1"
if [[ "$guess" =~ ^[0-9]+$ ]] && [ "$guess" -ge 1 ] && [ "$guess" -le 10 ] && [ "$guess" -eq 7 ]; then
  echo "correct"
else
  echo "wrong"
fi
