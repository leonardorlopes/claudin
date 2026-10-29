const $ = (s) => document.querySelector(s);
const state = {personality:'direct',pc:null,dc:null,stream:null,timer:null,startedAt:null,transcripts:new Map()};
const startButton=$('#startButton'), endButton=$('#endButton'), micButton=$('#micButton');
const log=$('#conversationLog'), welcome=$('#welcomeState'), audio=$('#remoteAudio');
for(const button of document.querySelectorAll('[data-personality]')) button.addEventListener('click',()=>{
 state.personality=button.dataset.personality;
 document.querySelectorAll('[data-personality]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
function status(message){$('#liveStatus').textContent=message}
function connection(message){$('#connectionBadge').textContent=message}
function error(message){const el=$('#setupError');el.textContent=message;el.hidden=false;status(message)}
function addLine(role,text,key){
 if(!text?.trim())return;
 if(key){const old=log.querySelector('[data-key="'+CSS.escape(key)+'"]');if(old){old.querySelector('.chat-content').textContent=text;return old;}}
 welcome.hidden=true;log.hidden=false;
 const line=document.createElement('div');line.className='chat-line '+role;if(key)line.dataset.key=key;
 const label=document.createElement('span');label.className='chat-label';label.textContent=role==='user'?'YOU':'DEVBUDDY';
 const content=document.createElement('span');content.className='chat-content';content.textContent=text;line.append(label,content);log.append(line);log.scrollTop=log.scrollHeight;return line;
}
async function start(){
 $('#setupError').hidden=true;startButton.disabled=true;startButton.textContent='Connecting…';connection('Connecting');status('Preparing your voice session…');
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw new Error('Atualize o Chrome ou Edge para usar áudio/WebRTC.');
  const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({personality:state.personality,level:$('#level').value,scenario:$('#scenario').value,explanationLanguage:$('#language').value})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Falha ao criar sessão.');if(!data.value)throw new Error('A API não retornou credencial temporária.');
  state.stream=await navigator.mediaDevices.getUserMedia({audio:true});state.pc=new RTCPeerConnection();
  state.pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>status('Clique na página para liberar o áudio.'));};
  state.pc.onconnectionstatechange=()=>{if(!state.pc)return;if(state.pc.connectionState==='connected'){connection('Connected');status('Connected. Speak naturally — I’m listening.');}else if(['failed','disconnected'].includes(state.pc.connectionState)){connection('Connection issue');status('Connection interrupted. End the session and retry.');}};
  state.stream.getTracks().forEach(t=>state.pc.addTrack(t,state.stream));
  state.dc=state.pc.createDataChannel('oai-events');
  state.dc.addEventListener('open',()=>state.dc.send(JSON.stringify({type:'response.create',response:{instructions:'Greet the learner briefly and ask exactly one simple opening question for the selected technology conversation.'}})));
  state.dc.addEventListener('message',e=>{let ev;try{ev=JSON.parse(e.data)}catch{return}handleEvent(ev)});
  const offer=await state.pc.createOffer();await state.pc.setLocalDescription(offer);
  const answer=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+data.value,'Content-Type':'application/sdp'},body:offer.sdp});
  const sdp=await answer.text();if(!answer.ok)throw new Error('Falha na conexão de voz ('+answer.status+'). '+sdp.slice(0,180));
  await state.pc.setRemoteDescription({type:'answer',sdp});
  state.startedAt=Date.now();state.timer=setInterval(updateTimer,1000);endButton.disabled=false;micButton.disabled=false;$('#controlTitle').textContent='You’re live — say hello';$('#controlSubtitle').textContent='You can interrupt the AI naturally.';status('Connecting audio…');
 }catch(e){console.error(e);error(e.message||'Não foi possível iniciar a sessão.');await cleanup(false)}
 finally{startButton.disabled=false;startButton.textContent='Start speaking ↗'}
}
function handleEvent(e){
 if(e.type==='input_audio_buffer.speech_started')status('You’re speaking…');
 else if(e.type==='input_audio_buffer.speech_stopped')status('Thinking about your answer…');
 else if(e.type==='conversation.item.input_audio_transcription.completed'&&e.transcript)addLine('user',e.transcript,'user-'+(e.item_id||e.event_id||crypto.randomUUID()));
 else if(['response.output_audio_transcript.delta','response.output_text.delta'].includes(e.type)){
  const key='assistant-'+(e.item_id||e.response_id||'current'), text=(state.transcripts.get(key)||'')+(e.delta||'');state.transcripts.set(key,text);addLine('assistant',text,key);status('DevBuddy is talking…');
 }else if(['response.output_audio_transcript.done','response.output_text.done'].includes(e.type)){
  const text=e.transcript||e.text,key='assistant-'+(e.item_id||e.response_id||'current');if(text){state.transcripts.set(key,text);addLine('assistant',text,key);}
 }else if(e.type==='response.done')status('Your turn. Speak when you’re ready.');
 else if(e.type==='error')status(e.error?.message||'Voice event error. Try again if needed.');
}
function updateTimer(){if(!state.startedAt)return;const n=Math.floor((Date.now()-state.startedAt)/1000);$('#sessionTimer').textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
async function cleanup(show=true){
 if(state.timer)clearInterval(state.timer);state.timer=null;state.startedAt=null;
 try{state.dc?.close()}catch{}state.dc=null;try{state.pc?.close()}catch{}state.pc=null;
 state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;audio.srcObject=null;
 endButton.disabled=true;micButton.disabled=true;$('#controlTitle').textContent='Session ended';$('#controlSubtitle').textContent='Start another session whenever you’re ready.';$('#sessionTimer').textContent='00:00';
 if(show){connection('Not connected');status('Session ended. Nice work showing up to practice.')}
}
startButton.addEventListener('click',start);endButton.addEventListener('click',()=>cleanup());
micButton.addEventListener('click',()=>{const track=state.stream?.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;micButton.style.opacity=track.enabled?'1':'.55';micButton.setAttribute('aria-label',track.enabled?'Mute microphone':'Unmute microphone');status(track.enabled?'Microphone on. Speak when ready.':'Microphone muted.')});
window.addEventListener('beforeunload',()=>{state.stream?.getTracks().forEach(t=>t.stop());state.pc?.close()});
