import os
import glob

# Ersetze Marktplatz durch Maios in allen Produktseiten
produkt_files = glob.glob('produkte/produkt-*.html')

for file_path in produkt_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'Marktplatz' in content:
            content = content.replace('Marktplatz', 'Maios')
            
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                f.write(content)
            
            print(f"Updated: {os.path.basename(file_path)}")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

print("\nFertig! Alle Produktseiten wurden aktualisiert.")
