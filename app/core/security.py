import re

INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"bypass (all )?security protocols",
    r"system prompt override",
    r"you are now in developer mode",
    r"dan mode",
]

def sanitize_user_input(text: str) -> str:
    cleaned = text.strip()
    # Mencegah eksekusi script tag di frontend
    cleaned = cleaned.replace("<script>", "").replace("</script>", "")
    return cleaned

def check_prompt_injection(text: str) -> bool:
    lower_text = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, lower_text):
            return True
    return False