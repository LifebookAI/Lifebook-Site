import sys
bad = []
for p in sys.argv[1:]:
    try:
        with open(p, "rb") as f:
            data = f.read()
        if b"\r" in data:
            for i, line in enumerate(data.splitlines(True), 1):
                if b"\r" in line:
                    bad.append(f"{p}:{i}")
    except Exception as e:
        print(f"[skip] {p}: {e}", file=sys.stderr)
if bad:
    print("Carriage return characters found:", file=sys.stderr)
    for b in bad[:50]:
        print(b, file=sys.stderr)
    sys.exit(1)
sys.exit(0)
