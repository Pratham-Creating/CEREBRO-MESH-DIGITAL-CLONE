function sqlDate(date) {
  return new Date(date).toISOString().slice(0, 23).replace('T', ' ');
}

export function createRepository(db) {
  return {
    async recordEvent(event) {
      const [result] = await db.execute(
        `INSERT INTO activity_events (occurred_at, event_type, app_name, window_title, process_id, data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sqlDate(event.occurredAt), event.type, event.appName ?? null, event.windowTitle ?? null,
          event.processId ?? null, event.data ? JSON.stringify(event.data) : null],
      );
      return result.insertId;
    },
    async openWindowSession(snapshot) {
      const [result] = await db.execute(
        `INSERT INTO window_sessions (started_at, app_name, window_title, process_id)
         VALUES (?, ?, ?, ?)`,
        [sqlDate(snapshot.at), snapshot.appName, snapshot.windowTitle || null, snapshot.processId || null],
      );
      return result.insertId;
    },
    async closeWindowSession(id, endedAt) {
      await db.execute(
        `UPDATE window_sessions
         SET ended_at = ?, duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
         WHERE id = ? AND ended_at IS NULL`,
        [sqlDate(endedAt), sqlDate(endedAt), id],
      );
    },
    async listEvents({ limit = 200, type, from, to }) {
      const conditions = [];
      const values = [];
      if (type) { conditions.push('event_type = ?'); values.push(type); }
      if (from) { conditions.push('occurred_at >= ?'); values.push(from); }
      if (to) { conditions.push('occurred_at <= ?'); values.push(to); }
      values.push(Math.min(Math.max(Number(limit) || 200, 1), 1000));
      const [rows] = await db.execute(
        `SELECT id, occurred_at AS occurredAt, event_type AS type, app_name AS appName,
                window_title AS windowTitle, process_id AS processId, data
         FROM activity_events ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY occurred_at DESC LIMIT ?`, values,
      );
      return rows.map((row) => ({ ...row, data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data }));
    },
    async listSessions({ limit = 100, from, to }) {
      const conditions = [];
      const values = [];
      if (from) { conditions.push('started_at >= ?'); values.push(from); }
      if (to) { conditions.push('started_at <= ?'); values.push(to); }
      values.push(Math.min(Math.max(Number(limit) || 100, 1), 1000));
      const [rows] = await db.execute(
        `SELECT id, started_at AS startedAt, ended_at AS endedAt,
                COALESCE(duration_ms, CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER)) AS durationMs,
                app_name AS appName, window_title AS windowTitle, process_id AS processId
         FROM window_sessions ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY started_at DESC LIMIT ?`, values,
      );
      return rows;
    },
    async dashboard({ from, to }) {
      const where = [];
      const values = [];
      if (from) { where.push('started_at >= ?'); values.push(from); }
      if (to) { where.push('started_at <= ?'); values.push(to); }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [apps] = await db.execute(
        `SELECT app_name AS appName, COUNT(*) AS sessionCount,
                COALESCE(SUM(COALESCE(duration_ms, CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER))), 0) AS durationMs
         FROM window_sessions ${clause} GROUP BY app_name ORDER BY durationMs DESC LIMIT 12`, values,
      );
      const [counts] = await db.execute(
        `SELECT event_type AS type, COUNT(*) AS count FROM activity_events ${clause.replaceAll('started_at', 'occurred_at')}
         GROUP BY event_type ORDER BY count DESC`, values,
      );
      return { apps, counts };
    },
  };
}
