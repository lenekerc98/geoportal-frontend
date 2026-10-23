import os
import shutil
from PIL import Image

movil_dir = r"C:\LNCZ\proyecto-catastro-2026\movil"
frontend_dir = r"C:\LNCZ\proyecto-catastro-2026\frontend"
source_logo = os.path.join(movil_dir, "logo_gad.png")

if not os.path.exists(source_logo):
    print("Error: Source logo not found at:", source_logo)
    exit(1)

print("Source logo found. Size:", Image.open(source_logo).size)

# 1. Replace web public and dist copies
targets = [
    os.path.join(frontend_dir, "public", "logo_gad.png"),
    os.path.join(frontend_dir, "dist", "logo_gad.png"),
    os.path.join(movil_dir, "public", "logo_gad.png"),
    os.path.join(movil_dir, "dist", "logo_gad.png"),
    os.path.join(movil_dir, "android", "app", "src", "main", "assets", "public", "logo_gad.png"),
]

for t in targets:
    os.makedirs(os.path.dirname(t), exist_ok=True)
    shutil.copyfile(source_logo, t)
    print("Updated:", t)

# 2. Generate Android Launcher App Icons (Mipmaps)
img = Image.open(source_logo).convert("RGBA")

android_res = os.path.join(movil_dir, "android", "app", "src", "main", "res")

mipmap_configs = [
    ("mipmap-mdpi", 48, 108),
    ("mipmap-hdpi", 72, 162),
    ("mipmap-xhdpi", 96, 216),
    ("mipmap-xxhdpi", 144, 324),
    ("mipmap-xxxhdpi", 192, 432),
]

for folder, icon_size, fg_size in mipmap_configs:
    folder_path = os.path.join(android_res, folder)
    os.makedirs(folder_path, exist_ok=True)

    # Standard square launcher icon
    icon_resized = img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    icon_resized.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")

    # Round launcher icon
    icon_resized.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")

    # Foreground adaptive icon (centered inside fg_size canvas)
    fg_canvas = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    # Keep logo inside safe zone (approx 70% of fg_size)
    logo_sub_size = int(fg_size * 0.72)
    logo_sub = img.resize((logo_sub_size, logo_sub_size), Image.Resampling.LANCZOS)
    offset = (fg_size - logo_sub_size) // 2
    fg_canvas.paste(logo_sub, (offset, offset), logo_sub)
    fg_canvas.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")

    print(f"Generated Android icons for {folder} ({icon_size}x{icon_size}, fg: {fg_size}x{fg_size})")

print("All logos and Android launcher icons successfully updated!")
