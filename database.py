import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from werkzeug.security import check_password_hash, generate_password_hash

DB_PATH = "eunacom.db"


def _get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS progress (
            user_id INTEGER NOT NULL,
            question_id TEXT NOT NULL,
            category TEXT NOT NULL,
            topic TEXT NOT NULL,
            correct_count INTEGER NOT NULL DEFAULT 0,
            incorrect_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, question_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )
    conn.commit()
    conn.close()


def create_user(username: str, password: str) -> bool:
    conn = _get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password)),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def authenticate_user(username: str, password: str) -> Optional[int]:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row and check_password_hash(row["password_hash"], password):
        return row["id"]
    return None


def create_session(user_id: int, token: str) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


def get_user_id_for_token(token: str) -> Optional[int]:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM sessions WHERE token = ?", (token,))
    row = cursor.fetchone()
    conn.close()
    return row["user_id"] if row else None


def record_result(user_id: int, question_id: str, category: str, topic: str, is_correct: bool) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO progress (user_id, question_id, category, topic, correct_count, incorrect_count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
            correct_count=excluded.correct_count + CASE WHEN ? THEN 1 ELSE 0 END + progress.correct_count,
            incorrect_count=excluded.incorrect_count + CASE WHEN ? THEN 0 ELSE 1 END + progress.incorrect_count;
        """,
        (user_id, question_id, category, topic, 1 if is_correct else 0, 0 if is_correct else 1, is_correct, is_correct),
    )
    conn.commit()
    conn.close()


def get_topic_breakdown(user_id: int) -> List[Dict[str, object]]:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT topic, category, SUM(correct_count) AS correct, SUM(incorrect_count) AS incorrect
        FROM progress
        WHERE user_id = ?
        GROUP BY topic, category
        ORDER BY (CAST(correct AS REAL) / NULLIF(correct + incorrect, 0)) ASC
        """,
        (user_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    breakdown = []
    for row in rows:
        total = row["correct"] + row["incorrect"]
        accuracy = row["correct"] / total if total else 0.0
        breakdown.append(
            {
                "topic": row["topic"],
                "category": row["category"],
                "correct": row["correct"],
                "incorrect": row["incorrect"],
                "accuracy": round(accuracy, 2),
            }
        )
    return breakdown
