const sb=window.supabase.createClient('https://kvmayirfbdnexlzqnjvr.supabase.co','sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP');
const $=id=>document.getElementById(id);let linhas=[];let nomes={};
const brl=x=>x===null||x===undefined||x===''?'-':Number(x).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const data=x=>x?String(x).slice(0,10).split('-').reverse().join('/'):'-';
const texto=x=>x===null||x===undefined||x===''?'-':String(x);
function estado(t){$('estado').textContent=t}
function add(td,t){const e=document.createElement('td');e.textContent=t;td.append(e)}
function objeto(r){return r.detalhes&&typeof r.detalhes==='object'?r.detalhes:{}}
function resumo(r){const d=objeto(r);return r.evento==='DELETE'?(d.antes||{}):(d.depois||d.antes||{});}
function identificador(r,c){return c.numero_contrato||c.codigo||c.nome||r.registro_id||'-'}
function vigencia(c){return [data(c.data_inicio),c.prazo_indeterminado==='true'?'Indeterminado':data(c.data_termino)].join(' até ')+(c.meses?' ('+c.meses+' meses)':'')}
function insercoes(c){const linhas=[];if(c.insercoes_terca_quinta!=null)linhas.push('Ter/Qui: '+c.insercoes_terca_quinta);if(c.insercoes_sabado_domingo!=null)linhas.push('Sáb/Dom: '+c.insercoes_sabado_domingo);if(c.insercoes_mensais!=null)linhas.push('Mês: '+c.insercoes_mensais);return linhas.join(' | ')||'-'}
function valores(c){return [['Mensal',c.valor_mensal],['Total',c.valor_total_contrato],['À vista',c.valor_vista],['Financeiro',c.valor_financeiro],['Permuta',c.valor_permuta],['Entrada',c.valor_entrada]].filter(([k,v])=>v!=null).map(([k,v])=>k+': '+brl(v)).join(' | ')||'-'}
function desconto(c){const d=[];if(Number(c.percentual_desconto_vista)>0)d.push('À vista: '+c.percentual_desconto_vista+'%');if(Number(c.percentual_desconto_parcelado)>0)d.push('Parcelado: '+c.percentual_desconto_parcelado+'%');return d.join(' | ')||'Sem desconto registrado'}
function detalhes(r){const d=objeto(r);if(r.evento==='UPDATE'&&d.campos_alterados){return Object.entries(d.campos_alterados).map(([k,v])=>k+': '+texto(v.de)+' → '+texto(v.para)).join(' ; ')||'Sem diferença comercial';}return r.evento==='INSERT'?'Registro criado':r.evento==='DELETE'?'Registro excluído':d.acao||r.origem||'-'}
const eventos={INSERT:'Criou',UPDATE:'Alterou',DELETE:'Excluiu',LOGIN:'Entrou',LOGOUT:'Saiu',ACESSO_NEGADO:'Acesso negado'};
async function carregar(){try{
 const {data:{user},error:ae}=await sb.auth.getUser();if(ae||!user){location.replace('index.html');return}
 const {data:p,error:pe}=await sb.from('perfis_usuario').select('perfil,ativo').eq('user_id',user.id).maybeSingle();
 if(pe||!p||p.ativo!==true||p.perfil!=='SUPER_USUARIO'){$('linhas').replaceChildren();document.querySelector('.filters').remove();estado('Acesso restrito ao SUPER_USUARIO.');return}
 let q=sb.from('destac_logs').select('criado_em,usuario_id,evento,modulo,tabela,registro_id,origem,detalhes').order('criado_em',{ascending:false}).limit(500);
 if($('modulo').value)q=q.eq('modulo',$('modulo').value);if($('evento').value)q=q.eq('evento',$('evento').value);
 if($('inicio').value)q=q.gte('criado_em',new Date($('inicio').value+'T00:00:00').toISOString());
 if($('fim').value){let d=new Date($('fim').value+'T00:00:00');d.setDate(d.getDate()+1);q=q.lt('criado_em',d.toISOString())}
 const {data,error}=await q;if(error)throw error;linhas=data||[];
 const ids=[...new Set(linhas.map(x=>x.usuario_id).filter(Boolean))];nomes={};
 if(ids.length){const resultado=await sb.from('perfis_usuario').select('user_id,nome,email').in('user_id',ids);if(!resultado.error){for(const x of resultado.data||[])nomes[x.user_id]=x.nome||x.email||x.user_id}}
 const corpo=$('linhas');corpo.replaceChildren();for(const r of linhas){const c=resumo(r),tr=document.createElement('tr');
 const campos=[new Date(r.criado_em).toLocaleString('pt-BR'),nomes[r.usuario_id]||r.usuario_id||'Sistema / não identificado',eventos[r.evento]||r.evento,r.modulo,identificador(r,c),r.modulo==='contratos'?vigencia(c):'-',r.modulo==='contratos'?insercoes(c):'-',r.modulo==='contratos'?valores(c):'-',r.modulo==='contratos'?[texto(c.modalidade_contrato),texto(c.condicao_pagamento),c.quantidade_parcelas?'Parcelas: '+c.quantidade_parcelas:''].filter(Boolean).join(' / '):'-',r.modulo==='contratos'?desconto(c):'-',detalhes(r)];
 for(const valor of campos)add(tr,valor);corpo.append(tr)}estado(`${linhas.length} eventos encontrados`)
 }catch(e){console.error(e);estado('Erro ao consultar logs. Confira as migrações SQL e o acesso de SUPER_USUARIO.')}}
$('buscar').addEventListener('click',carregar);
$('exportar').addEventListener('click',()=>{if(!linhas.length)return;const cols=['data_hora','usuario','acao','modulo','identificador','vigencia','insercoes','valores','pagamento','desconto','alteracoes'];const csv=[cols.join(';'),...linhas.map(r=>{const c=resumo(r);return [new Date(r.criado_em).toLocaleString('pt-BR'),nomes[r.usuario_id]||r.usuario_id||'Sistema',eventos[r.evento]||r.evento,r.modulo,identificador(r,c),vigencia(c),insercoes(c),valores(c),texto(c.modalidade_contrato)+' / '+texto(c.condicao_pagamento),desconto(c),detalhes(r)].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')})].join('\r\n');const a=document.createElement('a'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});a.href=URL.createObjectURL(blob);a.download='destac_analytics_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(a.href)});
carregar();
