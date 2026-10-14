"""Tests for NCERT Class 9 Grounded RAG, Citations, and Out-of-Curriculum Boundaries."""

import pytest
from httpx import AsyncClient

from app.rag.generator import generate_rag_response
from app.rag.retriever import retrieve_ncert_chunks


def test_rag_retrieval_frictional_force():
    """Retrieval for frictional force must return NCERT Chapter 8 chunk with valid citation."""
    chunks, latency_ms = retrieve_ncert_chunks("what is the frictional force", top_k=3)
    assert len(chunks) > 0
    top = chunks[0]
    assert "Force" in top["chapter"] or "8" in str(top.get("chapter_num", ""))
    assert top["page"] > 0
    assert "NCERT Class 9" in top["citation"]


def test_rag_retrieval_powerhouse_of_cell():
    """Retrieval for powerhouse of the cell must return NCERT Chapter 5 (Cell) chunk."""
    chunks, latency_ms = retrieve_ncert_chunks("powerhouse of the cell mitochondria", top_k=3)
    assert len(chunks) > 0
    top = chunks[0]
    assert "Cell" in top["chapter"] or "Life" in top["chapter"] or "5" in str(top.get("chapter_num", ""))
    assert "NCERT Class 9" in top["citation"]


def test_rag_generator_grounded_response_frictional_force():
    """Generator must produce citation-grounded text with [Citation: ...] for frictional force."""
    res = generate_rag_response("what is the frictional force", language="en")
    assert res["is_not_found"] is False
    assert "[Citation:" in res["final_response_odia"]
    assert "NCERT Class 9" in res["final_response_odia"]
    assert res["provenance"]["source"] == "server-rag"
    assert res["provenance"]["page"] > 0
    assert res["groundedness_score"] > 0.0


def test_rag_generator_out_of_curriculum_gdp():
    """Queries outside Class 9 Science curriculum must return is_not_found=True and boundary citation."""
    res = generate_rag_response("what is India's GDP this year?", language="en")
    assert res["is_not_found"] is True
    assert "not covered in the CBSE NCERT Class 9" in res["final_response_odia"]
    assert res["provenance"]["chapter"] == "Not in Class 9 Textbook"


@pytest.mark.asyncio
async def test_api_interact_frictional_force_provenance(async_client: AsyncClient):
    """POST /api/agent/interact with frictional force returns real citation and provenance."""
    reg = await async_client.post(
        "/api/auth/register",
        json={
            "username": "rag_student_1",
            "email": "rag1@example.com",
            "password": "SecurePassword123!",
        },
    )
    token = reg.json()["access_token"]

    resp = await async_client.post(
        "/api/agent/interact",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "what is the frictional force", "language": "en"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_not_found"] is False
    assert data["citation"] is not None
    assert "NCERT Class 9" in data["citation"]
    assert data["provenance"] is not None
    assert data["provenance"]["source"] == "server-rag"
    assert data["provenance"]["page"] > 0
    assert "[Citation:" in data["final_response_odia"]


@pytest.mark.asyncio
async def test_api_interact_out_of_curriculum_gdp_boundary(async_client: AsyncClient):
    """POST /api/agent/interact with India's GDP returns honest boundary and is_not_found=True."""
    reg = await async_client.post(
        "/api/auth/register",
        json={
            "username": "rag_student_2",
            "email": "rag2@example.com",
            "password": "SecurePassword123!",
        },
    )
    token = reg.json()["access_token"]

    resp = await async_client.post(
        "/api/agent/interact",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "what is India's GDP?", "language": "en"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_not_found"] is True
    assert "not covered in the CBSE NCERT Class 9" in data["final_response_odia"]
