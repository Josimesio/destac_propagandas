from pathlib import Path
from datetime import datetime
import shutil

base = Path(__file__).resolve().parent
site = Path.cwd()
admin = site / 'admin.html'
if not admin.exists():
    raise SystemExit('ERRO: execute este script na raiz do projeto, onde esta admin.html. Nenhum arquivo alterado.')
html = admin.read_text(encoding='utf-8')
if 'href="dashboard_contratos.html"' in html:
    print('O link do Dashboard ja existe em admin.html; nenhuma alteracao feita.')
else:
    marcador = '<a href="contratos.html">Contratos</a>'
    if html.count(marcador) != 1:
        raise SystemExit('ERRO: menu Contratos nao encontrado de forma unica. Nada alterado; nao substituir admin.html.')
    novo = html.replace(marcador, marcador+'\n      <a href="dashboard_contratos.html">Dashboards</a>', 1)
    copia = admin.with_name('admin.html.backup_dashboard_'+datetime.now().strftime('%Y%m%d_%H%M%S'))
    shutil.copy2(admin, copia)
    admin.write_text(novo, encoding='utf-8')
    print(f'Link Dashboard inserido SOMENTE no menu de admin.html. Backup: {copia.name}')
for nome in ('dashboard_contratos.html','dashboard_contratos.css','dashboard_contratos.js'):
    destino = site / nome
    origem = base / nome
    if destino.exists():
        print(f'Preservado arquivo existente: {nome}')
    else:
        shutil.copy2(origem, destino)
        print(f'Criado: {nome}')
print('Concluido. Confira git diff -- admin.html e abra dashboard_contratos.html.')
