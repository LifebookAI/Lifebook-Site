import json, sys, os
p = os.path.join("logs","build-progress.json")
try:
    with open(p, "rb") as f: data = f.read().replace(b"\r\n", b"\n").replace(b"\r", b"")
    obj = json.loads(data.decode("utf-8"))
    text = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    with open(p, "wb") as f: f.write(text.encode("utf-8"))
except Exception as e:
    print(f"[pretty] skip: {e}", file=sys.stderr)
