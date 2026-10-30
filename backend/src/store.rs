use crate::{
    error::{ApiError, Result, now_ms, text},
    model::Book,
};
use argon2::{
    Argon2, PasswordHasher, PasswordVerifier,
    password_hash::{PasswordHash, SaltString},
};
use rand_core::{OsRng, RngCore};
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{path::Path, sync::Mutex, time::Duration};

pub struct Store {
    connection: Mutex<Connection>,
    replay_scope: Mutex<String>,
}

fn token_hash(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
fn token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent).map_err(ApiError::internal)?;
        }
        let mut conn = Connection::open(path)?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch(
            "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
        )?;
        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version > 1 {
            return Err(ApiError::internal(
                "Database schema is newer than this backend",
            ));
        }
        if version == 0 {
            let tx = conn.transaction()?;
            tx.execute_batch("CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, full_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_ms INTEGER NOT NULL);
                CREATE TABLE accounts(user_id INTEGER PRIMARY KEY REFERENCES users(id), snapshot TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_ms INTEGER NOT NULL);
                CREATE INDEX sessions_expiry ON sessions(expires_ms);
                PRAGMA user_version=1;")?;
            tx.commit()?;
        }
        conn.execute_batch("CREATE TABLE IF NOT EXISTS replay_accounts(user_id INTEGER PRIMARY KEY REFERENCES users(id),snapshot TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0);")?;
        conn.execute_batch("CREATE TABLE IF NOT EXISTS replay_workspaces(id TEXT PRIMARY KEY,dataset TEXT NOT NULL,meta TEXT NOT NULL,cursor INTEGER NOT NULL,speed INTEGER NOT NULL,ended INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workspace_accounts(workspace_id TEXT NOT NULL REFERENCES replay_workspaces(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id),snapshot TEXT NOT NULL,PRIMARY KEY(workspace_id,user_id)); CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);")?;
        Ok(Self {
            replay_scope: Mutex::new(String::new()),
            connection: Mutex::new(conn),
        })
    }
    fn conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.connection.lock().map_err(ApiError::internal)
    }

    /// Create only the first account in an empty database, using setup inputs.
    /// Existing accounts (including renamed first users) are never overwritten.
    pub fn ensure_initial_user(&self, username: &str, password: &str) -> Result<()> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let exists: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM users)", [], |r| r.get(0))?;
        if !exists {
            let username = username.trim().to_lowercase();
            validate_username(&username)?;
            if password.is_empty() || password.len() > 128 {
                return Err(ApiError::bad("Invalid initial password"));
            }
            let hash = hash_password(password)?;
            let snapshot = serde_json::to_string(&Book::new())?;
            tx.execute("INSERT INTO users(username,full_name,password_hash,created_ms) VALUES(?1,?1,?2,?3)",params![username,hash,now_ms()])?;
            let user = tx.last_insert_rowid();
            tx.execute(
                "INSERT INTO accounts(user_id,snapshot) VALUES(?1,?2)",
                params![user, snapshot],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn register(&self, req: &Value) -> Result<Value> {
        let username = text(req, "username")?.trim().to_lowercase();
        if !(3..=40).contains(&username.len())
            || !username
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            return Err(ApiError::bad(
                "Username must be 3–40 letters, numbers, underscores or hyphens",
            ));
        }
        let full_name = text(req, "fullName")?.trim();
        if full_name.len() > 100 {
            return Err(ApiError::bad("Display name is too long"));
        }
        let pw = text(req, "password")?;
        validate_password(pw)?;
        let hash = hash_password(pw)?;
        let snapshot = serde_json::to_string(&Book::new())?;
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM users WHERE username=?1)",
            [&username],
            |r| r.get(0),
        )?;
        if exists {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "Username already taken".into(),
            ));
        }
        tx.execute(
            "INSERT INTO users(username,full_name,password_hash,created_ms) VALUES(?1,?2,?3,?4)",
            params![username, full_name, hash, now_ms()],
        )?;
        let user = tx.last_insert_rowid();
        tx.execute(
            "INSERT INTO accounts(user_id,snapshot) VALUES(?1,?2)",
            params![user, snapshot],
        )?;
        tx.commit()?;
        drop(conn);
        self.session(user)
    }

    pub fn login(&self, req: &Value) -> Result<Value> {
        let username = text(req, "username")?;
        let pw = text(req, "password")?;
        if username.len() > 100 || pw.len() > 128 {
            return Err(ApiError::unauthorized());
        }
        let row: Option<(i64, String)> = self
            .conn()?
            .query_row(
                "SELECT id,password_hash FROM users WHERE username=?1",
                [username],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let Some((user, hash)) = row else {
            // Equalize the costly path for unknown users.
            let _ = hash_password(pw)?;
            return Err(ApiError::unauthorized());
        };
        if Argon2::default()
            .verify_password(
                pw.as_bytes(),
                &PasswordHash::new(&hash).map_err(ApiError::internal)?,
            )
            .is_err()
        {
            return Err(ApiError::unauthorized());
        }
        self.session(user)
    }

    fn session(&self, user: i64) -> Result<Value> {
        let token = token();
        {
            let conn = self.conn()?;
            conn.execute("DELETE FROM sessions WHERE expires_ms<?1", [now_ms()])?;
            conn.execute(
                "INSERT INTO sessions VALUES(?1,?2,?3)",
                params![token_hash(&token), user, now_ms() + 86_400_000],
            )?;
        }
        Ok(json!({"success":true,"user":self.user(user)?,"token":token}))
    }
    pub fn authenticate(&self, token: &str) -> Result<i64> {
        if token.len() != 64 {
            return Err(ApiError::unauthorized());
        }
        self.conn()?
            .query_row(
                "SELECT user_id FROM sessions WHERE token_hash=?1 AND expires_ms>?2",
                params![token_hash(token), now_ms()],
                |r| r.get(0),
            )
            .optional()?
            .ok_or_else(ApiError::unauthorized)
    }
    pub fn logout(&self, token: &str) -> Result<()> {
        self.conn()?.execute(
            "DELETE FROM sessions WHERE token_hash=?1",
            [token_hash(token)],
        )?;
        Ok(())
    }
    pub fn user(&self, user: i64) -> Result<Value> {
        self.conn()?.query_row("SELECT id,username,full_name,created_ms FROM users WHERE id=?1",[user],|r| Ok(json!({"id":r.get::<_,i64>(0)?,"username":r.get::<_,String>(1)?,"fullName":r.get::<_,String>(2)?,"createdAt":r.get::<_,u64>(3)?,"startingBalance":100000.0,"mode":"server"}))).optional()?.ok_or_else(ApiError::not_found)
    }
    pub fn profile(&self, user: i64, req: &Value) -> Result<Value> {
        if req.get("password").is_some() {
            return Err(ApiError::bad("Use newPassword and currentPassword"));
        }
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let (old_name, old_full, old_hash): (String, String, String) = tx.query_row(
            "SELECT username,full_name,password_hash FROM users WHERE id=?1",
            [user],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        let username = req
            .get("username")
            .and_then(|v| v.as_str())
            .unwrap_or(&old_name)
            .trim()
            .to_lowercase();
        validate_username(&username)?;
        let full_name = req
            .get("fullName")
            .and_then(|v| v.as_str())
            .unwrap_or(&old_full)
            .trim();
        if full_name.is_empty() || full_name.len() > 100 {
            return Err(ApiError::bad("Invalid display name"));
        }
        let new_password = req
            .get("newPassword")
            .and_then(|v| v.as_str())
            .filter(|p| !p.is_empty());
        let changing_credentials = username != old_name || new_password.is_some();
        if changing_credentials {
            let current = text(req, "currentPassword")?;
            if current.len() > 128
                || Argon2::default()
                    .verify_password(
                        current.as_bytes(),
                        &PasswordHash::new(&old_hash).map_err(ApiError::internal)?,
                    )
                    .is_err()
            {
                return Err(ApiError::bad("Current password is incorrect"));
            }
        }
        if tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM users WHERE username=?1 AND id<>?2)",
            params![username, user],
            |r| r.get::<_, bool>(0),
        )? {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "Username already taken".into(),
            ));
        }
        let hash = if let Some(password) = new_password {
            validate_password(password)?;
            hash_password(password)?
        } else {
            old_hash
        };
        tx.execute(
            "UPDATE users SET username=?1,full_name=?2,password_hash=?3 WHERE id=?4",
            params![username, full_name, hash, user],
        )?;
        let replacement = if changing_credentials {
            tx.execute("DELETE FROM sessions WHERE user_id=?1", [user])?;
            let raw = token();
            tx.execute(
                "INSERT INTO sessions VALUES(?1,?2,?3)",
                params![token_hash(&raw), user, now_ms() + 86_400_000],
            )?;
            Some(raw)
        } else {
            None
        };
        tx.commit()?;
        drop(conn);
        let mut response = json!({"success":true,"user":self.user(user)?});
        if let Some(token) = replacement {
            response["token"] = json!(token);
        }
        Ok(response)
    }
    pub fn workspace_put(&self, r: &crate::replay::Replay) -> Result<()> {
        self.conn()?.execute("INSERT INTO replay_workspaces VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET dataset=excluded.dataset,meta=excluded.meta,cursor=excluded.cursor,speed=excluded.speed,ended=excluded.ended",params![r.id,serde_json::to_string(r)?,r.view().to_string(),r.cursor,r.speed,r.ended])?;
        Ok(())
    }
    pub fn workspace_progress(&self, r: &crate::replay::Replay) -> Result<()> {
        self.conn()?.execute(
            "UPDATE replay_workspaces SET cursor=?1,speed=?2,ended=?3,meta=?4 WHERE id=?5",
            params![r.cursor, r.speed, r.ended, r.view().to_string(), r.id],
        )?;
        Ok(())
    }
    pub fn workspace_get(&self, id: &str) -> Result<Option<crate::replay::Replay>> {
        let conn = self.conn()?;
        let row: Option<(String, usize, u32, bool)> = conn
            .query_row(
                "SELECT dataset,cursor,speed,ended FROM replay_workspaces WHERE id=?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .optional()?;
        row.map(|(raw, cursor, speed, ended)| {
            let mut r: crate::replay::Replay = serde_json::from_str(&raw)?;
            r.cursor = cursor.min(r.frames.len());
            r.speed = speed;
            r.ended = ended;
            r.playing = false;
            Ok(r)
        })
        .transpose()
    }
    pub fn workspace_list(&self) -> Result<Vec<Value>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT meta FROM replay_workspaces ORDER BY rowid DESC")?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        rows.into_iter()
            .map(|s| serde_json::from_str(&s).map_err(ApiError::from))
            .collect()
    }
    pub fn workspace_activate(&self, r: &crate::replay::Replay) -> Result<()> {
        if !r.id.is_empty() {
            if self.workspace_get(&r.id)?.is_none() {
                self.workspace_put(r)?;
            }
            self.meta_set("active-replay", &r.id)?;
        }
        *self.replay_scope.lock().map_err(ApiError::internal)? = r.id.clone();
        Ok(())
    }
    pub fn workspace_delete(&self, id: &str) -> Result<()> {
        self.conn()?
            .execute("DELETE FROM replay_workspaces WHERE id=?1", [id])?;
        Ok(())
    }
    pub fn meta_get(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .conn()?
            .query_row("SELECT value FROM app_meta WHERE key=?1", [key], |r| {
                r.get(0)
            })
            .optional()?)
    }
    pub fn meta_set(&self, key: &str, value: &str) -> Result<()> {
        self.conn()?.execute("INSERT INTO app_meta VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value])?;
        Ok(())
    }
    pub fn workspace_import_legacy(&self, r: &crate::replay::Replay) -> Result<()> {
        self.workspace_put(r)?;
        self.conn()?.execute("INSERT OR IGNORE INTO workspace_accounts SELECT ?1,user_id,snapshot FROM replay_accounts",[&r.id])?;
        self.meta_set("active-replay", &r.id)?;
        Ok(())
    }
    pub fn workspace_apply_step(
        &self,
        r: &crate::replay::Replay,
        market: &crate::market::Market,
    ) -> Result<()> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let rows = {
            let mut stmt = tx
                .prepare("SELECT user_id,snapshot FROM workspace_accounts WHERE workspace_id=?1")?;
            stmt.query_map([&r.id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?
        };
        for (user, raw) in rows {
            let mut book: Book = serde_json::from_str(&raw)?;
            crate::automation::squareoff(&mut book, market)?;
            crate::orders::process(&mut book, market)?;
            let updated = serde_json::to_string(&book)?;
            if raw != updated {
                tx.execute("UPDATE workspace_accounts SET snapshot=?1 WHERE workspace_id=?2 AND user_id=?3",params![updated,r.id,user])?;
            }
        }
        tx.execute(
            "UPDATE replay_workspaces SET cursor=?1,speed=?2,ended=?3,meta=?4 WHERE id=?5",
            params![r.cursor, r.speed, r.ended, r.view().to_string(), r.id],
        )?;
        tx.commit()?;
        Ok(())
    }
    pub fn workspace_has_activity(&self, id: &str) -> Result<bool> {
        let conn = self.conn()?;
        let mut stmt =
            conn.prepare("SELECT snapshot FROM workspace_accounts WHERE workspace_id=?1")?;
        let rows = stmt
            .query_map([id], |r| r.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        for raw in rows {
            let b: Book = serde_json::from_str(&raw)?;
            if !b.orders.is_empty()
                || !b.engine.account().holdings().is_empty()
                || !b.engine.account().positions().is_empty()
            {
                return Ok(true);
            }
        }
        Ok(false)
    }
    pub fn workspace_book(&self, id: &str, user: i64) -> Result<Book> {
        let conn = self.conn()?;
        let raw: Option<String> = conn
            .query_row(
                "SELECT snapshot FROM workspace_accounts WHERE workspace_id=?1 AND user_id=?2",
                params![id, user],
                |r| r.get(0),
            )
            .optional()?;
        raw.map(|s| serde_json::from_str(&s))
            .transpose()
            .map(|v| v.unwrap_or_default())
            .map_err(ApiError::from)
    }
    pub fn read_replay(&self, user: i64) -> Result<Book> {
        if self
            .replay_scope
            .lock()
            .map_err(ApiError::internal)?
            .is_empty()
        {
            return Ok(Book::default());
        }
        self.transact_replay(user, |b| Ok(b.clone()))
    }
    pub fn transact_replay<T>(
        &self,
        user: i64,
        f: impl FnOnce(&mut Book) -> Result<T>,
    ) -> Result<T> {
        let scope = self
            .replay_scope
            .lock()
            .map_err(ApiError::internal)?
            .clone();
        if scope.is_empty() {
            return Err(ApiError::bad("Create or open a replay workspace first"));
        }
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let live: String = tx.query_row(
            "SELECT snapshot FROM accounts WHERE user_id=?1",
            [user],
            |r| r.get(0),
        )?;
        let live: Book = serde_json::from_str(&live)?;
        let raw: Option<String> = tx
            .query_row(
                "SELECT snapshot FROM workspace_accounts WHERE workspace_id=?1 AND user_id=?2",
                params![scope, user],
                |r| r.get(0),
            )
            .optional()?;
        let mut book: Book = raw
            .as_ref()
            .map(|r| serde_json::from_str(r))
            .transpose()?
            .unwrap_or_default();
        if raw.is_none() {
            let dataset: String = tx.query_row(
                "SELECT dataset FROM replay_workspaces WHERE id=?1",
                [&scope],
                |r| r.get(0),
            )?;
            let workspace: crate::replay::Replay = serde_json::from_str(&dataset)?;
            let keys: std::collections::BTreeSet<String> = workspace
                .frames
                .iter()
                .flat_map(|(_, events)| events.iter().map(|(key, _)| key.clone()))
                .collect();
            if let Some(list) = book.watchlists.first_mut() {
                list["stocks"] = json!(keys);
            }
        }
        book.settings = live.settings;
        let result = f(&mut book)?;
        tx.execute("INSERT INTO workspace_accounts(workspace_id,user_id,snapshot) VALUES(?1,?2,?3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET snapshot=excluded.snapshot",params![scope,user,serde_json::to_string(&book)?])?;
        tx.commit()?;
        Ok(result)
    }
    pub fn read(&self, user: i64) -> Result<Book> {
        let raw: String = self.conn()?.query_row(
            "SELECT snapshot FROM accounts WHERE user_id=?1",
            [user],
            |r| r.get(0),
        )?;
        Ok(serde_json::from_str(&raw)?)
    }
    pub fn transact<T>(&self, user: i64, f: impl FnOnce(&mut Book) -> Result<T>) -> Result<T> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let raw: String = tx.query_row(
            "SELECT snapshot FROM accounts WHERE user_id=?1",
            [user],
            |r| r.get(0),
        )?;
        let mut book: Book = serde_json::from_str(&raw)?;
        let output = f(&mut book)?;
        let active = !book.engine.account().positions().is_empty()
            || book.orders.iter().any(|o| o.status == "OPEN")
            || book.alerts.iter().any(|a| a["active"] == true)
            || book.gtt.iter().any(|g| g["status"] == "ACTIVE")
            || book.sips.iter().any(|s| s["active"] == true);
        let updated = serde_json::to_string(&book)?;
        if updated != raw {
            tx.execute(
                "UPDATE accounts SET snapshot=?1,active=?2 WHERE user_id=?3",
                params![updated, active, user],
            )?;
        }
        tx.commit()?;
        Ok(output)
    }
    pub fn all_users(&self) -> Result<Vec<i64>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT id FROM users")?;
        Ok(stmt
            .query_map([], |r| r.get(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?)
    }
    pub fn active_accounts(&self) -> Result<Vec<i64>> {
        let conn = self.conn()?;
        let mut s = conn.prepare("SELECT user_id FROM accounts WHERE active=1")?;
        Ok(s.query_map([], |r| r.get(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?)
    }
    pub fn public_accounts(&self) -> Result<Vec<(String, Book)>> {
        let conn = self.conn()?;
        let mut query=conn.prepare("SELECT users.username,accounts.snapshot FROM accounts JOIN users ON users.id=accounts.user_id")?;
        let rows = query
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        rows.into_iter()
            .map(|(name, raw)| Ok((name, serde_json::from_str(&raw)?)))
            .collect()
    }
}
use axum::http::StatusCode;
fn validate_password(pw: &str) -> Result<()> {
    if !(8..=128).contains(&pw.len()) {
        return Err(ApiError::bad("Password must be 8–128 bytes"));
    }
    Ok(())
}
fn hash_password(pw: &str) -> Result<String> {
    Argon2::default()
        .hash_password(pw.as_bytes(), &SaltString::generate(&mut OsRng))
        .map(|h| h.to_string())
        .map_err(ApiError::internal)
}

fn validate_username(username: &str) -> Result<()> {
    if !(3..=40).contains(&username.len())
        || !username
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(ApiError::bad(
            "Username must be 3–40 letters, numbers, underscores or hyphens",
        ));
    }
    Ok(())
}
