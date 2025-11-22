import json
import random
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data/questions.json"


class QuestionBank:
    def __init__(self) -> None:
        self.questions: List[Dict[str, object]] = []
        self._load_questions()

    def _load_questions(self) -> None:
        if DATA_PATH.exists():
            with DATA_PATH.open("r", encoding="utf-8") as f:
                self.questions = json.load(f)
        else:
            self.questions = []

    def categories(self) -> List[str]:
        return sorted({q.get("category", "") for q in self.questions})

    def sources(self) -> List[str]:
        return sorted({q.get("source", "") for q in self.questions})

    def filter_questions(
        self, category: Optional[str] = None, source: Optional[str] = None, topic: Optional[str] = None
    ) -> List[Dict[str, object]]:
        results = self.questions
        if category:
            results = [q for q in results if q.get("category") == category]
        if source:
            results = [q for q in results if q.get("source") == source]
        if topic:
            results = [q for q in results if q.get("topic") == topic]
        return results

    def get_question(self, question_id: str) -> Optional[Dict[str, object]]:
        for q in self.questions:
            if q.get("id") == question_id:
                return q
        return None

    def start_exam(self, total_questions: int = 10) -> List[Dict[str, object]]:
        pool = list(self.questions)
        random.shuffle(pool)
        return pool[:total_questions]


bank = QuestionBank()
