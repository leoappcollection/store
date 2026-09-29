#!/usr/bin/env python3
"""Export the ENGLISH crypto-edition catalog for the separate crypto store.

Reuses export_catalog.py's full pipeline (same bot grouping logic, same
pids) but overrides:
  - language: data only (Burmese descriptions/requirements are skipped)
  - pricing:  flat $1 USD per paid product (no MMK tiers)
  - BOT_USERNAME: CRYPTO_BOT_USERNAME placeholder until he creates the bot

Output: ../dist/data/  (products.json + products/<pid>.json)
Covers must be copied separately from the main store's dist/data/covers/.
"""
import os
import sys
import json

HERE = os.path.dirname(os.path.abspath(__file__))
MAIN_TOOLS = os.path.normpath(os.path.join(
    HERE, "..", "..", "software-store", "tools"))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "dist", "data"))

sys.path.insert(0, MAIN_TOOLS)
import export_catalog as ec

# flat $1 pricing for the crypto store
ec.PRICE_MMK = 1
ec.PRICE_PREMIUM = 1
ec.price_of = lambda name: 1  # noqa: E731
# placeholder — replaced with the real crypto-bot username once created
ec.BOT_USERNAME = "CRYPTO_BOT_USERNAME"
# English descriptions for the crypto store (translated from Burmese)
_en_desc_path = os.path.join(HERE, "descriptions_en.json")
if os.path.exists(_en_desc_path):
    with open(_en_desc_path, encoding="utf-8") as f:
        ec.DESCRIPTIONS = json.load(f)
else:
    ec.DESCRIPTIONS = {}
# requirements stay skipped (Burmese-only)
ec.REQUIREMENTS = {}
ec.OUT_DIR = OUT_DIR

if __name__ == "__main__":
    sys.exit(ec.main())
