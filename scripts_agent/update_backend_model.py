import os

file_path = r'c:\LNCZ\proyecto-catastro-2026\backend\app\models\user.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    @property
    def nombres_completos(self):
        n = self.nombres or ""
        a = self.apellidos or ""
        if n and a:
            return f"{n} {a}"
        return n or a or ""'''

replacement = '''    @property
    def nombres_completos(self):
        n = self.nombres or ""
        a = self.apellidos or ""
        if n and a:
            return f"{n} {a}"
        return n or a or ""

    @property
    def proyectos_ids(self):
        return [p.id for p in self.proyectos]'''

if target in content:
    new_content = content.replace(target, replacement, 1)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated user.py")
else:
    print("Target not found or already updated")
