'use strict';
// Tela de conciliação - nenhum lançamento é gerado no cliente.
// Somente as funções RPC autenticadas decidem e gravam operações no Supabase.
const CC_URL = 'https://kvmayirfbdnexlzqnjvr.supabase.co';
const CC_KEY = 'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';
const ccClient = window.supabase.createClient(CC_URL, CC_KEY);
const cc$ = (id) => document.getElementById(id);
const ccEstado = { contratos: [], selecionados: new Set(), pagina: 1, atual: null, processando: false };
const ccHtml = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
const ccMoeda = (x) => (Number(x)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function ccData(x) { if (!x) return '—'; const [a,m,d]=String(x).slice(0,10).split('-'); return `${d}/${m}/${a}`; }
function ccAvisar(mensagem, tipo='') {const el=cc$('ccMensagem'); el.hidden=false; el.textContent=mensagem; el.className='cc-alerta '+tipo;}
function ccErro(e) { return e?.message || 'Erro inesperado. Confira sua conexão.'; }
function ccIncompleto(c) {
  const motivos=[];
  if (String(c.situacao_contrato || '').toUpperCase() !== 'ATIVO') motivos.push('Contrato não está ATIVO');
  if (!c.valor_total_informado || !(Number(c.valor_total)>0)) motivos.push('Valor total não preenchido explicitamente no contrato');
  if (!(Number(c.quantidade_parcelas)>=1 && Number(c.quantidade_parcelas)<=120)) motivos.push('Quantidade de parcelas inválida');
  if (!c.primeiro_vencimento) motivos.push('Primeiro vencimento não preenchido');
  if (!String(c.forma_pagamento||'').trim()) motivos.push('Forma de pagamento não preenchida');
  if (c.data_termino < c.data_inicio) motivos.push('Datas do contrato inconsistentes');
  if (Number(c.valor_entrada)<0 || Number(c.valor_entrada)>Number(c.valor_total)) motivos.push('Valor de entrada inconsistente');
  if (Number(c.qtd_cobrancas)>0) motivos.push('Já existem cobranças vinculadas');
  if (c.estado_conciliacao==='IGNORADO') motivos.push('Conciliação marcada como ignorada');
  return motivos;
}
function ccApto(c){return (c.estado_conciliacao==='PENDENTE' || c.estado_conciliacao==='REVISAR') && ccIncompleto(c).length===0;}
function ccCategoria(c) {
  if(c.estado_conciliacao==='INTEGRADO') return 'integrado';
  if(c.estado_conciliacao==='IGNORADO') return 'ignorado';
  if(Number(c.qtd_cobrancas)>0) return 'existente';
  if(ccApto(c)) return 'elegivel';
  if(ccIncompleto(c).length && String(c.situacao_contrato).toUpperCase()!=='ATIVO') return 'pendente';
  if(ccIncompleto(c).length) return 'revisar';
  return 'pendente';
}
function ccRotulo(c){
 const cat=ccCategoria(c);
 const map={ integrado:['Conciliado','ok'], ignorado:['Não integrar','cinza'], existente:['Já tem cobranças','alerta'], elegivel:['Apto a conferir',''], revisar:['Corrigir / conferir','alerta'], pendente:['Aguardando','cinza'] };
 const [nome,tipo]=map[cat]; return `<span class="cc-pill ${tipo}">${nome}</span>`;
}
function ccFiltrados(){
 const busca=cc$('ccBusca').value.trim().toLocaleLowerCase('pt-BR');
 const filtro=cc$('ccFiltro').value, emp=cc$('ccEmpresa').value;
 return ccEstado.contratos.filter(c => (!emp || String(c.empresa_id)===emp) &&
 (filtro==='todos' || (filtro==='pendente' ? ['pendente','elegivel','revisar'].includes(ccCategoria(c)) : ccCategoria(c)===filtro)) &&
 (!busca || [c.numero_contrato,c.empresa_nome,c.cliente_nome].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(busca))));
}
function ccPaginados(){const all=ccFiltrados(); const n=Number(cc$('ccPorPagina').value)||20;
 const totalPaginas=Math.max(1,Math.ceil(all.length/n));ccEstado.pagina=Math.min(ccEstado.pagina,totalPaginas);
 return { all, parte:all.slice((ccEstado.pagina-1)*n, ccEstado.pagina*n), totalPaginas }; }
