from common import bank, parse_json, respond


def handler(event, context):
    if event.get("httpMethod") != "POST":
        return respond({"error": "Método no permitido"}, 405)

    payload = parse_json(event.get("body"))
    total = payload.get("total", 10)
    try:
        total_int = int(total)
    except (TypeError, ValueError):
        total_int = 10

    questions = bank.start_exam(total_questions=total_int)
    return respond({"questions": questions})
