// Периодическая проверка напоминаний для всех, кто подключил Telegram —
// та же логика, что в src/modules/reminders.js, но со стороны сервера и с
// дедупом (шлём каждое напоминание не чаще раза в день на пользователя).
// Вызывается по расписанию через pg_cron + pg_net (см. README), не пользователем.
// Деплой: supabase functions deploy telegram-reminders --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
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

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: links } = await supabase.from('telegram_links').select('*');
  if (!links || !links.length) return new Response('ok');

  const now = new Date();
  const today = todayStr();

  for (const link of links) {
    const { data: profile } = await supabase.from('profile').select('*').eq('user_key', link.user_key).maybeSingle();
    if (!profile) continue;

    const patch: Record<string, string> = {};

    const { data: lastMove } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('user_key', link.user_key)
      .eq('metric', 'movement_count')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastMoveAt = lastMove ? new Date(lastMove.created_at) : new Date(0);
    const lastMoveMinutes = (now.getTime() - lastMoveAt.getTime()) / 60000;

    if (lastMoveMinutes >= profile.move_interval_min && link.last_move_reminder_at !== today) {
      await sendMessage(link.chat_id, `Прошло ${Math.round(lastMoveMinutes)} мин без движения — время размяться.`);
      patch.last_move_reminder_at = today;
    }

    const hour = now.getHours();
    if ((hour >= profile.sleep_reminder_hour || hour < 5) && link.last_sleep_reminder_at !== today) {
      await sendMessage(link.chat_id, 'Уже поздно — не забудь лечь спать вовремя.');
      patch.last_sleep_reminder_at = today;
    }

    if (profile.energy < 25 && link.last_energy_reminder_at !== today) {
      await sendMessage(link.chat_id, 'Энергия критически низкая. Сделай паузу.');
      patch.last_energy_reminder_at = today;
    }

    if (Object.keys(patch).length) {
      await supabase.from('telegram_links').update(patch).eq('user_key', link.user_key);
    }
  }

  return new Response('ok');
});
