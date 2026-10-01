#!/usr/bin/env python3
"""
TracePilot - Frontend Encoding Checker
=======================================
Scans frontend source files for UTF-8 mojibake / encoding corruption.

Does NOT flag valid Unicode: bullet, arrow, emdash, checkmarks, etc.

Usage:
    python scripts/check_admin_encoding.py          # Admin files only
    python scripts/check_admin_encoding.py --all    # All frontend files

Exit: 0 = clean, 1 = corruption found
"""
import sys
import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

ADMIN_TARGETS = [
    "frontend/src/pages",
    "frontend/src/components/admin",
    "frontend/src/components/dashboard",
]

ALL_TARGETS = [
    "frontend/src/pages",
    "frontend/src/components",
]

EXTENSIONS = {".tsx", ".ts", ".jsx", ".js", ".css"}

# Mojibake substrings that appear when UTF-8 source was corrupted via Latin-1
# round-trip encoding. Valid Unicode like bullet, arrow, emdash are NOT here.
BAD = [
    ("\ufffd", "Unicode replacement char U+FFFD"),
    ("\u00c3\u00a2", "double-encoding prefix - was box/arrow/bullet"),
    ("\u00c3\u00a0", "double-encoding sequence variant 2"),
    ("\u00c3\u00a3", "double-encoding sequence variant 3"),
    ("\u00c3\u0097", "should be multiplication sign x"),
    ("\u00c2\u00b7", "should be middle dot"),
    ("\u00c2\u00b0", "should be degree sign"),
    ("\u00c2\u00a9", "should be copyright sign"),
    ("\u00e2\u0080\u0099", "corrupted right single quote"),
    ("\u00e2\u0080\u009c", "corrupted left double quote"),
    ("\u00e2\u0080\u009d", "corrupted right double quote"),
    ("\u00e2\u0080\u0093", "corrupted en-dash"),
    ("\u00e2\u0080\u0094", "corrupted em-dash"),
    ("\u00f0\u009f", "corrupted emoji prefix"),
]

# Decode the escape sequences at runtime
BAD = [(pat.encode().decode("unicode_escape"), desc) for pat, desc in BAD]


def collect_files(targets, admin_only=True):
    found, seen = [], set()
    for rel in targets:
        d = REPO_ROOT / rel
        if not d.exists():
            continue
        for p in sorted(d.rglob("*")):
            if p.suffix not in EXTENSIONS or p in seen:
                continue
            if admin_only and "pages" in p.parts and not p.name.startswith("Admin"):
                continue
            seen.add(p)
            found.append(p)
    return found


def scan_file(path):
    issues = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        return [(0, "", "ERROR: " + str(exc))]
    for lineno, line in enumerate(text.splitlines(), 1):
        for pat, desc in BAD:
            if pat in line:
                preview = line.strip()[:120]
                issues.append((lineno, preview, desc))
                break
    return issues


def relp(path):
    try:
        return str(path.relative_to(REPO_ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def main():
    parser = argparse.ArgumentParser(description="TracePilot encoding checker")
    parser.add_argument("--all", action="store_true",
                        help="Scan all frontend files, not just Admin")
    args = parser.parse_args()
    targets = ALL_TARGETS if args.all else ADMIN_TARGETS
    admin_only = not args.all
    files = collect_files(targets, admin_only=admin_only)
    if not files:
        print("No source files found.")
        return 0
    scope = "ALL frontend" if args.all else "Admin-related frontend"
    sep = "=" * 60
    print("TracePilot - Encoding Checker")
    print(sep)
    print("Scope : " + scope)
    print("Files : " + str(len(files)) + " files scanned")
    print(sep)
    print("")
    total, dirty = 0, 0
    for path in files:
        file_issues = scan_file(path)
        if not file_issues:
            continue
        dirty += 1
        total += len(file_issues)
        print("  [CORRUPT] " + relp(path))
        for lineno, preview, desc in file_issues:
            print("    Line " + str(lineno) + ": " + desc)
            print("           " + repr(preview))
        print("")
    print(sep)
    if total == 0:
        print("OK  No corruption found across " + str(len(files)) + " file(s).")
        return 0
    print("FAIL  " + str(total) + " issue(s) in " + str(dirty) + " file(s).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
