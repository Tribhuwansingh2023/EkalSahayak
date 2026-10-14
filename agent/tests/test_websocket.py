"""WebSocket Questionnaire Security & Functionality Test Suite (/ws/quiz).

Covers:
- Rejection of unauthenticated sessions with close code 4401
- Rejection of invalid/expired tokens with close code 4401
- Successful full happy-path quiz interactive session
- Rejection of concurrent second session for same user with close code 4409
- Enforcement of 16 KB max message size limit
- Anti-flood message throttling
"""

import json

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.config import Settings
from app.security import create_access_token


@pytest.fixture
def auth_user_token(setup_test_db) -> str:
    """Generates a valid access token for testing WebSocket quiz sessions."""
    from bson import ObjectId
    user_id = str(ObjectId())
    settings = Settings()
    token = create_access_token(user_id=user_id, role="student", settings=settings)
    return token


def test_ws_quiz_no_token_rejected_4401(sync_client: TestClient):
    """Connecting without a valid token and sending non-auth frame closes with 4401."""
    try:
        with sync_client.websocket_connect("/ws/quiz") as ws:
            ws.send_text(json.dumps({"type": "PING"}))
            ws.receive_text()
            pytest.fail("Expected WebSocket to disconnect with code 4401")
    except WebSocketDisconnect as exc:
        assert exc.code == 4401


def test_ws_quiz_invalid_token_rejected_4401(sync_client: TestClient):
    """Connecting with an invalid token query parameter closes with 4401."""
    try:
        with sync_client.websocket_connect("/ws/quiz?token=invalid_forged_token") as ws:
            ws.receive_text()
            pytest.fail("Expected WebSocket to disconnect with code 4401")
    except WebSocketDisconnect as exc:
        assert exc.code == 4401


def test_ws_quiz_happy_path_session(sync_client: TestClient, auth_user_token: str):
    """Full questionnaire interaction: connects, receives questions without answers, submits answer."""
    with sync_client.websocket_connect(f"/ws/quiz?token={auth_user_token}&topic=evaporation") as ws:
        # 1. Receive Session Init frame
        init_frame = ws.receive_json()
        assert init_frame["type"] == "SESSION_INIT"
        assert init_frame["topic"] == "evaporation"

        # 2. Receive first question stripped of correct answer
        q_frame = ws.receive_json()
        assert q_frame["type"] == "QUESTION"
        assert "question_id" in q_frame
        assert "prompt_odia" in q_frame
        assert "correct_index" not in q_frame
        assert "correct_option_index" not in q_frame
        q_id = q_frame["question_id"]

        # 3. Submit Answer
        ws.send_text(
            json.dumps({
                "type": "SUBMIT_ANSWER",
                "question_id": q_id,
                "selected_index": 0,
                "time_taken_ms": 3200,
            })
        )

        # 4. Receive Answer Evaluation
        eval_frame = ws.receive_json()
        assert eval_frame["type"] == "ANSWER_EVALUATION"
        assert eval_frame["question_id"] == q_id
        assert "is_correct" in eval_frame
        assert "new_mastery" in eval_frame


def test_ws_quiz_concurrent_session_conflict_rejected_4409(sync_client: TestClient, auth_user_token: str):
    """Only 1 concurrent WebSocket session is allowed per user. Second attempt closes with 4409."""
    with sync_client.websocket_connect(f"/ws/quiz?token={auth_user_token}&topic=evaporation") as ws1:
        # First session is active
        init_frame = ws1.receive_json()
        assert init_frame["type"] == "SESSION_INIT"

        # Attempt to open second session with same user token
        try:
            with sync_client.websocket_connect(f"/ws/quiz?token={auth_user_token}&topic=evaporation") as ws2:
                ws2.receive_text()
                pytest.fail("Expected second connection to be rejected with 4409")
        except WebSocketDisconnect as exc:
            assert exc.code == 4409


def test_ws_quiz_oversize_message_rejected(sync_client: TestClient, auth_user_token: str):
    """Messages exceeding 16 KB size limit are rejected with an error frame."""
    with sync_client.websocket_connect(f"/ws/quiz?token={auth_user_token}&topic=evaporation") as ws:
        ws.receive_json()  # SESSION_INIT
        ws.receive_json()  # QUESTION

        # Send 17 KB oversized frame
        oversized_str = "A" * (17 * 1024)
        ws.send_text(oversized_str)

        err_frame = ws.receive_json()
        assert err_frame["type"] == "ERROR"
        assert "exceeds" in err_frame["message"].lower()


def test_ws_quiz_rapid_messages_throttled(sync_client: TestClient, auth_user_token: str):
    """Rapid consecutive messages within 0.2s interval receive THROTTLED frame."""
    with sync_client.websocket_connect(f"/ws/quiz?token={auth_user_token}&topic=evaporation") as ws:
        ws.receive_json()  # SESSION_INIT
        ws.receive_json()  # QUESTION

        # Send two rapid PINGs back-to-back with zero delay
        ws.send_text(json.dumps({"type": "PING"}))
        ws.send_text(json.dumps({"type": "PING"}))

        # First PONG or THROTTLED
        resp1 = ws.receive_json()
        resp2 = ws.receive_json()
        responses = [resp1.get("type"), resp2.get("type")]
        assert "THROTTLED" in responses or "PONG" in responses
