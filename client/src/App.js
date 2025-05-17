import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './App.css';

function App() {
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
    <div className="App">
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
        <button
          onClick={clearCanvas}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 3
          }}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
}

export default App;
