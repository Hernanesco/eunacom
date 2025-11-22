from pathlib import Path
from secrets import token_hex
from typing import Dict, List

from flask import Flask, jsonify, request, send_from_directory

from database import authenticate_user, create_session, get_topic_breakdown, get_user_id_for_token, init_db, record_result
from question_bank import bank

app = Flask(__name__, static_folder="static")


@app.before_first_request
def bootstrap() -> None:
    init_db()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/login", methods=["POST"])
def login():
    payload = request.get_json(force=True)
    username = payload.get("username", "").strip()
    password = payload.get("password", "")
    user_id = authenticate_user(username, password)
    if user_id is None:
        return jsonify({"error": "Credenciales inválidas"}), 401
    token = token_hex(16)
    create_session(user_id, token)
    return jsonify({"token": token})


@app.route("/api/questions", methods=["GET"])
def list_questions():
    category = request.args.get("category")
    source = request.args.get("source")
    topic = request.args.get("topic")
    limit = request.args.get("limit", type=int)
    filtered = bank.filter_questions(category=category, source=source, topic=topic)
    if limit:
        filtered = filtered[:limit]
    return jsonify({"questions": filtered, "available_categories": bank.categories(), "available_sources": bank.sources()})


@app.route("/api/exam", methods=["POST"])
def start_exam():
    payload = request.get_json(force=True)
    total = payload.get("total", 10)
    questions = bank.start_exam(total_questions=total)
    return jsonify({"questions": questions})


@app.route("/api/submit", methods=["POST"])
def submit_answer():
    payload = request.get_json(force=True)
    token = payload.get("token")
    question_id = payload.get("question_id")
    selected = payload.get("selected")
    if token is None or question_id is None or selected is None:
        return jsonify({"error": "Faltan datos"}), 400
    user_id = get_user_id_for_token(token)
    if user_id is None:
        return jsonify({"error": "Sesión inválida"}), 401
    question = bank.get_question(question_id)
    if question is None:
        return jsonify({"error": "Pregunta no encontrada"}), 404
    correct_index = question["answer_index"]
    is_correct = selected == correct_index
    record_result(user_id, question_id, question.get("category", ""), question.get("topic", ""), is_correct)
    response: Dict[str, object] = {
        "correct": is_correct,
        "correct_index": correct_index,
        "justification": question.get("justification", ""),
        "question_id": question_id,
    }
    return jsonify(response)


@app.route("/api/progress", methods=["GET"])
def progress():
    token = request.args.get("token")
    if token is None:
        return jsonify({"error": "Se requiere token"}), 400
    user_id = get_user_id_for_token(token)
    if user_id is None:
        return jsonify({"error": "Sesión inválida"}), 401
    breakdown = get_topic_breakdown(user_id)
    weak_areas: List[Dict[str, object]] = []
    for item in breakdown:
        if item["correct"] + item["incorrect"] >= 2 and item["accuracy"] < 0.75:
            weak_areas.append(item)
    return jsonify({"breakdown": breakdown, "weak_areas": weak_areas})


@app.route("/static/<path:path>")
def static_proxy(path: str):
    return send_from_directory(app.static_folder, path)


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=8000, debug=True)
