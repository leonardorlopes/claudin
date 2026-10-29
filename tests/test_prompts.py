from app.prompts import build_system_instruction


def test_prompt_includes_personality_level_and_scenario() -> None:
    prompt = build_system_instruction(
        personality="tough",
        level="intermediate",
        scenario="aws",
        explanation_language="english",
    )

    assert "playfully sarcastic" in prompt
    assert "natural technical phrases" in prompt
    assert "AWS and cloud topics" in prompt
    assert "Use English only" in prompt


def test_unknown_options_fall_back_to_safe_defaults() -> None:
    prompt = build_system_instruction(
        personality="invalid",
        level="invalid",
        scenario="invalid",
        explanation_language="invalid",
    )

    assert "concise, honest, and clear" in prompt
    assert "simple grammar" in prompt
    assert "workplace small talk" in prompt
    assert "Brazilian Portuguese" in prompt
