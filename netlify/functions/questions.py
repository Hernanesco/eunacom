from common import bank, respond


def handler(event, context):
    if event.get("httpMethod") != "GET":
        return respond({"error": "Método no permitido"}, 405)

    params = event.get("queryStringParameters") or {}
    category = params.get("category")
    source = params.get("source")
    topic = params.get("topic")
    limit_raw = params.get("limit")
    try:
        limit = int(limit_raw) if limit_raw else None
    except ValueError:
        limit = None

    filtered = bank.filter_questions(category=category, source=source, topic=topic)
    if limit:
        filtered = filtered[:limit]

    return respond(
        {
            "questions": filtered,
            "available_categories": bank.categories(),
            "available_sources": bank.sources(),
        }
    )
