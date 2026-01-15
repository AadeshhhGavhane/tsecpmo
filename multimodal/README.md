# PDF Context Extractor

A FastAPI server that extracts comprehensive context from PDF documents using Groq's LLaMA 4 Scout model. Upload a PDF and get back a detailed markdown reconstruction of the entire document.

## Features

- **Full PDF Text Extraction** — Extracts all text from every page
- **Image Extraction** — Captures all charts, graphs, diagrams, and figures
- **Vertical Image Stacking** — Combines all images into a single stacked image for efficient API usage
- **AI-Powered Analysis** — Uses Groq's LLaMA 4 Scout model for comprehensive document reconstruction
- **Markdown Output** — Returns a well-structured markdown file

## Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd context-fetching
   ```

2. **Create virtual environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   
   Create a `.env` file:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

## Usage

1. **Start the server**
   ```bash
   python server.py
   ```
   Server runs on `http://localhost:8000`

2. **Upload a PDF**
   ```bash
   curl -X POST http://localhost:8000 -F "file=@your_document.pdf" --output output.md
   ```

3. **With ngrok (for remote access)**
   ```bash
   curl -X POST https://your-ngrok-url.ngrok-free.app -F "file=@your_document.pdf" --output output.md
   ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Upload PDF, get markdown context |
| GET | `/health` | Health check |

## Output Structure

The generated markdown includes:

1. **Complete Document Reconstruction** — Section-by-section explanation
2. **Exhaustive Table-by-Table Explanation** — Detailed breakdown of all tables
3. **Exhaustive Chart and Figure Explanation** — Analysis of all visuals
4. **Unified Full Context Narrative** — Continuous readable explanation

## Requirements

- Python 3.10+
- Groq API Key

## Tech Stack

- **FastAPI** — Web framework
- **PyMuPDF (fitz)** — PDF processing
- **Pillow** — Image handling
- **Groq** — LLM API
- **python-dotenv** — Environment variables

## License

MIT