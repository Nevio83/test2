import os
import re

produkte_dir = r"c:\Users\nevio\Documents\vscode\GitHub\test2\produkte"
count = 0

for filename in os.listdir(produkte_dir):
    if filename.startswith("produkt-") and filename.endswith(".html"):
        filepath = os.path.join(produkte_dir, filename)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'bundle-card.selected::before' in content:
            # Replace top: -10px with top: -5px
            content = content.replace('top: -10px !important;', 'top: -5px !important;')
            # Replace right: -10px with right: -5px  
            content = content.replace('right: -10px !important;', 'right: -5px !important;')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"Updated: {filename}")
            count += 1

print(f"\nFertig! {count} Dateien aktualisiert.")
