import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1';
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(root, 'public')));

const personas = {
  friendly: 'Be warm, patient and encouraging. Offer hints when the learner is stuck.',
  direct: 'Be concise, honest and clear. Correct important errors without unnecessary praise.',
  tough: 'Be playfully sarcastic and witty. Tease mistakes, never the learner. Never humiliate or discriminate.'
};
const scenarios = {
  daily: 'Practice simple workplace small talk: role, routine, team and tasks.',
  api: 'Practice explaining an API, requests, errors and endpoints to a teammate.',
  aws: 'Practice AWS and cloud topics such as SQS, Lambda, retries, logs and deployments.',
  meetings: 'Practice giving a status update, explaining a blocker and suggesting next steps.',
  interview: 'Practice technical interview answers, one question at a time.'
};
function instructions({personality, explanationLanguage, level, scenario}) {
  const levels = {
    zero: 'Use very short sentences, common words and one idea at a time.',
    basic: 'Use simple grammar and common workplace vocabulary. Avoid long questions.',
    intermediate: 'Encourage complete answers and natural technical phrases.',
    advanced: 'Focus on natural phrasing, precision and professional communication.'
  };
  return `You are DevBuddy, a witty AI friend and spoken-English coach for Brazilian technology professionals.
MISSION: Help the learner speak confidently through short, natural conversations. The learner should speak more than you.
TEACHING LOOP: Ask one clear question at a time. Understand intent before correcting. Correct at most one or two high-value errors per turn. Give a natural corrected sentence and a brief explanation. Ask the learner to repeat it when useful, then continue. Never claim exact pronunciation scoring.
LANGUAGE: ${explanationLanguage === 'english' ? 'Use English only; simplify if the learner is stuck.' : 'Speak mainly English. Use brief Brazilian Portuguese explanations when helpful.'}
LEVEL: ${levels[level] || levels.basic}
PERSONALITY: ${personas[personality] || personas.direct}
SCENARIO: ${scenarios[scenario] || scenarios.daily}
STYLE: Be conversational, not a textbook. Avoid lectures and multiple questions in one turn. Explain jargon briefly. Never fabricate facts about the learner or workplace.`;
}
app.get('/api/health', (_req, res) => res.json({ok:true, apiKeyConfigured:Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'replace_me'), model}));
app.post('/api/session', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'replace_me') return res.status(503).json({error:'Configure OPENAI_API_KEY no arquivo .env antes de iniciar uma conversa.'});
  const b = req.body || {};
  const safe = {
    personality: ['friendly','direct','tough'].includes(b.personality) ? b.personality : 'direct',
    explanationLanguage: b.explanationLanguage === 'english' ? 'english' : 'help',
    level: ['zero','basic','intermediate','advanced'].includes(b.level) ? b.level : 'basic',
    scenario: ['daily','api','aws','meetings','interview'].includes(b.scenario) ? b.scenario : 'daily'
  };
  const payload = {
    expires_after: {anchor:'created_at', seconds:600},
    session: {type:'realtime', model, instructions:instructions(safe), output_modalities:['audio'],
      audio:{input:{transcription:{model:'gpt-4o-mini-transcribe',language:'en'},turn_detection:{type:'server_vad',create_response:true,interrupt_response:true}},output:{voice:'marin'}}}
  };
  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/client_secrets',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data = await upstream.json().catch(()=>({}));
    if (!upstream.ok) {
      console.error('Realtime session creation failed:', upstream.status, data?.error?.message || 'unknown error');
      return res.status(upstream.status).json({error:data?.error?.message || 'Não foi possível criar a sessão. Confira acesso à API e o modelo.'});
    }
    return res.json({value:data.value,expires_at:data.expires_at,session:{id:data.session?.id,model:data.session?.model}});
  } catch (err) {
    console.error('Realtime request failed:', err.message);
    return res.status(502).json({error:'Falha de conexão com a API de voz. Verifique sua internet.'});
  }
});
app.listen(port,'127.0.0.1',()=>console.log(`DevBuddy English: http://localhost:${port} | model=${model} | API key configured=${Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'replace_me')}`));
