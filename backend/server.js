#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractFactors } from './agents/factor.js';
import { generateSupportTurn } from './agents/support.js';
import { generateOpposeTurn } from './agents/oppose.js';
import { synthesizeDebate } from './agents/synthesize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory job storage
const jobs = new Map();

// Configure multer for temporary file storage
const upload = multer({
  dest: path.join(__dirname, 'tmp'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));



// API endpoint to convert markdown to PDF
app.post('/api/convert-to-pdf', async (req, res) => {
  try {
    const { markdown } = req.body;
    if (!markdown) {
      return res.status(400).json({ error: 'Markdown content is required' });
    }

    console.log('Converting markdown to PDF via external API, length:', markdown.length);

    // Send raw markdown content as Buffer with explicit length
    const pdfApiUrl = process.env.PDF_API_URL ;
    const bodyBuffer = Buffer.from(markdown, 'utf-8');
    
    // Log first few chars to debug
    console.log('Sending markdown start:', markdown.substring(0, 50));

    const response = await fetch(pdfApiUrl, {
      method: 'POST',
      body: bodyBuffer,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': bodyBuffer.length.toString(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`PDF API Error (${response.status}):`, errorText);
      throw new Error(`PDF API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="debate-transcript.pdf"');
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('PDF Conversion Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

// API endpoint to start analysis
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const roundsPerFactor = parseInt(req.body.turns || '2', 10);
  if (Number.isNaN(roundsPerFactor) || roundsPerFactor <= 0) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid number of turns' });
  }

  // Generate unique job ID
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store job info
  jobs.set(jobId, {
    status: 'running',
    filePath: req.file.path,
    roundsPerFactor,
    createdAt: new Date(),
  });

  // Start analysis in background
  runOrchestrationWithStreaming(jobId, req.file.path, roundsPerFactor)
    .catch((error) => {
      console.error('Analysis error:', error);
      io.to(jobId).emit('error', { message: error.message || String(error) });
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = error.message;
      }
    })
    .finally(() => {
      // Clean up temporary file after a delay
      setTimeout(() => {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }, 60000); // Delete after 1 minute
    });

  res.json({ jobId });
});

// API endpoint to get job status
app.get('/api/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Handle client joining a job room
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-job', (jobId) => {
    socket.join(jobId);
    console.log(`Client ${socket.id} joined job ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Wrapper function that streams orchestrator progress via WebSocket
async function runOrchestrationWithStreaming(jobId, filePath, roundsPerFactor) {
  const room = io.to(jobId);
  
  try {
    // Read report text
    const reportText = fs.readFileSync(filePath, 'utf-8');

    room.emit('status', { status: 'extracting-factors' });
    
    // Step 1: Extract factors
    const { factors } = await extractFactors(filePath);
    room.emit('factors-extracted', { factors });

    room.emit('status', { status: 'debating' });
    
    // Step 2: Run debates per factor
    const debates = [];

    for (const factor of factors) {
      room.emit('factor-started', { factorId: factor.id, factorName: factor.name });
      const debateHistory = [];

      for (let round = 1; round <= roundsPerFactor; round++) {
        // Generate support turn
        room.emit('status', { 
          status: 'generating-support', 
          factorId: factor.id, 
          round 
        });
        
        const supportTurn = await generateSupportTurn({
          reportText,
          factors,
          factor,
          debateHistory,
          turn: round,
        });
        debateHistory.push(supportTurn);
        
        room.emit('support-turn', {
          factorId: factor.id,
          factorName: factor.name,
          turn: round,
          data: supportTurn,
        });

        // Generate oppose turn
        room.emit('status', { 
          status: 'generating-oppose', 
          factorId: factor.id, 
          round 
        });
        
        const opposeTurn = await generateOpposeTurn({
          reportText,
          factors,
          factor,
          debateHistory,
          turn: round,
        });
        debateHistory.push(opposeTurn);
        
        room.emit('oppose-turn', {
          factorId: factor.id,
          factorName: factor.name,
          turn: round,
          data: opposeTurn,
        });
      }

      debates.push({ factor, turns: debateHistory });
      room.emit('factor-complete', { factorId: factor.id });
    }

    // Step 3: Synthesize
    room.emit('status', { status: 'synthesizing' });
    const synthesis = await synthesizeDebate({ reportText, factors, debates });
    
    room.emit('synthesis-complete', { synthesis });
    room.emit('status', { status: 'complete' });

    // Update job status
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'complete';
      job.result = { factors, debates, synthesis };
    }

  } catch (error) {
    room.emit('error', { message: error.message });
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error.message;
    }
    throw error;
  }
}

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

