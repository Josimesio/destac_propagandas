#!/usr/bin/env python3
"""Execute dentro do diretório raiz do site: python aplicar_lembrar_login.py"""
from pathlib import Path
import re
import shutil
import sys

base = Path.cwd()
if not (base / 'index.html').is_file() or not (base / 'app.js').is_file():
    sys.exit('ERRO: execute este instalador na raiz do site (index.html + app.js).')
source = Path(__file__).resolve().parent / 'destac-session.js'
if not source.exists():
    sys.exit('ERRO: coloque destac-session.js ao lado deste script.')
shutil.copy2(source, base / 'destac-session.js') if source.resolve() != (base/'destac-session.js').resolve() else None

def save(path, original, updated):
    if original == updated:
        return
    backup = path.with_name(path.name + '.antes_lembrar_login.bak')
    if not backup.exists():
        backup.write_text(original, encoding='utf-8')
    path.write_text(updated, encoding='utf-8')
    print('ALTERADO:', path.relative_to(base))

for file in base.rglob('*.html'):
    if '.git' in file.parts:
        continue
    old = file.read_text(encoding='utf-8')
    new = old
    if re.search(r'<script\b', new, re.I) and 'destac-session.js' not in new:
        rel = '../' * (len(file.relative_to(base).parts)-1) + 'destac-session.js'
        new = re.sub(r'(?i)(<script\b)', lambda m: '<script src="'+rel+'"></script>\n'+m.group(1), new, count=1)
    if file.name == 'index.html' and 'id="lembrarLogin"' not in new:
        match = re.search(r'<input\b[^>]*\bid=["\']password["\'][^>]*>', new, re.I)
        if not match:
            sys.exit('ERRO: campo password não localizado no index.html')
        fragment = '''
      <label for="lembrarLogin" style="display:flex;align-items:center;gap:9px;font-weight:500;cursor:pointer">
        <input type="checkbox" id="lembrarLogin" checked style="width:17px;height:17px;accent-color:#655474;flex:none">
        Lembrar meu acesso neste dispositivo
      </label>
      <small style="font-size:11px;color:#736a79">Não salvamos a senha neste dispositivo.</small>'''
        new = new[:match.end()] + fragment + new[match.end():]
    save(file, old, new)

for file in base.rglob('*.js'):
    if '.git' in file.parts or file.name == 'destac-session.js':
        continue
    old = file.read_text(encoding='utf-8')
    new = old.replace('window.supabase?.createClient?.(', 'window.destacCreateClient(')
    new = new.replace('window.supabase.createClient(', 'window.destacCreateClient(')
    if file.name == 'app.js' and 'lembrarLogin' not in new:
        anchor = "  const password = document.getElementById('password').value;"
        if anchor not in new:
            sys.exit('ERRO: app.js mudou desde a versão analisada.')
        new = new.replace(anchor, anchor + '''
  const lembrar = document.getElementById('lembrarLogin')?.checked ?? true;
  window.destacSetRemember(lembrar);
  const authClient = window.destacCreateClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);''',1)
        new = new.replace('await supabaseClient.auth.signInWithPassword({ email, password })',
                          'await authClient.auth.signInWithPassword({ email, password })',1)
        new = new.replace("  loginMessage.style.color = '#4f7a57';", "  window.destacCleanOtherStorage();\n  loginMessage.style.color = '#4f7a57';",1)
        marker = "const loginForm = document.getElementById('loginForm');"
        new = new.replace(marker,marker+'''
const lembrarLogin = document.getElementById('lembrarLogin');
if (lembrarLogin) lembrarLogin.checked = localStorage.getItem('destac_lembrar_login') !== 'false';''',1)
    save(file, old, new)
print('Concluído. Confira git diff e teste antes de publicar.')
