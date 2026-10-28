/* DESTAC — Dashboard somente leitura. Usa o mesmo modulo de permissao "contratos". */
(() => {
'use strict';
const URL='https://kvmayirfbdnexlzqnjvr.supabase.co';
const KEY='sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';
const db=window.destacCreateClient(URL,KEY);
const el=id=>document.getElementById(id);
let contratos=[], clientes=new Map(), empresas=new Map(), faixaSelecionada=null;
const dataBr=s=>s? s.split('-').reverse().join('/'):'—';
const fmtHora=n=>String(Math.floor(n/3600)).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const txtHora=s=>{const m=/^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s||'');if(!m)return null;const h=+m[1],mi=+m[2],se=+(m[3]||0);return h<24&&mi<60&&se<60?h*3600+mi*60+se:null;};
const dow=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).getUTCDay();};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function aviso(msg,erro=false){el('aviso').textContent=msg;el('aviso').classList.toggle('error',erro);}
async function buscarTudo(tabela,campos){let todos=[];for(let i=0;i<100;i++){const {data,error}=await db.from(tabela).select(campos).range(i*500,i*500+499);if(error)throw error;todos.push(...(data||[]));if(!data||data.length<500)return todos;}throw Error('Limite de paginação atingido em '+tabela);}
function preencher(id,arr,valor,nome){const sel=el(id),atual=sel.value;sel.replaceChildren(new Option('Todos',''));for(const o of arr)sel.add(new Option(nome(o),String(valor(o))));if([...sel.options].some(o=>o.value===atual))sel.value=atual;}
const grupoDoDia=d=>d===2||d===4?'TERCA_QUINTA':d===0||d===6?'SABADO_DOMINGO':null;
function horarios(c,grupo){const valor=grupo==='TERCA_QUINTA'?c.horarios_terca_quinta:c.horarios_sabado_domingo;let v=valor;if(typeof v==='string'){try{v=JSON.parse(v)}catch{return []}}return Array.isArray(v)?v.map(x=>typeof x==='string'?x:x?.horario).filter(Boolean):[];}
function dadosFiltrados(){const data=el('dataFiltro').value,grupo=grupoDoDia(dow(data));const empresa=el('empresaFiltro').value,cliente=el('clienteFiltro').value,veiculo=el('veiculoFiltro').value,pend=el('mostrarPendentes').checked;
 const cs=contratos.filter(c=>(c.status==='ATIVO'||(pend&&c.status==='PENDENTE'))&&c.data_inicio<=data&&c.data_termino>=data&&(!empresa||String(c.empresa_id)===empresa)&&(!cliente||String(c.cliente_id)===cliente)&&(!veiculo||c.veiculo_executor===veiculo));
 const inicio=grupo==='TERCA_QUINTA'?13*3600+30*60:8*3600,fim=grupo==='TERCA_QUINTA'?21*3600:12*3600;
 const reservas=[];if(grupo)for(const c of cs)for(const h of horarios(c,grupo)){const segundos=txtHora(h);if(segundos!==null&&segundos>=inicio&&segundos+30<=fim)reservas.push({segundos,contrato:c,hora:fmtHora(segundos)});}
 reservas.sort((a,b)=>a.segundos-b.segundos||a.contrato.id-b.contrato.id);return {cs,reservas,grupo,inicio,fim};}
