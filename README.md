# Simulador EUNACOM

Aplicación web mínima para ensayar el EUNACOM con preguntas categorizadas por tema y reconstrucción. Incluye autenticación básica para guardar el progreso y detectar áreas débiles.

## Requisitos

- Python 3.10+
- Entorno virtual recomendado

Instala dependencias:

```bash
pip install -r requirements.txt
```

## Uso

1. Inicializa la base de datos y arranca el servidor:

```bash
python app.py
```

2. Abre `http://localhost:8000` en el navegador.
3. Regístrate o inicia sesión para que se guarde el progreso.
4. Filtra preguntas por categoría, tema o reconstrucción, o ejecuta un simulador rápido.
5. Revisa el panel de progreso para ver tus temas más débiles.

## Estructura de preguntas

Las preguntas viven en `data/questions.json` con el siguiente formato:

```json
{
  "id": "cardio-2019-01",
  "stem": "Enunciado de la pregunta",
  "options": ["A", "B", "C", "D"],
  "answer_index": 0,
  "justification": "Explicación breve",
  "category": "Cardiología",
  "topic": "Síndrome coronario agudo",
  "source": "Reconstrucción Eunacom julio 2019"
}
```

Puedes añadir más preguntas o nuevas reconstrucciones al archivo y el banco se actualizará automáticamente en el siguiente arranque.
