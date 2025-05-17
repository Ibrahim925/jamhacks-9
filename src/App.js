import React, { useRef, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './App.css';

// Landing Page Component
const LandingPage = () => {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1>Welcome to AirScribe</h1>
        <p>Write in the air using hand gestures</p>
        <Link to="/write" className="enter-button">
          Start Writing
        </Link>
      </div>
    </div>
  );
};

// Writing Platform Component
const WritingPlatform = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const isDrawingRef = useRef(false);
  const canvasCtxRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Preserve existing canvas content
    const existingImageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Set drawing style
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'black';
    context.lineWidth = 8;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Restore existing canvas content
    context.putImageData(existingImageData, 0, 0);

    canvasCtxRef.current = context;

    async function initializeHandLandmarker() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
    }

    async function predictWebcam() {
      if (!webcamRef.current?.video || !handLandmarkerRef.current) {
        animationFrameRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      const video = webcamRef.current.video;
      if (video.readyState !== 4) {
        animationFrameRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      const startTimeMs = performance.now();
      const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);

      if (!results.landmarks || results.landmarks.length === 0) {
        animationFrameRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      const hand = results.landmarks[0];
      const indexFinger = hand[8];
      const thumb = hand[4];

      // Convert normalized coordinates to pixel coordinates
      const x = (1 - indexFinger.x) * canvas.width;
      const y = indexFinger.y * canvas.height;

      // Apply simple smoothing
      const smoothedX = lastPosRef.current.x * 0.7 + x * 0.3;
      const smoothedY = lastPosRef.current.y * 0.7 + y * 0.3;
      lastPosRef.current = { x: smoothedX, y: smoothedY };

      // Update cursor position
      if (cursorRef.current) {
        cursorRef.current.style.left = `${smoothedX}px`;
        cursorRef.current.style.top = `${smoothedY}px`;

        // Calculate distance for pinch detection
        const distance = Math.sqrt(
          Math.pow(thumb.x - indexFinger.x, 2) +
          Math.pow(thumb.y - indexFinger.y, 2)
        );

        const isPinched = distance < 0.08;
        cursorRef.current.style.backgroundColor = isPinched ? 'green' : 'red';

        // Drawing logic
        if (isPinched) {
          if (!isDrawingRef.current) {
            context.beginPath();
            context.moveTo(smoothedX, smoothedY);
            isDrawingRef.current = true;
          } else {
            context.lineTo(smoothedX, smoothedY);
            context.stroke();
          }
        } else if (isDrawingRef.current) {
          isDrawingRef.current = false;
          context.closePath();
        }
      }

      animationFrameRef.current = requestAnimationFrame(predictWebcam);
    }

    // Initialize and start detection
    const startDetection = async () => {
      await initializeHandLandmarker();
      predictWebcam();
    };

    startDetection();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const clearCanvas = () => {
    const ctx = canvasCtxRef.current;
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 8;
      isDrawingRef.current = false;
    }
  };

  return (
    <div className="writing-platform">
      <div className="whiteboard-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="whiteboard"
        />
        <div ref={cursorRef} className="cursor" />
        <Webcam
          ref={webcamRef}
          className="webcam"
          mirrored={true}
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user",
          }}
          width={800}
          height={600}
        />
        <div className="button-container">
          <button
            onClick={clearCanvas}
            style={{
              padding: '12px 28px',
              borderRadius: '30px',
              background: 'linear-gradient(90deg, #4a90e2 0%, #357abd 100%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              border: 'none',
              boxShadow: '0 4px 16px rgba(74, 144, 226, 0.15)',
              cursor: 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #357abd 0%, #4a90e2 100%)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(53, 122, 189, 0.18)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #4a90e2 0%, #357abd 100%)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(74, 144, 226, 0.15)';
            }}
          >
            Clear Canvas
          </button>
          <Link
            to="/"
            style={{
              padding: '12px 28px',
              borderRadius: '30px',
              background: 'linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              border: 'none',
              boxShadow: '0 4px 16px rgba(46, 204, 113, 0.15)',
              cursor: 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s',
              textDecoration: 'none',
              display: 'inline-block',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(39, 174, 96, 0.18)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(46, 204, 113, 0.15)';
            }}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/write" element={<WritingPlatform />} />
      </Routes>
    </Router>
  );
}

export default App;
