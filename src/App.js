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
  const [isErasing, setIsErasing] = useState(false);

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

      // Fingertip landmarks
      const indexTip = hand[8];
      const middleTip = hand[12];
      const ringTip = hand[16];
      const pinkyTip = hand[20];

      // Middle joint landmarks
      const indexMid = hand[7];
      const middleMid = hand[11];
      const ringMid = hand[15];
      const pinkyMid = hand[19];

      // Base joint landmarks
      const indexBase = hand[5];
      const middleBase = hand[9];
      const ringBase = hand[13];
      const pinkyBase = hand[17];

      // For a fist, middle joints should be higher (smaller y) than both base and tips
      const isFingerCurled = (tip, mid, base) => {
        return mid.y < tip.y && mid.y < base.y;
      };

      const isFist =
        isFingerCurled(indexTip, indexMid, indexBase) &&
        isFingerCurled(middleTip, middleMid, middleBase) &&
        isFingerCurled(ringTip, ringMid, ringBase) &&
        isFingerCurled(pinkyTip, pinkyMid, pinkyBase);

      // Calculate pinch between thumb and index finger
      const thumb = hand[4];
      const pinchDistance = Math.sqrt(
        Math.pow(thumb.x - indexTip.x, 2) +
        Math.pow(thumb.y - indexTip.y, 2)
      );

      // Only allow pinch when not in fist position
      const isPinched = pinchDistance < 0.08 && !isFist;

      // Add debug visualization
      if (cursorRef.current) {
        const fingerStates = [
          isFingerCurled(indexTip, indexMid, indexBase),
          isFingerCurled(middleTip, middleMid, middleBase),
          isFingerCurled(ringTip, ringMid, ringBase),
          isFingerCurled(pinkyTip, pinkyMid, pinkyBase)
        ];
        cursorRef.current.setAttribute('data-gesture',
          `Fist: ${isFist}, Fingers: ${fingerStates.map(f => f ? '✓' : '✗').join(' ')}`
        );
      }

      // Convert normalized coordinates to pixel coordinates
      const x = (1 - indexTip.x) * canvas.width;
      const y = indexTip.y * canvas.height;

      // Apply simple smoothing
      const smoothedX = lastPosRef.current.x * 0.7 + x * 0.3;
      const smoothedY = lastPosRef.current.y * 0.7 + y * 0.3;
      lastPosRef.current = { x: smoothedX, y: smoothedY };

      // Update cursor position and appearance
      if (cursorRef.current) {
        cursorRef.current.style.left = `${smoothedX}px`;
        cursorRef.current.style.top = `${smoothedY}px`;

        // Update cursor appearance based on mode
        if (isFist) {
          cursorRef.current.style.backgroundColor = 'white';
          cursorRef.current.style.border = '2px solid red';
          cursorRef.current.style.width = '30px';
          cursorRef.current.style.height = '30px';
        } else {
          cursorRef.current.style.backgroundColor = isPinched ? 'green' : 'red';
          cursorRef.current.style.border = 'none';
          cursorRef.current.style.width = '20px';
          cursorRef.current.style.height = '20px';
        }

        // Drawing/Erasing logic
        if (isFist) {
          // Eraser mode
          if (!isDrawingRef.current) {
            context.beginPath();
            context.moveTo(smoothedX, smoothedY);
            isDrawingRef.current = true;
          } else {
            context.globalCompositeOperation = 'destination-out';
            context.lineWidth = 30;
            context.lineTo(smoothedX, smoothedY);
            context.stroke();
          }
        } else if (isPinched) {
          // Drawing mode
          if (!isDrawingRef.current) {
            context.beginPath();
            context.moveTo(smoothedX, smoothedY);
            isDrawingRef.current = true;
          } else {
            context.globalCompositeOperation = 'source-over';
            context.lineWidth = 8;
            context.lineTo(smoothedX, smoothedY);
            context.stroke();
          }
        } else {
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            context.closePath();
          }
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
      <div className="controls-container">
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