function tabelaRender(id,linhas,cols){el(id).innerHTML=linhas.length?linhas.join(''):`<tr><td colspan="${cols}" class="db-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;}
function desenhar(){if(!el('dataFiltro').value){aviso('Selecione uma data.',true);return;}const {cs,reservas,grupo,inicio,fim}=dadosFiltrados();const d= dow(el('dataFiltro').value);
 el('periodoLabel').textContent=grupo==='TERCA_QUINTA'?'Terça/Quinta · 13h30–21h00':grupo==='SABADO_DOMINGO'?'Sábado/Domingo · 08h00–12h00':'Sem feira programada';
 const sobrepostos=new Set();for(let i=0;i<reservas.length;i++)for(let j=i+1;j<reservas.length&&reservas[j].segundos<reservas[i].segundos+30;j++)if(reservas[i].contrato.veiculo_executor.toLowerCase().trim()===reservas[j].contrato.veiculo_executor.toLowerCase().trim()){sobrepostos.add(i);sobrepostos.add(j);}
 const totalSlots = grupo ? Math.floor((fim-inicio)/30) : 0;
 const ocupadosSlots = new Set();
 for (const r of reservas) for (let slot=Math.floor((r.segundos-inicio)/30);slot<=Math.floor((r.segundos+29-inicio)/30);slot++) if(slot>=0&&slot<totalSlots&&inicio+slot*30<r.segundos+30&&inicio+(slot+1)*30>r.segundos)ocupadosSlots.add(slot);
 el('kLivres').textContent=grupo?Math.max(0,totalSlots-ocupadosSlots.size).toLocaleString('pt-BR'):'—';
 el('kContratos').textContent=cs.length;el('kInsercoes').textContent=reservas.length;el('kOcupados').textContent=new Set(reservas.map(x=>x.segundos)).size;el('kConflitos').textContent=sobrepostos.size;
 const heat=el('heatmap');heat.replaceChildren();if(grupo)for(let min=inicio;min<fim;min+=900){const n=reservas.filter(r=>r.segundos>=min&&r.segundos<min+900).length;const local=reservas.filter(r=>r.segundos>=min&&r.segundos<min+900);const conflito=local.some(x=>reservas.some(y=>y!==x&&y.contrato.id!==x.contrato.id&&y.contrato.veiculo_executor.toLowerCase().trim()===x.contrato.veiculo_executor.toLowerCase().trim()&&x.segundos<y.segundos+30&&y.segundos<x.segundos+30));const b=document.createElement('button');b.type='button';b.className=(conflito?'conflict':n?'occupied':'')+(faixaSelecionada===min?' selected':'');b.innerHTML='<b>'+fmtHora(min).slice(0,5)+'</b><small>'+ (n?n+' reserva'+(n===1?'':'s'):'Sem reservas')+'</small>';b.addEventListener('click',()=>{faixaSelecionada=faixaSelecionada===min?null:min;desenhar();});heat.append(b);}
 el('limparFaixa').disabled=faixaSelecionada===null;el('tituloDetalhe').textContent=faixaSelecionada===null?'Programação da data':'Reservas de '+fmtHora(faixaSelecionada).slice(0,5)+' a '+fmtHora(faixaSelecionada+900).slice(0,5);
 const visiveis=reservas.filter(r=>faixaSelecionada===null||r.segundos>=faixaSelecionada&&r.segundos<faixaSelecionada+900);
 tabelaRender('tabelaGrade',visiveis.map(r=>{const col=reservas.filter(x=>x!==r&&x.contrato.id!==r.contrato.id&&x.contrato.veiculo_executor.toLowerCase().trim()===r.contrato.veiculo_executor.toLowerCase().trim()&&x.segundos<r.segundos+30&&r.segundos<x.segundos+30).length;return `<tr><td><b>${esc(r.hora)}</b></td><td>${esc(clientes.get(String(r.contrato.cliente_id))||'Cliente '+r.contrato.cliente_id)}</td><td>${esc(r.contrato.numero_contrato)}</td><td>${esc(r.contrato.veiculo_executor)}</td><td><span class="db-pill ${col?'error':''}">${col?'Sobreposição ('+col+')':'Reservado'}</span></td></tr>`;}),5);
 tabelaRender('tabelaContratos',cs.map(c=>`<tr><td>${esc(c.numero_contrato)}</td><td>${esc(clientes.get(String(c.cliente_id))||'Cliente '+c.cliente_id)}</td><td>${esc(c.status)}</td><td>${dataBr(c.data_inicio)} a ${dataBr(c.data_termino)}</td><td>${grupo?horarios(c,grupo).length:0}</td></tr>`),5);
 aviso(grupo?`Dados de ${dataBr(el('dataFiltro').value)}. Reservas registradas em contratos; não é confirmação de execução no ZaraRadio.`:'Não há feira no dia selecionado. Selecione terça, quinta, sábado ou domingo.');
}
async function iniciar(){try{const {data:{user},error:uerr}=await db.auth.getUser();if(uerr||!user){location.href='index.html';return;}
 const {data:perm,error:perr}=await db.rpc('destac_tem_permissao',{p_modulo:'contratos',p_acao:'visualizar'});if(perr||perm!==true){aviso('Acesso restrito: seu usuário não tem permissão para consultar contratos.',true);return;}
 const {data:perfil}=await db.from('perfis_usuario').select('nome,perfil').eq('user_id',user.id).maybeSingle();el('nomeUsuario').textContent=perfil?.nome||user.email;el('perfilUsuario').textContent=perfil?.perfil||'';
 const [cs,cls,ems]=await Promise.all([buscarTudo('contratos','id,numero_contrato,cliente_id,empresa_id,veiculo_executor,status,data_inicio,data_termino,horarios_terca_quinta,horarios_sabado_domingo'),buscarTudo('clientes','id,razao_social'),buscarTudo('empresas','id,razao_social')]);contratos=cs;clientes=new Map(cls.map(c=>[String(c.id),c.razao_social||'Cliente '+c.id]));empresas=new Map(ems.map(c=>[String(c.id),c.razao_social||'Empresa '+c.id]));
 preencher('empresaFiltro',ems,c=>c.id,c=>c.razao_social||'Empresa '+c.id);preencher('clienteFiltro',cls,c=>c.id,c=>c.razao_social||'Cliente '+c.id);preencher('veiculoFiltro',[...new Set(cs.map(c=>c.veiculo_executor).filter(Boolean))].sort(),v=>v,v=>v);
 const agora=new Date();const local=new Date(agora.getTime()-agora.getTimezoneOffset()*60000);el('dataFiltro').value=local.toISOString().slice(0,10);
 for(const id of ['dataFiltro','empresaFiltro','clienteFiltro','veiculoFiltro','mostrarPendentes'])el(id).addEventListener('change',()=>{faixaSelecionada=null;desenhar();});el('btnAtualizar').addEventListener('click',()=>location.reload());el('limparFaixa').addEventListener('click',()=>{faixaSelecionada=null;desenhar();});el('btnSair').addEventListener('click',async e=>{e.preventDefault();await db.auth.signOut();location.href='index.html';});desenhar();
 }catch(e){console.error('Dashboard DESTAC:',e);aviso('Não foi possível carregar o dashboard: '+(e.message||String(e)),true);}}
 iniciar();
})();
