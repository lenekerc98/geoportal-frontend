import os

backend_dir = r'c:\LNCZ\proyecto-catastro-2026\backend'
upload_paths = [
    os.path.join(backend_dir, 'uploads'),
    os.path.join(backend_dir, 'app', 'uploads'),
    os.path.join(backend_dir, 'static', 'uploads'),
    r'c:\LNCZ\proyecto-catastro-2026\frontend\public\uploads'
]

for p in upload_paths:
    print(f"Checking path: {p} -> Exists: {os.path.exists(p)}")
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            for f in files:
                print(f"  Found file: {os.path.join(root, f)}")

# Search for any file named *f211855acecc* or *bandera_urdaneta*
for root, dirs, files in os.walk(r'c:\LNCZ\proyecto-catastro-2026'):
    if 'node_modules' in root or '.git' in root or 'dist' in root:
        continue
    for f in files:
        if 'f211855' in f or 'bandera_urdaneta' in f or 'logo_2' in f:
            print(f"Found match: {os.path.join(root, f)}")
