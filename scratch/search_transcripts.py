import glob, json, sys

keywords = ["en su momento", "otra cosa", "desconfiguro", "imprimir todos", "batch", "duplex", "rompe", "20", "menos de 20"]

for p in glob.glob(r'C:\Users\leneker\.gemini\antigravity-ide\brain\*\.system_generated\logs\transcript*.jsonl'):
    try:
        with open(p, 'r', encoding='utf-8') as f:
            cid = p.split('\\')[6]
            for line in f:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    content = str(data.get('content', ''))
                    if any(k in content.lower() for k in ["imprimir", "escala", "rompe", "hoja", "20"]):
                        print(f"[{cid}] USER: {content[:150]}")
    except Exception as e:
        pass
