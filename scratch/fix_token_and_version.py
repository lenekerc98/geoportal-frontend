import os
import json

movil_dir = r'C:\LNCZ\proyecto-catastro-2026\movil'

# 1. Update package.json
pkg_path = os.path.join(movil_dir, 'package.json')
with open(pkg_path, 'r', encoding='utf-8') as f:
    pkg = json.load(f)
pkg['version'] = '4.7.7'
with open(pkg_path, 'w', encoding='utf-8') as f:
    json.dump(pkg, f, indent=2)
print('[OK] Updated package.json version to 4.7.7')

# 2. Update MobileHeader.jsx
header_path = os.path.join(movil_dir, 'src', 'components', 'MobileHeader.jsx')
with open(header_path, 'r', encoding='utf-8') as f:
    header = f.read()
header = header.replace('>v4.7.4</span>', '>v4.7.7</span>')
with open(header_path, 'w', encoding='utf-8') as f:
    f.write(header)
print('[OK] Updated MobileHeader.jsx to v4.7.7')

# 3. Update LoginMobile.jsx
login_path = os.path.join(movil_dir, 'src', 'pages', 'Login', 'LoginMobile.jsx')
with open(login_path, 'r', encoding='utf-8') as f:
    login = f.read()
login = login.replace('v4.7.4 · Campo Oficial', 'v4.7.7 · Campo Oficial')
with open(login_path, 'w', encoding='utf-8') as f:
    f.write(login)
print('[OK] Updated LoginMobile.jsx to v4.7.7')

# 4. Update api.js to include ensureValidToken definition and update checkPredioConflict
api_path = os.path.join(movil_dir, 'src', 'services', 'api.js')
with open(api_path, 'r', encoding='utf-8') as f:
    api = f.read()

ensure_valid_token_def = '''export async function ensureValidToken(authInfo = {}) {
  let token = authInfo?.token || (await getSetting('auth_token', ''));
  const isExpiredOrOffline = !token || token.startsWith('offline_') || (() => {
    try {
      const payload = parseJwt(token);
      if (payload && payload.exp && payload.exp * 1000 < Date.now() + 60000) {
        return true;
      }
    } catch (e) {}
    return false;
  })();

  if (isExpiredOrOffline) {
    try {
      const authDataStr = await getSetting('auth_data', '{}');
      const authData = JSON.parse(authDataStr || '{}');
      const isBrig = authData?.role === 'brigadista' || authData?.isBrigadista || authInfo?.role === 'brigadista' || authInfo?.isBrigadista;
      const nomFull = authData?.nombre || authInfo?.nombre || '';
      if (isBrig && nomFull) {
        const parts = nomFull.replace(/\\(Brigadista\\)/gi, '').trim().split(' ');
        const nom = parts[0] || 'Brigadista';
        const ape = parts.slice(1).join(' ') || 'Urdaneta';
        const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
        const brigRes = await loginBrigadistaToServer(nom, ape, baseUrl);
        if (brigRes && brigRes.success && brigRes.token) {
          token = brigRes.token;
          await setSetting('auth_token', token);
          return token;
        }
      }
    } catch (e) {
      console.warn('Error auto-renovando token brigadista:', e);
    }
  }
  return token;
}
'''

# Check if ensureValidToken definition is already present
if 'export async function ensureValidToken(' not in api:
    target_pos = 'export async function checkPredioConflict(predio, authInfo = {}) {'
    api = api.replace(target_pos, ensure_valid_token_def + '\n' + target_pos)
    print('[OK] Added ensureValidToken definition before checkPredioConflict')

# Update checkPredioConflict to use ensureValidToken and 12s timeout
old_check_conflict = '''export async function checkPredioConflict(predio, authInfo = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = authInfo?.token || (await getSetting('auth_token', ''));'''

new_check_conflict = '''export async function checkPredioConflict(predio, authInfo = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = await ensureValidToken(authInfo);'''

if old_check_conflict in api:
    api = api.replace(old_check_conflict, new_check_conflict)
    print('[OK] Updated checkPredioConflict to use ensureValidToken and 12s timeout')
else:
    print('[NOTE] checkPredioConflict already had updated content or different formatting')

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(api)
print('[OK] Saved api.js')
