import json
import sys
from pathlib import Path
from typing import Any, Dict

# Ensure project root is on path so we can import shared modules
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from database import authenticate_user, create_session, get_topic_breakdown, get_user_id_for_token, init_db, record_result
from question_bank import bank

init_db()


def parse_json(body: str) -> Dict[str, Any]:
    if not body:
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {}


def respond(payload: Dict[str, Any], status: int = 200) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": json.dumps(payload, ensure_ascii=False),
    }

__all__ = [
    "authenticate_user",
    "bank",
    "create_session",
    "get_topic_breakdown",
    "get_user_id_for_token",
    "init_db",
    "parse_json",
    "record_result",
    "respond",
]