function ccResumo(){
 const a=ccEstado.contratos;
 cc$('ccTotal').textContent=a.length;
 cc$('ccPendentes').textContent=a.filter(c=>!['INTEGRADO','IGNORADO'].includes(c.estado_conciliacao)).length;
 cc$('ccComCobranca').textContent=a.filter(c=>Number(c.qtd_cobrancas)>0).length;
 cc$('ccIntegrados').textContent=a.filter(c=>c.estado_conciliacao==='INTEGRADO').length;
}
function ccRender(){
 ccResumo();const {all,parte,totalPaginas}=ccPaginados();
 cc$('ccLinhas').innerHTML=parte.length?parte.map(c=>{
  const apto=ccApto(c),cat=ccCategoria(c);
  const idx=ccEstado.selecionados.has(String(c.contrato_id));
  const acao=cat==='integrado'?'Conferido':cat==='ignorado'?'Reabrir / Ver':cat==='existente'?'Conferir existente':apto?'Conferir parcelas':'Ver pendências';
  return `<tr><td><input aria-label="Selecionar contrato ${ccHtml(c.numero_contrato)}" type="checkbox" data-select="${c.contrato_id}" ${apto?'':'disabled'} ${idx?'checked':''}></td>
   <td><strong>${ccHtml(c.numero_contrato||'#'+c.contrato_id)}</strong><small>${ccHtml(c.empresa_nome)}</small><small>${ccHtml(c.cliente_nome)}</small></td>
   <td><span class="cc-pill ${String(c.situacao_contrato).toUpperCase()==='ATIVO'?'ok':'cinza'}">${ccHtml(c.situacao_contrato)}</span></td>
   <td>${ccMoeda(c.valor_total)}<small>Entrada ${ccMoeda(c.valor_entrada)} • ${Number(c.quantidade_parcelas)||'—'} parcela(s)</small><small>1º venc. ${ccData(c.primeiro_vencimento)}</small></td>
   <td>${c.qtd_cobrancas} cobrança(s)<small>Recebido: ${ccMoeda(c.total_recebido)}</small>${Number(c.qtd_lancamentos_manuais)>0?`<small>⚠ ${c.qtd_lancamentos_manuais} lançamento(s) manual(is) possível(is)</small>`:''}</td>
   <td>${ccRotulo(c)}</td>
   <td><button type="button" data-detalhe="${c.contrato_id}">${acao}</button></td></tr>`;
 }).join(''):'<tr><td colspan="7">Nenhum contrato encontrado para os filtros.</td></tr>';
 cc$('ccContagem').textContent=`${all.length} contrato(s) encontrados`;
 cc$('ccPagina').textContent=`${ccEstado.pagina} / ${totalPaginas}`;
 cc$('ccAnterior').disabled=ccEstado.pagina===1;
 cc$('ccProximo').disabled=ccEstado.pagina===totalPaginas;
 const allAptos=parte.filter(ccApto);
 cc$('ccSelecionarPagina').checked=allAptos.length>0 && allAptos.every(c=>ccEstado.selecionados.has(String(c.contrato_id)));
 cc$('ccSelecionarPagina').disabled=allAptos.length===0;
 cc$('ccSelecionados').textContent=`${ccEstado.selecionados.size} selecionado(s)`;
 cc$('ccIntegrarLote').disabled=ccEstado.selecionados.size===0||!cc$('ccConferiLote').checked||ccEstado.processando;
}
function ccMes(data,delta,dia){let [y,m]=String(data).split('-').map(Number);m+=delta-1;y+=Math.floor(m/12);m=((m%12)+12)%12;const ultimo=new Date(Date.UTC(y,m+1,0)).getUTCDate();return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(ultimo,dia)).padStart(2,'0')}`;}
function ccPrevia(c){
 const total=Math.round(Number(c.valor_total)*100),entrada=Math.round(Number(c.valor_entrada)*100),saldo=total-entrada;
 const n=saldo===0 && entrada>0?0:Number(c.quantidade_parcelas);
 if(!(Number.isFinite(total)&&total>=0&&entrada>=0&&entrada<=total&&n>=0))return '';
 const datas=[];if(entrada>0)datas.push({tipo:'Entrada',valor:entrada,venc:c.data_vencimento_entrada || c.data_inicio});
 const dia=Number(String(c.primeiro_vencimento).slice(8,10));
 const venc=String(c.primeiro_vencimento);
 for(let i=0;i<n;i++)datas.push({tipo:`Parcela ${i+1}/${n}`,valor:Math.floor(saldo/n)+(i<saldo%n?1:0),venc:i===0?venc:ccMes(venc,i,dia)});
 return `<h3>Prévia das cobranças (não gravadas)</h3><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>${datas.map(d=>`<tr><td>${d.tipo}</td><td>${ccData(d.venc)}</td><td>${ccMoeda(d.valor/100)}</td></tr>`).join('')}</tbody></table>`;
}
async function ccVerManuais(c){
 const el=cc$('ccAvisoManual');el.hidden=true;el.textContent='';
 if(Number(c.qtd_lancamentos_manuais)===0)return;
 el.hidden=false;el.textContent=`Atenção: ${c.qtd_lancamentos_manuais} lançamento(s) manual(is) potencialmente relacionado(s) a este cliente e empresa. Confira antes de autorizar. Podem ser referentes a outros contratos.`;
 try{
 const inicio=new Date(c.data_inicio+'T12:00:00');inicio.setMonth(inicio.getMonth()-1);
 const fim=new Date(c.data_termino+'T12:00:00');fim.setMonth(fim.getMonth()+2);
 const iso=(v)=>`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
 const {data,error}=await ccClient.from('financeiro_contas_receber')
 .select('numero_documento,descricao,vencimento,valor_original,valor_recebido,status')
 .eq('empresa_id',c.empresa_id).eq('cliente_id',c.cliente_id).eq('origem','MANUAL')
 .gte('vencimento',iso(inicio)).lte('vencimento',iso(fim)).limit(100);
 if(error)throw error;
 const nomes=(data||[]).map(x=>`${ccData(x.vencimento)} — ${x.numero_documento||x.descricao||'Manual'} — ${ccMoeda(x.valor_original)} (recebido: ${ccMoeda(x.valor_recebido)})`);
 el.textContent+='\n'+nomes.join('\n')+(Number(c.qtd_lancamentos_manuais)>100?'\nLista limitada a 100 lançamentos.':'');
 } catch(e){el.textContent+='\nNão foi possível detalhar os lançamentos manuais: '+ccErro(e);}
}
function ccDetalhes(c){
 ccEstado.atual=c;cc$('ccDetalhe').hidden=false;cc$('ccDetalheTitulo').textContent=`Contrato ${c.numero_contrato||c.contrato_id}`;
 const motivos=ccIncompleto(c);
 cc$('ccDetalheInfo').innerHTML=`<div class="cc-detalhe-info">
  <div><small>Empresa</small><strong>${ccHtml(c.empresa_nome)}</strong></div>
  <div><small>Cliente</small><strong>${ccHtml(c.cliente_nome)}</strong></div>
  <div><small>Status</small><strong>${ccHtml(c.situacao_contrato)}</strong></div>
  <div><small>Vigência</small><strong>${ccData(c.data_inicio)} até ${ccData(c.data_termino)}</strong></div>
  <div><small>Valor total / Entrada</small><strong>${ccMoeda(c.valor_total)} / ${ccMoeda(c.valor_entrada)}</strong></div>
  <div><small>Parcelas / Primeiro vencimento</small><strong>${c.quantidade_parcelas||'—'} / ${ccData(c.primeiro_vencimento)}</strong></div>
 </div>`;
 cc$('ccConferido').checked=false;
 const existente=Number(c.qtd_cobrancas)>0,ignorado=c.estado_conciliacao==='IGNORADO';
 const pode=ccApto(c)|| (existente && c.estado_conciliacao!=='INTEGRADO');
 cc$('ccConferido').disabled=!pode;
 cc$('ccConfirmar').disabled=true;
 cc$('ccConfirmar').textContent=existente?'Confirmar cobranças já existentes (sem gerar)':'Autorizar geração de parcelas';
 cc$('ccConfirmar').hidden=!pode;
 cc$('ccIgnorar').hidden=!(c.estado_conciliacao==='PENDENTE'||c.estado_conciliacao==='REVISAR'||ignorado);
 cc$('ccIgnorar').textContent=ignorado?'Reabrir para conciliação':'Não integrar este contrato';
 cc$('ccEditar').href=`contrato_novo.html?id=${encodeURIComponent(c.contrato_id)}`;
 if(motivos.length && !existente) cc$('ccParcelas').innerHTML=`<div class="cc-atencao"><strong>Antes da integração:</strong><ul>${motivos.map(x=>`<li>${ccHtml(x)}</li>`).join('')}</ul></div>`;
 else if(existente) cc$('ccParcelas').innerHTML=`<p>Já existem ${c.qtd_cobrancas} cobrança(s) vinculada(s), somando ${ccMoeda(c.total_cobrancas)}; recebido ${ccMoeda(c.total_recebido)}. Confirmar não gera nem altera parcelas.</p>`;
 else cc$('ccParcelas').innerHTML=ccPrevia(c);
 // Recupera a data real da entrada para a prévia, sem ampliar o retorno da RPC.
 ccClient.from('contratos').select('data_vencimento_entrada,condicao_pagamento').eq('id',c.contrato_id).single()
   .then(({data,error})=>{ if(error||!data||ccEstado.atual!==c)return;
     c.data_vencimento_entrada=data.data_vencimento_entrada;
     c.condicao_pagamento=data.condicao_pagamento || 'PARCELADO';
     if(!motivos.length && !existente) cc$('ccParcelas').innerHTML=ccPrevia(c);
   });
 ccVerManuais(c);
 cc$('ccDetalhe').scrollIntoView({behavior:'smooth',block:'start'});
}
async function ccCarregar(){
 ccAvisar('Consultando contratos antigos…');cc$('ccAtualizar').disabled=true;
 try{
  const resultado=[];
  for(let pagina=0;pagina<50;pagina++){
   const {data,error}=await ccClient.rpc('destac_listar_conciliacao_legado').range(pagina*1000,pagina*1000+999);
   if(error)throw error;
   resultado.push(...(data||[]));
   if(!data||data.length<1000)break;
   if(pagina===49)throw new Error('Limite de 50.000 registros atingido. Consulte o suporte.');
  }
  ccEstado.contratos=resultado;ccEstado.selecionados.clear();ccEstado.atual=null;cc$('ccDetalhe').hidden=true;
  const empresas=new Map(resultado.map(c=>[String(c.empresa_id),c.empresa_nome]));
  const seletor=cc$('ccEmpresa');const valorAnterior=seletor.value;
  seletor.innerHTML='<option value="">Todas as empresas</option>'+[...empresas.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([id,nome])=>`<option value="${ccHtml(id)}">${ccHtml(nome)}</option>`).join('');
  seletor.value=empresas.has(valorAnterior)?valorAnterior:'';
  cc$('ccConferiLote').checked=false;ccEstado.pagina=1;ccRender();
  ccAvisar(`${resultado.length} contrato(s) do lote antigo carregado(s). Nenhuma cobrança foi gerada.`,'sucesso');
 }catch(e){cc$('ccLinhas').innerHTML='<tr><td colspan="7">Não foi possível carregar os contratos antigos.</td></tr>';
   ccAvisar('Erro na consulta: '+ccErro(e)+'\nConfira se executou sql/INSTALAR_CONCILIACAO_CONTRATOS_ANTIGOS.sql no Supabase correto e se seu usuário é administrador.','erro');
 }finally{cc$('ccAtualizar').disabled=false;}
}
async function ccAprovar(c,conferido){
 const nomeFunc=Number(c.qtd_cobrancas)>0?'destac_conferir_conciliacao_existente':'destac_aprovar_conciliacao_legado';
 const {data,error}=await ccClient.rpc(nomeFunc,{p_contrato_id:c.contrato_id,p_conferiu_pagamentos:conferido});
 if(error)throw error;
 return data;
}
async function ccConfirmarUm(){
 const c=ccEstado.atual;if(!c||ccEstado.processando||!cc$('ccConferido').checked)return;
 const existente=Number(c.qtd_cobrancas)>0;
 if(!window.confirm(existente?`Confirmar as cobranças já vinculadas ao contrato ${c.numero_contrato}, SEM GERAR novas parcelas?`:`AUTORIZAR a geração das parcelas do contrato ${c.numero_contrato}? Vencimentos anteriores a hoje poderão aparecer vencidos.`))return;
 ccEstado.processando=true;cc$('ccConfirmar').disabled=true;
 try{const resposta=await ccAprovar(c,true);ccAvisar(`${c.numero_contrato}: ${resposta}.`,'sucesso');await ccCarregar();}
 catch(e){ccAvisar(ccErro(e),'erro');}
 finally{ccEstado.processando=false;cc$('ccConfirmar').disabled=!cc$('ccConferido').checked;}
}
async function ccIgnorar(){
 const c=ccEstado.atual;if(!c||ccEstado.processando)return;
 const reabrir=c.estado_conciliacao==='IGNORADO';
 const motivo=reabrir?'':window.prompt(`Motivo para não gerar financeiro para o contrato ${c.numero_contrato}:`);
 if(!reabrir && !String(motivo||'').trim())return;
 if(!window.confirm(reabrir?'Reabrir este contrato para conciliação?':'Confirmar que NÃO serão geradas parcelas automaticamente para este contrato antigo?'))return;
 ccEstado.processando=true;
 try{const {data,error}=await ccClient.rpc(reabrir?'destac_reabrir_conciliacao_legado':'destac_ignorar_conciliacao_legado',
 reabrir?{p_contrato_id:c.contrato_id}:{p_contrato_id:c.contrato_id,p_motivo:motivo});
 if(error)throw error;ccAvisar(data,'sucesso');await ccCarregar();}
 catch(e){ccAvisar(ccErro(e),'erro');}finally{ccEstado.processando=false;}
}
async function ccLote(){
 if(ccEstado.processando||!cc$('ccConferiLote').checked)return;
 const selecionados=ccEstado.contratos.filter(c=>ccEstado.selecionados.has(String(c.contrato_id))&&ccApto(c));
 if(!selecionados.length)return;
 const qtdManuais=selecionados.filter(c=>Number(c.qtd_lancamentos_manuais)>0).length;
 const mensagem=`Você CONFIRMA que revisou os pagamentos anteriores de ${selecionados.length} contrato(s), inclusive os ${qtdManuais} com possíveis lançamentos manuais, e deseja criar as parcelas agora? Esta operação pode gerar vencimentos retroativos.`;
 if(!window.confirm(mensagem))return;
 ccEstado.processando=true;ccRender();let ok=0;const erros=[];
 for(const c of selecionados){
  try{await ccAprovar(c,true);ok++;}catch(e){erros.push(`${c.numero_contrato}: ${ccErro(e)}`);}
 }
 ccEstado.processando=false;
 try{await ccCarregar();}catch(_e){}
 ccAvisar(`${ok} contrato(s) integrado(s). ${erros.length} falha(s).${erros.length?'\n'+erros.slice(0,20).join('\n'):''}`,erros.length?'erro':'sucesso');
}
async function ccIniciar(){
 if(!window.supabase){ccAvisar('A biblioteca Supabase não foi carregada.','erro');return;}
 const {data:{session},error}=await ccClient.auth.getSession();
 if(error||!session){location.href='index.html';return;}
 const r=await ccClient.from('perfis_usuario').select('nome,perfil,ativo').eq('user_id',session.user.id).single();
 if(r.error||!r.data||!r.data.ativo){ccAvisar('Usuário sem acesso ativo.','erro');return;}
 cc$('ccNomeUsuario').textContent=r.data.nome||'Usuário';cc$('ccPerfilUsuario').textContent=r.data.perfil;
 if(['SUPER_USUARIO','ADMINISTRADOR'].includes(r.data.perfil))cc$('menuUsuarios').style.display='block';
 else {ccAvisar('Conciliação reservada a administrador e super usuário.','erro');cc$('ccLinhas').innerHTML='<tr><td colspan="7">Acesso restrito.</td></tr>';return;}
 await ccCarregar();
}
cc$('ccAtualizar').addEventListener('click',ccCarregar);
for(const id of ['ccBusca','ccFiltro','ccEmpresa','ccPorPagina']) cc$(id).addEventListener(id==='ccBusca'?'input':'change',()=>{ccEstado.pagina=1;ccRender();});
cc$('ccAnterior').addEventListener('click',()=>{if(ccEstado.pagina>1){ccEstado.pagina--;ccRender();}});
cc$('ccProximo').addEventListener('click',()=>{ccEstado.pagina++;ccRender();});
cc$('ccLinhas').addEventListener('click',e=>{
 const b=e.target.closest('[data-detalhe]');if(!b)return;
 const c=ccEstado.contratos.find(c=>String(c.contrato_id)===b.dataset.detalhe);if(c)ccDetalhes(c);
});
cc$('ccLinhas').addEventListener('change',e=>{
 const input=e.target.closest('[data-select]');if(!input)return;
 if(input.checked)ccEstado.selecionados.add(input.dataset.select);else ccEstado.selecionados.delete(input.dataset.select);ccRender();
});
cc$('ccSelecionarPagina').addEventListener('change',e=>{
 ccPaginados().parte.filter(ccApto).forEach(c=>e.target.checked?ccEstado.selecionados.add(String(c.contrato_id)):ccEstado.selecionados.delete(String(c.contrato_id)));ccRender();
});
cc$('ccConferiLote').addEventListener('change',ccRender);
cc$('ccIntegrarLote').addEventListener('click',ccLote);
cc$('ccFecharDetalhe').addEventListener('click',()=>{cc$('ccDetalhe').hidden=true;ccEstado.atual=null;});
cc$('ccConferido').addEventListener('change',()=>{cc$('ccConfirmar').disabled=!cc$('ccConferido').checked||ccEstado.processando;});
cc$('ccConfirmar').addEventListener('click',ccConfirmarUm);
cc$('ccIgnorar').addEventListener('click',ccIgnorar);
cc$('btnSair').addEventListener('click',async e=>{e.preventDefault();await ccClient.auth.signOut();location.href='index.html';});
ccIniciar().catch(e=>ccAvisar(ccErro(e),'erro'));
