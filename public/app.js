const $ = (selector) => document.querySelector(selector);
const FRAME_SAMPLES = 1600; // 100 ms at 16 kHz
const state = {personality:'direct',socket:null,stream:null,context:null,source:null,processor:null,timer:null,startedAt:null,nextPlayAt:0,muted:false,pendingChunks:[],pendingSamples:0};
const startButton=$('#startButton'), endButton=$('#endButton'), micButton=$('#micButton');
const log=$('#conversationLog'), welcome=$('#welcomeState');
for(const button of document.querySelectorAll('[data-personality]')) button.addEventListener('click',()=>{
 state.personality=button.dataset.personality;
 document.querySelectorAll('[data-personality]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
function status(message){$('#liveStatus').textContent=message}
function connection(message){$('#connectionBadge').textContent=message}
function showError(message){const el=$('#setupError');el.textContent=message;el.hidden=false;status(message)}
function addLine(role,text){
 if(!text?.trim())return;
 welcome.hidden=true;log.hidden=false;
 const line=document.createElement('div');line.className='chat-line '+role;
 const label=document.createElement('span');label.className='chat-label';label.textContent=role==='user'?'YOU':'DEVBUDDY';
 const content=document.createElement('span');content.className='chat-content';content.textContent=text;line.append(label,content);log.append(line);log.scrollTop=log.scrollHeight;
}
function base64ToBytes(value){const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function playPcm(base64){
 if(!state.context)return;
 const bytes=base64ToBytes(base64), pcm=new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2));
 const samples=new Float32Array(pcm.length);for(let i=0;i<pcm.length;i++)samples[i]=pcm[i]/32768;
 const buffer=state.context.createBuffer(1,samples.length,24000);buffer.copyToChannel(samples,0);
 const source=state.context.createBufferSource();source.buffer=buffer;source.connect(state.context.destination);
 const now=state.context.currentTime;state.nextPlayAt=Math.max(state.nextPlayAt,now+0.03);source.start(state.nextPlayAt);state.nextPlayAt+=buffer.duration;
}
function sendAudio(float32){
 if(!state.socket||state.socket.readyState!==WebSocket.OPEN||state.muted)return;
 const pcm=new Int16Array(float32.length);
 for(let i=0;i<float32.length;i++){const sample=Math.max(-1,Math.min(1,float32[i]));pcm[i]=sample<0?sample*32768:sample*32767}
 const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
 state.socket.send(JSON.stringify({type:'audio',data:btoa(binary)}));
}
function resampleTo16k(input, inputRate){
 if(inputRate===16000)return input;
 const outputLength=Math.max(1,Math.floor(input.length*16000/inputRate));
 const output=new Float32Array(outputLength), ratio=inputRate/16000;
 for(let i=0;i<outputLength;i++){const position=i*ratio, left=Math.floor(position), fraction=position-left;const right=Math.min(left+1,input.length-1);output[i]=(input[left]||0)*(1-fraction)+(input[right]||0)*fraction}
 return output;
}
function queueAudio(samples){
 state.pendingChunks.push(samples);state.pendingSamples+=samples.length;
 while(state.pendingSamples>=FRAME_SAMPLES){
  const frame=new Float32Array(FRAME_SAMPLES);let written=0;
  while(written<FRAME_SAMPLES){
   const head=state.pendingChunks[0], take=Math.min(head.length,FRAME_SAMPLES-written);
   frame.set(head.subarray(0,take),written);written+=take;
   if(take===head.length)state.pendingChunks.shift();else state.pendingChunks[0]=head.subarray(take);
   state.pendingSamples-=take;
  }
  sendAudio(frame);
 }
}
async function startAudioCapture(){
 state.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 state.context=new AudioContext();
 await state.context.resume();
 await state.context.audioWorklet.addModule('/static/pcm-capture-processor.js');
 state.source=state.context.createMediaStreamSource(state.stream);
 state.processor=new AudioWorkletNode(state.context,'pcm-capture-processor',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
 state.processor.port.onmessage=event=>{if(!state.muted)queueAudio(resampleTo16k(event.data,state.context.sampleRate));};
 // Keep the graph alive without sending microphone audio to the speakers.
 const silentGain=state.context.createGain();silentGain.gain.value=0;state.silentGain=silentGain;
 state.source.connect(state.processor);state.processor.connect(silentGain);silentGain.connect(state.context.destination);
}
function handleMessage(event){
 let message;try{message=JSON.parse(event.data)}catch{return}
 switch(message.type){
  case 'ready':connection('Connected');status('Gemini is ready. Start speaking!');$('#controlTitle').textContent='You’re live — say hello';$('#controlSubtitle').textContent='Speak naturally; the model detects when you pause.';break;
  case 'transcript':addLine(message.role==='user'?'user':'assistant',message.text);if(message.role==='user')status('You’re speaking…');else status('DevBuddy is responding…');break;
  case 'audio':playPcm(message.data);break;
  case 'turn_complete':status('Your turn. Speak when you’re ready.');break;
  case 'interrupted':state.nextPlayAt=state.context?.currentTime||0;status('Response interrupted. Listening to you…');break;
  case 'notice':status(message.message);break;
  case 'error':showError(message.message||'Gemini Live returned an error.');break;
 }
}
async function start(){
 $('#setupError').hidden=true;startButton.disabled=true;startButton.textContent='Connecting…';connection('Connecting');status('Preparing your Gemini Live session…');
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.WebSocket||!window.AudioWorkletNode)throw new Error('Use uma versão atualizada do Chrome ou Edge para áudio em tempo real.');
  await startAudioCapture();
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  state.socket=new WebSocket(protocol+'//'+location.host+'/ws/live');
  state.socket.addEventListener('open',()=>state.socket.send(JSON.stringify({type:'start',options:{personality:state.personality,level:$('#level').value,scenario:$('#scenario').value,explanationLanguage:$('#language').value}})));
  state.socket.addEventListener('message',handleMessage);
  state.socket.addEventListener('error',()=>showError('Falha no WebSocket local. Confira se o servidor FastAPI está rodando.'));
  state.socket.addEventListener('close',()=>{if(state.startedAt)cleanup(false);});
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('Tempo esgotado ao conectar ao Gemini Live.')),20000);
   const onMessage=e=>{try{const data=JSON.parse(e.data);if(data.type==='ready'){clearTimeout(timeout);state.socket.removeEventListener('message',onMessage);resolve()}else if(data.type==='error'){clearTimeout(timeout);state.socket.removeEventListener('message',onMessage);reject(new Error(data.message))}}catch{}};
   state.socket.addEventListener('message',onMessage);
  });
  state.startedAt=Date.now();state.timer=setInterval(updateTimer,1000);endButton.disabled=false;micButton.disabled=false;
 }catch(e){console.error(e);showError(e.message||'Não foi possível iniciar a sessão.');await cleanup(false)}
 finally{startButton.disabled=false;startButton.textContent='Start speaking ↗'}
}
function updateTimer(){if(!state.startedAt)return;const n=Math.floor((Date.now()-state.startedAt)/1000);$('#sessionTimer').textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
async function cleanup(show=true){
 if(state.timer)clearInterval(state.timer);state.timer=null;state.startedAt=null;
 try{state.processor?.disconnect();state.source?.disconnect();state.silentGain?.disconnect()}catch{}
 state.processor?.port?.close();state.processor=null;state.source=null;state.silentGain=null;
 state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;
 if(state.socket&&state.socket.readyState===WebSocket.OPEN){try{state.socket.send(JSON.stringify({type:'stop'}));state.socket.close()}catch{}}
 state.socket=null;if(state.context){try{await state.context.close()}catch{}}state.context=null;state.nextPlayAt=0;state.muted=false;state.pendingChunks=[];state.pendingSamples=0;micButton.style.opacity='1';
 endButton.disabled=true;micButton.disabled=true;$('#controlTitle').textContent='Session ended';$('#controlSubtitle').textContent='Start another session whenever you’re ready.';$('#sessionTimer').textContent='00:00';
 if(show){connection('Not connected');status('Session ended. Nice work showing up to practice.')}
}
startButton.addEventListener('click',start);endButton.addEventListener('click',()=>cleanup());
micButton.addEventListener('click',()=>{state.muted=!state.muted;micButton.style.opacity=state.muted?'.55':'1';micButton.setAttribute('aria-label',state.muted?'Unmute microphone':'Mute microphone');status(state.muted?'Microphone muted.':'Microphone on. Speak when ready.')});
window.addEventListener('beforeunload',()=>{state.stream?.getTracks().forEach(track=>track.stop());state.socket?.close();state.context?.close()});
