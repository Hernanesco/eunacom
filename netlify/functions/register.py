from common import create_user, parse_json, respond


def handler(event, context):
    if event.get("httpMethod") != "POST":
        return respond({"error": "Método no permitido"}, 405)

    payload = parse_json(event.get("body"))
    username = payload.get("username", "").strip()
    password = payload.get("password", "")

    if not username or not password:
        return respond({"error": "Debe ingresar usuario y contraseña"}, 400)

    created = create_user(username, password)
    if not created:
        return respond({"error": "El usuario ya existe"}, 400)

    return respond({"status": "ok"})
