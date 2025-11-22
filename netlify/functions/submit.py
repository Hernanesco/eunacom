from typing import Dict, Optional

from common import bank, get_user_id_for_token, parse_json, record_result, respond


def _get_question(question_id: str) -> Optional[Dict[str, object]]:
    return bank.get_question(question_id)


def handler(event, context):
    if event.get("httpMethod") != "POST":
        return respond({"error": "Método no permitido"}, 405)

    payload = parse_json(event.get("body"))
    token = payload.get("token")
    question_id = payload.get("question_id")
    selected = payload.get("selected")

    if token is None or question_id is None or selected is None:
        return respond({"error": "Faltan datos"}, 400)

    user_id = get_user_id_for_token(token)
    if user_id is None:
        return respond({"error": "Sesión inválida"}, 401)

    question = _get_question(question_id)
    if question is None:
        return respond({"error": "Pregunta no encontrada"}, 404)

    correct_index = question.get("answer_index")
    is_correct = selected == correct_index
    record_result(
        user_id,
        question_id,
        question.get("category", ""),
        question.get("topic", ""),
        is_correct,
    )
    response = {
        "correct": is_correct,
        "correct_index": correct_index,
        "justification": question.get("justification", ""),
        "question_id": question_id,
    }
    return respond(response)
