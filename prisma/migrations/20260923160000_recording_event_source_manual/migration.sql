-- 録画イベントの経路を 'cron' (予約作品の自動録画) | 'manual' (画面から) の 2 値にする。
-- 'ui' は画面からの送信で、今後は 'manual' と書く。'webhook' は nagisa 側で撤去済みで行は無い。
UPDATE "recording_events" SET "source" = 'manual' WHERE "source" IN ('ui', 'webhook');
