from secrets import token_hex

from common import authenticate_user, create_session, parse_json, respond


def handler(event, context):
    if event.get("httpMethod") != "POST":
        return respond({"error": "Método no permitido"}, 405)

    payload = parse_json(event.get("body"))
    username = payload.get("username", "").strip()
    password = payload.get("password", "")

    user_id = authenticate_user(username, password)
    if user_id is None:
        return respond({"error": "Credenciales inválidas"}, 401)

    token = token_hex(16)
    create_session(user_id, token)
    return respond({"token": token})
