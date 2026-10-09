import os

root_dir = r"c:\LNCZ\proyecto-catastro-2026"
keywords = ["construc", "edifica", "bloque", "mejora"]

matches = []

for base, dirs, files in os.walk(root_dir):
    # Skip node_modules, .git, venv, dist, build, .cache, etc.
    if any(skip in base.lower() for skip in ['node_modules', '.git', 'venv', 'dist', 'build', '.cache', '__pycache__']):
        continue
    for file in files:
        if file.endswith(('.js', '.jsx', '.py', '.sql', '.md', '.json', '.txt', '.html', '.css')):
            filepath = os.path.join(base, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_no, line in enumerate(f, 1):
                        lower = line.lower()
                        if any(k in lower for k in keywords):
                            # filter out obvious false positives like constructor, blocking, typing construct, etc.
                            if 'constructor' in lower and 'construc' not in lower.replace('constructor', ''):
                                continue
                            if 'bloqueo' in lower and 'bloque' not in lower.replace('bloqueo', ''):
                                continue
                            matches.append((filepath, line_no, line.strip()))
            except Exception:
                pass

print(f"Total matches found: {len(matches)}")
for m in matches[:50]:
    rel = os.path.relpath(m[0], root_dir)
    print(f"{rel}:{m[1]}: {m[2][:120]}")
