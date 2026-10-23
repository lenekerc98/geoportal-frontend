import json
import os
import shutil
from PIL import Image

movil_dir = r'C:\LNCZ\proyecto-catastro-2026\movil'
frontend_dir = r'C:\LNCZ\proyecto-catastro-2026\frontend'

# 1. Update capacitor.config.json
cap_path = os.path.join(movil_dir, 'capacitor.config.json')
with open(cap_path, 'r', encoding='utf-8') as f:
    cfg = json.load(f)
cfg['appId'] = 'com.gad.catastromovil'
cfg['appName'] = 'Catastro Móvil 2026'
with open(cap_path, 'w', encoding='utf-8') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('[OK] Updated capacitor.config.json to com.gad.catastromovil / Catastro Móvil 2026')

# 2. Update android/app/build.gradle
gradle_path = os.path.join(movil_dir, 'android', 'app', 'build.gradle')
with open(gradle_path, 'r', encoding='utf-8') as f:
    gradle = f.read()

gradle = gradle.replace('applicationId "com.gad.catastromovil.ecc"', 'applicationId "com.gad.catastromovil"')
gradle = gradle.replace('versionCode 46', 'versionCode 47')
gradle = gradle.replace('versionName "4.7.6"', 'versionName "4.7.7"')
with open(gradle_path, 'w', encoding='utf-8') as f:
    f.write(gradle)
print('[OK] Updated build.gradle: applicationId com.gad.catastromovil, v4.7.7, code 47')

# 3. Update strings.xml
strings_path = os.path.join(movil_dir, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml')
with open(strings_path, 'r', encoding='utf-8') as f:
    strings = f.read()

strings = strings.replace('Catastro Móvil ECC', 'Catastro Móvil 2026')
strings = strings.replace('com.gad.catastromovil.ecc', 'com.gad.catastromovil')
with open(strings_path, 'w', encoding='utf-8') as f:
    f.write(strings)
print('[OK] Updated strings.xml: Catastro Móvil 2026 / com.gad.catastromovil')

# 4. Update build_apk.js
build_js_path = os.path.join(movil_dir, 'build_apk.js')
with open(build_js_path, 'r', encoding='utf-8') as f:
    bjs = f.read()

bjs = bjs.replace("const targetEccApk = path.join(movilRoot, 'CatastroMovil_ECC.apk');\n", "")
bjs = bjs.replace("  fs.copyFileSync(generatedApk, targetEccApk);\n", "")
with open(build_js_path, 'w', encoding='utf-8') as f:
    f.write(bjs)
print('[OK] Cleaned build_apk.js so it only manages CatastroMovil2026.apk')

# 5. Restore official GAD logo
src_logo = os.path.join(frontend_dir, 'public', 'logo_gad.png')
dst_logo1 = os.path.join(movil_dir, 'public', 'logo_gad.png')
dst_logo2 = os.path.join(movil_dir, 'logo_gad.png')
shutil.copyfile(src_logo, dst_logo1)
shutil.copyfile(src_logo, dst_logo2)
print('[OK] Restored official GAD logo into public/logo_gad.png and root logo_gad.png')

# 6. Regenerate Android launcher icons from official GAD logo
movil_res = os.path.join(movil_dir, 'android', 'app', 'src', 'main', 'res')
img = Image.open(src_logo).convert('RGBA')

densities = {
    'mipmap-mdpi': (48, 108),
    'mipmap-hdpi': (72, 162),
    'mipmap-xhdpi': (96, 216),
    'mipmap-xxhdpi': (144, 324),
    'mipmap-xxxhdpi': (192, 432),
}

for folder, (size, fg_size) in densities.items():
    target_dir = os.path.join(movil_res, folder)
    os.makedirs(target_dir, exist_ok=True)
    icon = img.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(os.path.join(target_dir, 'ic_launcher.png'), format='PNG')
    icon.save(os.path.join(target_dir, 'ic_launcher_round.png'), format='PNG')
    
    fg = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 0))
    inner_size = int(fg_size * 0.75)
    inner_icon = img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    offset = (fg_size - inner_size) // 2
    fg.paste(inner_icon, (offset, offset), inner_icon)
    fg.save(os.path.join(target_dir, 'ic_launcher_foreground.png'), format='PNG')

print('[OK] Regenerated Android launcher icons for Catastro Móvil 2026')
