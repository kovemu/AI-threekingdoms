use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde_json::{json, Value};
use std::path::Path;

fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let c = Connection::open(path).map_err(|e| e.to_string())?;
    c.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, state TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, number INTEGER UNIQUE NOT NULL, record TEXT NOT NULL);") .map_err(|e|e.to_string())?;
    Ok(c)
}
pub fn load(path: &Path, initial: &Value) -> Result<Value, String> {
    let mut c = open(path)?;
    let tx = c
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO saves(id,version,state) VALUES(1,0,?1)",
        params![initial.to_string()],
    )
    .map_err(|e| e.to_string())?;
    let (version, raw): (i64, String) = tx
        .query_row("SELECT version,state FROM saves WHERE id=1", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|e| e.to_string())?;
    let state: Value = serde_json::from_str(&raw).map_err(|e| format!("저장 파일 손상: {e}"))?;
    if state["schemaVersion"] != 1 {
        return Err("지원하지 않는 저장 버전입니다. 파일을 보존합니다.".into());
    }
    let turns = {
        let mut stmt=tx.prepare("SELECT record FROM (SELECT number,record FROM turns ORDER BY number DESC LIMIT 100) ORDER BY number").map_err(|e|e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        let mut turns = Vec::new();
        for raw in rows {
            turns.push(
                serde_json::from_str::<Value>(&raw.map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?,
            );
        }
        turns
    };
    tx.commit().map_err(|e| e.to_string())?;
    Ok(json!({"version":version,"state":state,"turns":turns}))
}
pub fn commit(path: &Path, version: i64, turn: &Value) -> Result<(), String> {
    let raw = turn.to_string();
    if raw.len() > 2_000_000
        || version < 0
        || turn["number"].as_i64() != Some(version + 1)
        || turn["state"]["schemaVersion"] != 1
    {
        return Err("저장할 턴이 잘못되었습니다.".into());
    }
    let id = turn["id"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 80)
        .ok_or("턴 ID 오류")?;
    let mut c = open(path)?;
    let tx = c
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    // Exact retry after an IPC response was lost is idempotent; changed payload is never accepted.
    let existing: Option<String> = tx
        .query_row("SELECT record FROM turns WHERE id=?1", params![id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(old) = existing {
        return if old == raw {
            Ok(())
        } else {
            Err("중복 턴 ID".into())
        };
    }
    let updated = tx
        .execute(
            "UPDATE saves SET version=?1,state=?2 WHERE id=1 AND version=?3",
            params![version + 1, turn["state"].to_string(), version],
        )
        .map_err(|e| e.to_string())?;
    if updated != 1 {
        return Err("저장 상태가 바뀌었습니다. 게임을 다시 불러와 주세요.".into());
    }
    tx.execute(
        "INSERT INTO turns(id,number,record) VALUES(?1,?2,?3)",
        params![id, version + 1, raw],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn seed() -> Value {
        json!({"schemaVersion":1,"calendar":{"year":214,"month":6,"day":1}})
    }
    fn turn(id: &str, n: i64) -> Value {
        json!({"id":id,"number":n,"input":"進軍","narration":"到着","state":{"schemaVersion":1,"calendar":{"year":214,"month":6,"day":n+1}}})
    }
    #[test]
    fn restart_restores_exact_snapshot_and_log() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("game.sqlite");
        let first = load(&p, &seed()).unwrap();
        assert_eq!(first["version"], 0);
        let t = turn("turn-one", 1);
        commit(&p, 0, &t).unwrap();
        let restored = load(&p, &json!({"wrong":"seed"})).unwrap();
        assert_eq!(restored["version"], 1);
        assert_eq!(restored["state"], t["state"]);
        assert_eq!(restored["turns"], json!([t]));
    }
    #[test]
    fn stale_writer_and_duplicate_id_do_not_overwrite_save() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("game.sqlite");
        load(&p, &seed()).unwrap();
        let t = turn("turn-one", 1);
        commit(&p, 0, &t).unwrap();
        assert!(commit(&p, 0, &turn("stale", 1)).is_err());
        assert!(commit(&p, 1, &turn("turn-one", 2)).is_err());
        assert_eq!(load(&p, &seed()).unwrap()["version"], 1);
    }
    #[test]
    fn failed_turn_insert_rolls_back_updated_save() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("game.sqlite");
        load(&p, &seed()).unwrap();
        let c = Connection::open(&p).unwrap();
        c.execute_batch("CREATE TRIGGER fail_turn BEFORE INSERT ON turns BEGIN SELECT RAISE(ABORT,'disk error'); END;").unwrap();
        assert!(commit(&p, 0, &turn("one", 1)).is_err());
        let s = load(&p, &seed()).unwrap();
        assert_eq!(s["version"], 0);
        assert_eq!(s["state"], seed());
        assert_eq!(s["turns"], json!([]));
    }
}
