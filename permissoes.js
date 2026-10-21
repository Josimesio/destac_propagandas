"use strict";
const db=window.supabase.createClient('https://kvmayirfbdnexlzqnjvr.supabase.co','sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP');
const MODULOS=[['admin', 'Painel inicial'], ['empresas', 'Empresas'], ['clientes', 'Clientes'], ['contratos', 'Contratos'], ['financeiro', 'Financeiro'], ['conciliacao_contratos', 'Conciliação'], ['consultar_cnpj', 'Consultar CNPJ'], ['buscar_cep', 'Buscar CEP'], ['usuarios', 'Usuários']];
const ACOES=['visualizar','criar','editar','excluir','exportar'];
const $=id=>document.getElementById(id);
let perfil=null,permitidas=new Set(),originais=new Map(),alvo='';
function msg(t,erro=false){$('status').textContent=t;$('status').style.color=erro?'#a23747':'#69567e'}
function chave(m,a){return m+':'+a}
async function rpc(nome,params={}){const {data,error}=await db.rpc(nome,params);if(error)throw error;return data}
async function iniciar(){try{
 const {data:{user},error}=await db.auth.getUser();if(error||!user){location.replace('index.html');return}
 const r=await db.from('perfis_usuario').select('perfil,ativo').eq('user_id',user.id).single();
 if(r.error||!r.data?.ativo||!['SUPER_USUARIO','ADMINISTRADOR'].includes(r.data.perfil)){msg('Sem permissão para administrar acessos.',true);return}
 perfil=r.data.perfil;
 if(perfil==='ADMINISTRADOR' && !(await rpc('destac_tem_permissao',{p_modulo:'usuarios',p_acao:'visualizar'}))){msg('Seu perfil não recebeu acesso à gestão de usuários.',true);return}
 if(perfil==='ADMINISTRADOR'){
   const p=await db.from('destac_permissoes').select('modulo,acao').eq('user_id',user.id).eq('permitido',true);
   if(p.error)throw p.error;permitidas=new Set((p.data||[]).map(x=>chave(x.modulo,x.acao)));
 }
 const users=await rpc('destac_usuarios_gerenciaveis');const lista=users.filter(x=>x.user_id!==user.id&&x.perfil!=='SUPER_USUARIO');
 $('alvo').replaceChildren(new Option('Selecione um usuário',''),...lista.map(u=>new Option(`${u.nome} — ${u.perfil}`,u.user_id)));
 msg(lista.length?'Selecione um usuário para configurar.':'Nenhum usuário disponível.');
 }catch(e){console.error(e);msg('Falha ao carregar permissões: '+e.message,true)}}
function pode(m,a){return perfil==='SUPER_USUARIO'||permitidas.has(chave(m,a))}
function construir(){const tbody=$('permissoesTabela');tbody.replaceChildren();for(const [m,nome] of MODULOS){const tr=document.createElement('tr'),td=document.createElement('td');td.textContent=nome;tr.append(td);for(const a of ACOES){const cell=document.createElement('td'),inp=document.createElement('input');inp.type='checkbox';inp.dataset.modulo=m;inp.dataset.acao=a;inp.checked=originais.get(chave(m,a))===true;inp.disabled=!pode(m,a)|| (perfil==='ADMINISTRADOR'&&!permitidas.has('usuarios:editar'));inp.setAttribute('aria-label',`${a} - ${nome}`);inp.addEventListener('change',()=>{if(a==='visualizar'&&!inp.checked){tr.querySelectorAll('input').forEach(x=>{if(x!==inp&&!x.disabled)x.checked=false})}else if(a!=='visualizar'&&inp.checked){let v=tr.querySelector('input[data-acao=visualizar]');if(v&&!v.disabled)v.checked=true}});cell.append(inp);tr.append(cell)}tbody.append(tr)}}
async function selecionar(){alvo=$('alvo').value;$('matriz').hidden=!alvo;if(!alvo)return;msg('Carregando matriz...');try{const lista=await rpc('destac_consultar_permissoes',{p_user_id:alvo});originais=new Map(lista.map(x=>[chave(x.modulo,x.acao),x.permitido]));construir();msg('Marque as permissões e clique em Salvar.')}catch(e){msg(e.message,true);$('matriz').hidden=true}}
async function salvar(){if(!alvo)return;const changes=[...document.querySelectorAll('#permissoesTabela input:not(:disabled)')].filter(x=>x.checked!==(originais.get(chave(x.dataset.modulo,x.dataset.acao))===true));$('salvar').disabled=true;msg(`Salvando ${changes.length} alteração(ões)...`);try{for(const x of changes){await rpc('destac_definir_permissao',{p_user_id:alvo,p_modulo:x.dataset.modulo,p_acao:x.dataset.acao,p_permitido:x.checked})}await selecionar();msg(`${changes.length} alteração(ões) salva(s).`)}catch(e){msg('Erro ao salvar: '+e.message,true)}finally{$('salvar').disabled=false}}
$('alvo').addEventListener('change',selecionar);$('salvar').addEventListener('click',salvar);$('recarregar').addEventListener('click',selecionar);$('marcarVisao').addEventListener('click',()=>{document.querySelectorAll('#permissoesTabela input[data-acao=visualizar]:not(:disabled)').forEach(i=>i.checked=true)});iniciar();
