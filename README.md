# Project AETHER: AI-Driven Deliberation System
 
> **A Multimodal Multi-Agent System for Transparent AI Decision Making, styled as a Retro Pixel Courtroom.**

Project AETHER is a cutting-edge **Multimodal Multi-Agent Orchestration Platform** designed to analyze complex inputs including **PDFs and Markdown files**, which may contain **diagrams, charts, and images**, all fully understood by the system's vision capabilities.

By mimicking a courtroom setting with a **Supporter**, an **Opposer**, and a **Judge**, all coordinated by a central **Orchestrator**, AETHER breaks down bias, hallucinates less, and provides deeply reasoned verdicts.

## 🌟 Key Features

*   **Factor Extraction Agent:** A specialized agent that converts raw documents into structured debate topics, identifying key claims and evidence automatically.
*   **Multi-Agent Debate:** Autonomous agents (Support & Oppose) debate specific factors of a case in real-time, challenging each other's assumptions.
*   **Impartial Verdicts (Synthesis Agent):** A dedicated "Judge" agent (Gemini 3 Pro) reviews the entire transcript to render a final, unbiased decision with actionable recommendations.
*   **Multimodal Input:** Upload **PDFs**, Markdown, or Text files. (Powered by Vision LLMs).
*   **Real-Time Audio:** Listen to the debate unfold with dynamic Text-to-Speech (TTS) and synchronized captions.
*   **Gamified UI:** A "Phoenix Wright" inspired pixel-art interface makes complex analysis engaging and transparent.
*   **Downloadable Reports:** Export the full debate transcript and final verdict as a PDF.

## 🤖 The "AETHER" Agents (Orchestrated Intelligence)

At the heart of Project AETHER is a sophisticated **Orchestrator Agent** that manages a swarm of specialized sub-agents.

1.  **👑 Orchestrator Agent (The Conductor):** The central state machine that coordinates the entire debate. It manages the turn-taking logic, passes context between agents, and ensures the "courtroom drama" unfolds logically.
2.  **Factor Extraction Agent:** Scans the document to find the most critical points of contention.
3.  **Support Agent (Defense):** Argues FOR the proposal, highlighting strengths and opportunities.
4.  **Oppose Agent (Prosecution):** Argues AGAINST the proposal, finding risks, gaps, and weaknesses.
5.  **Synthesis Agent (The Judge):** Weighs both sides to deliver the final verdict and summary.

## 🏗️ System Architecture

The project consists of three main microservices:

1.  **Frontend (`/frontend`)**:
    *   Built with **React**, **Vite**, and **Tailwind CSS**.
    *   Features a custom Pixel Art design system (Beige/mahogany "Retro Court" theme).
    *   Communicates with the backend via **Socket.IO** for real-time updates.

2.  **Core Backend (`/backend`)**:
    *   **Node.js / Express** server.
    *   Orchestrates the debate logic using **OpenRouter** (Grok 4.1 Fast/ Gemini 3 Flash model).
    *   Manages the state of the debate (Factors, Turns, Synthesis).

3.  **Multimodal Service (`/multimodal`)**:
    *   **Python / FastAPI** server.
    *   Uses **Groq (Llama-4-Scout)** and **PyMuPDF** to convert PDF documents into analyzed markdown for the agents.

4.  **Landing Page (`/landing-page`)**:
    *   A promotional high-performance marketing site for the project.

## 🚀 Getting Started

To run the full system, you need to start all three services.

### Prerequisites
*   Node.js (v18+)
*   Python (v3.10+)
*   API Keys (OpenRouter, Groq, Google Gemini) set in respective `.env` files.

### 1. Start the Multimodal Server (PDF Processing)
```bash
cd multimodal
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python server.py
# Runs on http://localhost:8000
```

### 2. Start the Core Backend (Debate Logic)
```bash
cd backend
npm install
npm start
# Runs on http://localhost:3000
```

### 3. Start the Frontend (User Interface)
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## 🛠️ Tech Stack

*   **Frontend:** React 19, Tailwind CSS, Framer Motion, Socket.IO Client.
*   **Backend:** Node.js, Express, Socket.IO, LangChain (Concepts).
*   **AI Models:**
    *   *Debate Agents:* Grok 4.1 Fast (via OpenRouter) / Gemini 3 Flash.
    *   *Vision Analysis:* Llama-4-Scout (via Groq).
    *   *Synthesis:* Gemini 3 Pro (via Google GenAI).
    *   *Voice Engine:* Kokoro TTS (via dedicated API) - High-fidelity real-time speech.


## 📄 License
Proprietary - tsecpmo Team.
