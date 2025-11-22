from typing import Dict, List

from common import get_topic_breakdown, get_user_id_for_token, respond


def _weak_areas(breakdown: List[Dict[str, object]]) -> List[Dict[str, object]]:
    weak: List[Dict[str, object]] = []
    for item in breakdown:
        if item.get("correct", 0) + item.get("incorrect", 0) >= 2 and item.get("accuracy", 0) < 0.75:
            weak.append(item)
    return weak


def handler(event, context):
    if event.get("httpMethod") != "GET":
        return respond({"error": "Método no permitido"}, 405)

    params = event.get("queryStringParameters") or {}
    token = params.get("token")
    if token is None:
        return respond({"error": "Se requiere token"}, 400)

    user_id = get_user_id_for_token(token)
    if user_id is None:
        return respond({"error": "Sesión inválida"}, 401)

    breakdown = get_topic_breakdown(user_id)
    return respond({"breakdown": breakdown, "weak_areas": _weak_areas(breakdown)})
