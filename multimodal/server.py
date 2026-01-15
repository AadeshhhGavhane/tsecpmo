# FastAPI Server for PDF Context Extraction (GROQ VERSION)
# POST a PDF file → Get markdown context back

import fitz  # PyMuPDF
import io
import os
import base64
from PIL import Image
from groq import Groq
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ---------------- CONFIG ----------------
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct"
# ----------------------------------------

client = Groq(api_key=GROQ_API_KEY)
app = FastAPI(title="PDF Context Extractor")


def extract_full_text_and_images(pdf_bytes: bytes):
    """Extract text and images from PDF bytes."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    full_text = []
    images = []

    for page_index in range(len(doc)):
        page = doc[page_index]

        # ---- COLLECT ALL TEXT ----
        text = page.get_text()
        if text.strip():
            full_text.append(f"\n--- PAGE {page_index + 1} ---\n{text}")

        # ---- COLLECT ALL IMAGES ----
        for img in page.get_images(full=True):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image = Image.open(io.BytesIO(image_bytes))
            images.append(image)

    full_text_str = "\n".join(full_text)
    return full_text_str, images


def encode_pil_image_to_base64(img):
    """Convert PIL image to base64 string."""
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_bytes = buffer.getvalue()
    return base64.b64encode(img_bytes).decode("utf-8")


def stack_images_vertically(images):
    """Combine all images into a single vertically stacked image."""
    if not images:
        return None
    
    # Convert all images to RGB mode for consistency
    rgb_images = []
    for img in images:
        if img.mode != 'RGB':
            img = img.convert('RGB')
        rgb_images.append(img)
    
    # Calculate total height and max width
    max_width = max(img.width for img in rgb_images)
    total_height = sum(img.height for img in rgb_images)
    
    # Create a new blank image
    stacked_image = Image.new('RGB', (max_width, total_height), (255, 255, 255))
    
    # Paste each image vertically
    y_offset = 0
    for img in rgb_images:
        # Center the image horizontally if it's narrower than max_width
        x_offset = (max_width - img.width) // 2
        stacked_image.paste(img, (x_offset, y_offset))
        y_offset += img.height
    
    return stacked_image


def analyze_entire_document(text_content: str, images: list) -> str:
    """Send text and images to Groq for analysis."""
    prompt = f"""
You are reconstructing a COMPLETE PDF DOCUMENT into a FULL, LONG-FORM, EXPLANATORY TEXT.

You are given:
1) THE ENTIRE TEXT extracted from the PDF
2) ALL TABLES present in the document (either as text or images)
3) ALL IMAGES, CHARTS, GRAPHS, FIGURES, AND DIAGRAMS from the PDF

YOUR ABSOLUTE OBJECTIVE:
Create a SINGLE FINAL TEXT FILE that COMPLETELY REPLACES THE PDF.
A reader must gain the SAME understanding as reading the original document in full.

══════════════════════════════════════
‼️ ZERO-COMPRESSION RULE (CRITICAL) ‼️
══════════════════════════════════════
- DO NOT summarize
- DO NOT shorten explanations
- DO NOT reduce multi-paragraph ideas into bullet points
- DO NOT remove examples, numbers, assumptions, or explanations
- DO NOT trade depth in one area for depth in another
- EVERY modality (text, tables, charts, images) must be explained IN FULL

If a section is long in the document, it must be long in your output.
If a section is detailed, your explanation must be detailed.

══════════════════════════════════════
TEXT ANALYSIS (MANDATORY — FULL DEPTH)
══════════════════════════════════════
- Read the FULL document text from beginning to end
- Reconstruct EVERY section, subsection, and logical block
- Preserve:
  - Definitions
  - Background context
  - Step-by-step processes
  - Arguments and justifications
  - Examples and case descriptions
- Expand dense or technical text into clear explanatory paragraphs
- Maintain the original document's flow and structure

══════════════════════════════════════
TABLE ANALYSIS (MANDATORY — FULL DEPTH)
══════════════════════════════════════
For EVERY table:
- Identify what the table represents and why it exists
- Explain each column and each row in words
- Describe relationships, comparisons, patterns, and anomalies
- Translate numeric data into meaningful interpretation
- If the table supports a claim, restate the claim and show how the table proves it
- NO table is allowed to be skipped or lightly summarized

══════════════════════════════════════
CHART / GRAPH ANALYSIS (MANDATORY — FULL DEPTH)
══════════════════════════════════════
For EVERY chart or graph:
- Identify:
  - Chart type
  - X-axis and Y-axis labels and units
  - Legends and categories
- Describe:
  - Trends (increase, decrease, cycles, stability)
  - Comparisons between groups
  - Peaks, lows, and outliers
- Explain WHAT the chart demonstrates and WHY it matters
- Connect the chart explicitly to the relevant text section

══════════════════════════════════════
IMAGE / DIAGRAM ANALYSIS (MANDATORY — FULL DEPTH)
══════════════════════════════════════
For EVERY meaningful image or diagram:
- Describe all visible components
- Explain relationships, flows, hierarchies, or structures
- If it illustrates a process or system, walk through it step by step
- If it reinforces text, clearly restate that connection
- If it introduces new information, fully integrate it into the explanation

══════════════════════════════════════
INTEGRATION RULES (STRICT)
══════════════════════════════════════
- NOTHING gets lost when merging text, tables, and visuals
- References like "see Figure 3" must be resolved explicitly
- Maintain continuity and logical progression
- The output must read like a rewritten, expanded version of the PDF

══════════════════════════════════════
FINAL OUTPUT FORMAT (MANDATORY)
══════════════════════════════════════
## 1. Complete Document Reconstruction
- Long-form section-by-section explanation of the entire document

## 2. Exhaustive Table-by-Table Explanation
- Dedicated detailed explanation for every table

## 3. Exhaustive Chart and Figure Explanation
- Dedicated detailed explanation for every chart, graph, image, and diagram

## 4. Unified Full Context Narrative
- A continuous, readable explanation of the entire document from start to finish

QUALITY REQUIREMENTS:
- MULTIPLE PARAGRAPHS per section
- No shallow summaries
- No single-line insights
- Assume the reader NEVER saw the PDF

DO NOT BEGIN WRITING UNTIL YOU HAVE ANALYZED ALL TEXT, TABLES, CHARTS, AND IMAGES COMPLETELY.

DOCUMENT TEXT:
{text_content}
"""

    # Build content array with text and single stacked image
    content = [{"type": "text", "text": prompt}]

    # Stack all images into one and send only that
    if images:
        stacked_img = stack_images_vertically(images)
        if stacked_img:
            # Save combined image locally
            stacked_img.save("combined_images.png")
            print("Combined image saved to combined_images.png")
            
            img_base64 = encode_pil_image_to_base64(stacked_img)
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{img_base64}"
                }
            })

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": content
            }
        ],
        model=MODEL_NAME,
    )

    return chat_completion.choices[0].message.content


@app.post("/")
async def extract_context(file: UploadFile = File(...)):
    """
    Upload a PDF file and get back a markdown file with extracted context.
    
    Usage:
        curl -X POST http://localhost:8000 -F "file=@test.pdf" --output output.md
    """
    # Read uploaded PDF
    pdf_bytes = await file.read()

    # Extract text and images
    text_content, images = extract_full_text_and_images(pdf_bytes)

    # Analyze with Groq
    markdown_content = analyze_entire_document(text_content, images)

    # Return as markdown file
    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=context.md"
        }
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
