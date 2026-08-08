// Принимает вебхуки от Telegram Bot API. Деплой:
//   supabase functions deploy telegram-webhook --no-verify-jwt
// (флаг обязателен — Telegram не умеет присылать Supabase JWT; вместо этого
// проверяем секретный заголовок, который сам Telegram подставляет при
// регистрации вебхука с параметром secret_token, см. README).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

// Та же формула XP/уровня/энергии, что в src/modules/profile.js и health.js —
// продублирована здесь, потому что Deno-функция не может импортировать код фронтенда.
async function addXpAndEnergy(userKey: string, xpDelta: number, energyDelta: number) {
  const { data: profile } = await supabase.from('profile').select('*').eq('user_key', userKey).maybeSingle();
  if (!profile) return;

  let xp = profile.xp + xpDelta;
  let level = profile.level;
  let coins = profile.coins;
  let need = level * 100;
  while (xp >= need) {
    xp -= need;
    level += 1;
    coins += 5;
    need = level * 100;
  }
  coins += Math.round(xpDelta / 5);
  const energy = Math.max(0, Math.min(100, profile.energy + energyDelta));

  await supabase
    .from('profile')
    .update({ xp, level, coins, energy, updated_at: new Date().toISOString() })
    .eq('user_key', userKey);
}

async function handleStart(chatId: number, token: string | undefined) {
  if (!token) {
    await sendMessage(chatId, 'Открой эту ссылку из приложения DAVAI QUEST (Здоровье → Telegram → Подключить), чтобы привязать аккаунт.');
    return;
  }
  const { data: tokenRow } = await supabase
    .from('telegram_link_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle();

  if (!tokenRow) {
    await sendMessage(chatId, 'Ссылка недействительна или уже использована — сгенерируй новую в приложении.');
    return;
  }

  await supabase.from('telegram_link_tokens').update({ used: true }).eq('token', token);
  await supabase.from('telegram_links').upsert({ user_key: tokenRow.user_key, chat_id: chatId });
  await sendMessage(
    chatId,
    'Готово! Аккаунт DAVAI QUEST привязан.\n\nПиши «сон 7» — запишу часы сна, «размялся» — засчитаю разминку. Напоминания буду присылать сам.'
  );
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await req.json();
  const message = update.message;
  if (!message || typeof message.text !== 'string') {
    return new Response('ok');
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text.startsWith('/start')) {
    await handleStart(chatId, text.split(' ')[1]);
    return new Response('ok');
  }

  const { data: link } = await supabase.from('telegram_links').select('user_key').eq('chat_id', chatId).maybeSingle();
  if (!link) {
    await sendMessage(chatId, 'Аккаунт ещё не привязан — открой приложение DAVAI QUEST → Здоровье → Telegram → «Подключить».');
    return new Response('ok');
  }
  const userKey = link.user_key;

  const sleepMatch = text.match(/^(?:\/sleep\s+)?сон\s+(\d+(?:[.,]\d+)?)/i);
  const moveMatch = /^(размялся|разминка|двигался)/i.test(text);

  if (sleepMatch) {
    const hours = parseFloat(sleepMatch[1].replace(',', '.'));
    await supabase
      .from('sleep_logs')
      .upsert({ user_key: userKey, log_date: todayStr(), hours, source: 'telegram' }, { onConflict: 'user_key,log_date,source' });
    const xp = hours >= 7 ? 10 : 5;
    await addXpAndEnergy(userKey, xp, hours >= 7 ? 15 : 5);
    await sendMessage(chatId, `Записал: ${hours} ч сна · +${xp} XP`);
  } else if (moveMatch) {
    await supabase.from('activity_logs').insert({ user_key: userKey, log_date: todayStr(), metric: 'movement_count', value: 1, source: 'telegram' });
    await addXpAndEnergy(userKey, 5, 6);
    await sendMessage(chatId, 'Разминка засчитана 💪 +5 XP');
  } else if (text === '/help' || text.toLowerCase() === 'помощь') {
    await sendMessage(chatId, 'Команды:\n«сон 7» — записать часы сна\n«размялся» — засчитать разминку\nНапоминания присылаю сам, когда пора.');
  } else {
    await sendMessage(chatId, 'Не понял. Напиши «сон 7», «размялся» или /help.');
  }

  return new Response('ok');
});
