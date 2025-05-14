# apps/api/agents/marketing/blog_post/main.py
from fastapi import APIRouter, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

router = APIRouter()

class BlogPostRequest(BaseModel):
    topic: str
    keywords: List[str]
    target_audience: str
    tone: Optional[str] = "professional"
    word_count: Optional[int] = 800
    include_images: Optional[bool] = False
    include_citations: Optional[bool] = False

@router.get("/")
async def blog_post_root():
    return {"agent": "blog_post", "message": "Blog Post agent is active"}

@router.get("/.well-known/agent.json")
async def get_blog_post_agent_discovery():
    return {
        "name": "Blog Post Writer Agent",
        "description": "Creates high-quality blog posts for marketing purposes.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Blog Post agent status."
            },
            {
                "path": "/write",
                "methods": ["POST"],
                "description": "Write a blog post based on provided parameters."
            },
            {
                "path": "/outline",
                "methods": ["POST"],
                "description": "Generate a blog post outline before full creation."
            }
        ]
    }

@router.post("/write")
async def write_post(request: BlogPostRequest):
    """
    Generate a complete blog post based on the provided parameters.
    """
    return {
        "status": "success",
        "message": "Blog post generation initiated",
        "post": {
            "title": f"Blog post about {request.topic}",
            "content": "This will be replaced with AI-generated content",
            "metadata": {
                "word_count": request.word_count,
                "keywords": request.keywords,
                "audience": request.target_audience
            }
        }
    }

@router.post("/outline")
async def create_outline(request: BlogPostRequest):
    """
    Generate a blog post outline only, for review before full creation.
    """
    return {
        "status": "success",
        "message": "Blog post outline generated",
        "outline": [
            "Introduction to the topic",
            "Main point 1",
            "Main point 2",
            "Main point 3",
            "Conclusion and call to action"
        ]
    } 