path = r'C:\LNCZ\proyecto-catastro-2026\backend\app\main.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''# Configuración segura de orígenes CORS
frontend_url_env = os.getenv("FRONTEND_URL", "*")
default_allowed_origins = [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://127.0.0.1:5173",
    "https://127.0.0.1:5173",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "https://127.0.0.1:3000",
    "http://localhost:8000",
    "https://localhost:8000"
]

if frontend_url_env == "*":
    origins = default_allowed_origins
    origin_regex = r"https?://.*"
else:
    origins = [url.strip() for url in frontend_url_env.split(",") if url.strip()]
    for o in default_allowed_origins:
        if o not in origins:
            origins.append(o)
    origin_regex = None'''

replacement = '''# Configuración segura de orígenes CORS con soporte total para Capacitor Móvil
frontend_url_env = os.getenv("FRONTEND_URL", "*")
default_allowed_origins = [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://127.0.0.1:5173",
    "https://127.0.0.1:5173",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "https://127.0.0.1:3000",
    "http://localhost:8000",
    "https://localhost:8000",
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
    "ionic://localhost"
]

origins = list(default_allowed_origins)
if frontend_url_env and frontend_url_env != "*":
    for u in frontend_url_env.split(","):
        if u.strip() and u.strip() not in origins:
            origins.append(u.strip())

origin_regex = r"(https?://.*|capacitor://.*|ionic://.*)"'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('[OK] Updated CORS in backend main.py')
else:
    print('[ERROR] Target not found in main.py')
