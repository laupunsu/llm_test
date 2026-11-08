import json
import os
import re
import urllib.error
import urllib.request
from typing import Any
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Standalone LLM Task Parser")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "https://timely-task-parser.vercel.app, http://localhost:5173"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in cors_origins.split(",")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)


def extract_json(text: str) -> Any:
    """Parse JSON returned by Gemini, including responses wrapped in code fences."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # If the model adds surrounding text, extract the first JSON object.
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("No JSON object found")
        return json.loads(cleaned[start : end + 1])


@app.get("/health")
def health():
    return {"ok": True, "service": "llm-task-parser"}


@app.post("/parse-tasks")
def parse_tasks(request_data: ParseRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in the backend .env file.",
        )

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    prompt = f"""
Extract the actionable tasks from the user's message.

Return ONLY valid JSON in this exact shape:
{{
  "tasks": [
    {{
      "title": "short action-oriented task title",
      "venue": "venue explicitly mentioned, or empty string",
      "duration_minutes": 30,
      "priority": "medium",
      "deadline": null
    }}
  ]
}}

Rules:
- Do not invent venues, deadlines, or durations.
- If duration is not stated, estimate a reasonable duration and make that estimate clear only through the numeric value.
- duration_minutes must be a positive integer.
- priority must be one of: "low", "medium", "high".
- deadline should be a time such as "18:00" only if the user gives a deadline; otherwise null.
- Split clearly distinct activities into separate tasks.
- Ignore general context that is not an actionable task.
- If there are no actionable tasks, return {{"tasks": []}}.
- Extract EVERY distinct actionable activity mentioned in the input.
- Never omit an activity just because it is brief or lacks details.
- If multiple activities are joined by "and", extract each separately.
- Preserve the user's intended activity and venue.
- Do not merge separate activities into one task.
- If a venue is mentioned, associate it with the relevant activity.

User message:
{request_data.text}
""".strip()

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "maxOutputTokens": 1400,
        },
    }

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    http_request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(http_request, timeout=30) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        try:
            provider_message = (
                json.loads(error_body).get("error", {}).get("message")
                or "Gemini request failed"
            )
        except (json.JSONDecodeError, AttributeError):
            provider_message = "Gemini request failed"
        raise HTTPException(status_code=502, detail=provider_message)
    except urllib.error.URLError:
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to the Gemini task-parsing service.",
        )
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an unreadable response.",
        )

    try:
        candidates = response_data.get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", [])
        generated_text = "\n".join(
            part.get("text", "") for part in parts if part.get("text")
        ).strip()
        if not generated_text:
            raise ValueError("Gemini returned no text")

        parsed = extract_json(generated_text)
        tasks = parsed.get("tasks")
        if not isinstance(tasks, list):
            raise ValueError("The response does not contain a tasks list")

        # Keep the response shape predictable for the frontend.
        normalized_tasks = []
        for task in tasks:
            if not isinstance(task, dict) or not task.get("title"):
                continue
            try:
                duration = int(task.get("duration_minutes", 30))
            except (TypeError, ValueError):
                duration = 30

            priority = str(task.get("priority", "medium")).lower()
            if priority not in {"low", "medium", "high"}:
                priority = "medium"

            normalized_tasks.append(
                {
                    "title": str(task["title"]).strip(),
                    "venue": str(task.get("venue") or "").strip(),
                    "duration_minutes": max(1, duration),
                    "priority": priority,
                    "deadline": task.get("deadline"),
                }
            )

        return {"tasks": normalized_tasks}

    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty or invalid task list. Please try again.",
        )
