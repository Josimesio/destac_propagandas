import argparse, re, csv, zipfile, io, unicodedata, subprocess, tempfile
from pathlib import Path
from collections import defaultdict
from xml.etree import ElementTree as ET

EXTS={'.pdf','.doc','.docx','.txt'}
def norm(s):
    return re.sub(r'[^A-Z0-9]','',unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().upper())
def digits(s): return re.sub(r'\D','',str(s or ''))
def doc_text(name, data):
    ext=Path(name).suffix.lower()
    try:
        if ext=='.docx':
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                root=ET.fromstring(z.read('word/document.xml'))
                return ' '.join((x.text or '') for x in root.iter() if x.tag.endswith('}t'))
        if ext=='.pdf':
            from pypdf import PdfReader
            return '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(data)).pages[:8])
        if ext=='.doc':
            with tempfile.NamedTemporaryFile(suffix='.doc') as f:
                f.write(data);f.flush()
                return subprocess.run(['antiword',f.name],capture_output=True,text=True,timeout=20).stdout
        return data.decode('utf-8',errors='replace')
    except Exception: return ''
def scan(folder):
    p=Path(folder)
    if p.is_file() and p.suffix.lower()=='.zip':
        with zipfile.ZipFile(p) as z:
            for item in z.infolist():
                if not item.is_dir() and Path(item.filename).suffix.lower() in EXTS:
                    yield item.filename,z.read(item)
    else:
        for f in p.rglob('*'):
            if f.is_file() and f.suffix.lower() in EXTS: yield str(f.relative_to(p)),f.read_bytes()
def load_list(path):
    import pandas as pd
    p=Path(path)
    if p.suffix.lower() in ('.xlsx','.xls'):
        df=pd.read_excel(p,dtype=str).fillna('')
    else:
        try: df=pd.read_csv(p,dtype=str,sep=None,engine='python',encoding='utf-8-sig').fillna('')
        except UnicodeDecodeError: df=pd.read_csv(p,dtype=str,sep=None,engine='python',encoding='latin1').fillna('')
    return df

def main():
    ap=argparse.ArgumentParser(description='Cruza lista de expositores da feira com contratos; não cadastra automaticamente')
    ap.add_argument('--contratos',required=True,help='Pasta de contratos ou ZIP')
    ap.add_argument('--feira',required=True,help='Planilha XLSX/XLS/CSV das empresas presentes na feira')
    ap.add_argument('--saida',default='resultado_feira.xlsx')
    args=ap.parse_args()
    import pandas as pd
    feira=load_list(args.feira)
    cols=list(feira.columns)
    def col(keys):
        return next((c for c in cols if any(k in norm(c) for k in keys)),None)
    nomecol=col(['RAZAOSOCIAL','NOMEFANTASIA','EMPRESA','CLIENTE','NOME'])
    doccol=col(['CPFCNPJ','CNPJCPF','CNPJ','CPF'])
    if not nomecol: raise SystemExit('A planilha precisa de coluna Nome/Empresa/Razão Social.')
    registros=[]; seen={}; duplicados=[]
    for idx,r in feira.iterrows():
        nome=str(r[nomecol]).strip(); documento=digits(r[doccol]) if doccol else ''
        if not nome and not documento:continue
        chave=('DOC',documento) if len(documento) in (11,14) else ('NOME',norm(nome))
        item={'nome_razao_social':nome,'cpf_cnpj':documento,'linha_feira':idx+2,'chave':str(chave)}
        if chave in seen: duplicados.append({**item,'primeira_linha':seen[chave]['linha_feira']});continue
        seen[chave]=item;registros.append(item)
    encontrados=[]; nao_lidos=[]
    for i,(arquivo,data) in enumerate(scan(args.contratos),1):
        texto=doc_text(arquivo,data)
        if not texto.strip():nao_lidos.append({'arquivo':arquivo,'motivo':'Sem texto extraível; pode exigir OCR ou conversão'});continue
        nt=norm(texto);nd=norm(Path(arquivo).stem)
        docs=set(re.findall(r'(?<!\d)\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}(?!\d)',texto))
        docs={digits(x) for x in docs}
        for item in registros:
            n=norm(item['nome_razao_social']); d=item['cpf_cnpj']
            tipo=''
            if d and d in docs:tipo='CPF/CNPJ no contrato'
            elif len(n)>=7 and (n in nt or n in nd):tipo='Nome no contrato (conferir)'
            if tipo: encontrados.append({**item,'arquivo_contrato':arquivo,'criterio':tipo})
        if i%100==0:print(f'Analisados {i} arquivos...',flush=True)
    byline=defaultdict(list)
    for e in encontrados:byline[e['linha_feira']].append(e)
    saida=[];pend=[]
    for item in registros:
        ach=byline[item['linha_feira']]
        comprovado=next((a for a in ach if a['criterio']=='CPF/CNPJ no contrato'),None)
        nomeach=ach[0] if ach else None
        registro={k:v for k,v in item.items() if k!='chave'}
        registro.update({'contrato_localizado':(comprovado or nomeach or {}).get('arquivo_contrato',''), 'criterio':(comprovado or nomeach or {}).get('criterio',''), 'status':'CONFIRMADO' if comprovado else 'CONFERIR NOME' if nomeach else 'SEM CONTRATO LOCALIZADO'})
        (saida if comprovado else pend).append(registro)
    with pd.ExcelWriter(args.saida,engine='openpyxl') as writer:
        for aba,rows in [('Clientes_confirmados',saida),('Conferencia',pend),('Duplicados_ignorados',duplicados),('Contratos_sem_texto',nao_lidos),('Todos_cruzamentos',encontrados)]:
            pd.DataFrame(rows).to_excel(writer,sheet_name=aba,index=False)
            ws=writer.sheets[aba];ws.freeze_panes='A2';ws.auto_filter.ref=ws.dimensions
            for col_cells in ws.columns:
                letter=col_cells[0].column_letter
                ws.column_dimensions[letter].width=min(65,max(15,max(len(str(c.value or '')) for c in list(col_cells)[:250])+2))
    print(f'Concluído: {len(saida)} confirmados por documento; {len(pend)} para conferência; {len(duplicados)} duplicados ignorados. Arquivo: {args.saida}')
if __name__=='__main__':main()
