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
        <div className="landing-buttons">
          <Link to="/write" className="enter-button">
            Start Writing
          </Link>
          <Link to="/gallery" className="enter-button gallery-button">
            View Gallery
          </Link>
        </div>
      </div>
    </div>
  );
};

// Gallery Page Component
const GalleryPage = () => {
  const [drawings, setDrawings] = useState([]);
  const [isNewDrawingDialogOpen, setIsNewDrawingDialogOpen] = useState(false);

  useEffect(() => {
    const loadDrawings = () => {
      const savedDrawings = JSON.parse(localStorage.getItem('drawings') || '[]');
      setDrawings(savedDrawings);
    };

    // Load initial drawings
    loadDrawings();

    // Add storage event listener
    window.addEventListener('storage', loadDrawings);

    // Cleanup
    return () => {
      window.removeEventListener('storage', loadDrawings);
    };
  }, []);

  const deleteDrawing = (index) => {
    const newDrawings = drawings.filter((_, i) => i !== index);
    localStorage.setItem('drawings', JSON.stringify(newDrawings));
    setDrawings(newDrawings);
  };

  const openDrawing = (dataUrl, index) => {
    localStorage.setItem('currentDrawing', dataUrl);
    localStorage.setItem('editingIndex', index.toString());
    window.location.href = '/write';
  };

  const handleNewDrawing = (type, imageData = null) => {
    setIsNewDrawingDialogOpen(false);
    if (type === 'image' && imageData) {
      localStorage.setItem('backgroundImage', imageData);
    }
    window.location.href = '/write';
  };

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <h1>Your Drawings</h1>
        <div className="gallery-actions">
          <button
            onClick={() => setIsNewDrawingDialogOpen(true)}
            className="nav-button new-drawing-button"
          >
            <span className="button-icon">✨</span>
            New Drawing
          </button>
          <Link to="/" className="nav-button home-button">
            <span className="button-icon">🏠</span>
            Home
          </Link>
        </div>
      </div>
      <div className="gallery-grid">
        {drawings.length === 0 ? (
          <p className="no-drawings">No drawings yet. Start creating!</p>
        ) : (
          drawings.map((drawing, index) => (
            <div key={index} className="drawing-card">
              <img
                src={drawing.dataUrl}
                alt={drawing.name || `Drawing ${index + 1}`}
                onClick={() => openDrawing(drawing.dataUrl, index)}
                style={{ cursor: 'pointer' }}
              />
              <div className="drawing-info">
                <div className="drawing-details">
                  <h3 className="drawing-name">{drawing.name || 'Untitled'}</h3>
                  <span>{new Date(drawing.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="drawing-actions">
                  <button
                    onClick={() => openDrawing(drawing.dataUrl, index)}
                    className="edit-button"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteDrawing(index)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <NewDrawingDialog
        isOpen={isNewDrawingDialogOpen}
        onClose={() => setIsNewDrawingDialogOpen(false)}
        onSelectType={handleNewDrawing}
      />
    </div>
  );
};

// Add this new component for the naming dialog
const NameDialog = ({ isOpen, onClose, onSave, defaultValue = '', existingNames = [] }) => {
  const [name, setName] = useState(defaultValue);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    // Generate unique name if duplicate exists
    let finalName = name.trim();
    let counter = 1;
    while (existingNames.includes(finalName)) {
      finalName = `${name.trim()} (${counter})`;
      counter++;
    }

    onSave(finalName);
  };

  const handleCancel = () => {
    setName(defaultValue);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Name Your Drawing</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Enter drawing name"
          className="dialog-input"
          autoFocus
        />
        {error && <p className="dialog-error">{error}</p>}
        <div className="dialog-buttons">
          <button onClick={handleSave} className="dialog-button save">
            Save
          </button>
          <button onClick={handleCancel} className="dialog-button cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// New component for choosing drawing type
const NewDrawingDialog = ({ isOpen, onClose, onSelectType }) => {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onSelectType('image', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Create New Drawing</h2>
        <div className="dialog-content">
          <button
            onClick={() => onSelectType('whiteboard')}
            className="dialog-button option-button"
          >
            <span className="button-icon">✏️</span>
            Blank Whiteboard
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="dialog-button option-button"
          >
            <span className="button-icon">🖼️</span>
            Upload Image
          </button>
        </div>
        <div className="dialog-buttons">
          <button onClick={onClose} className="dialog-button cancel">
            Cancel
          </button>
        </div>
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
  const [isNaming, setIsNaming] = useState(false);
  const [drawingName, setDrawingName] = useState('');
  const modeRef = useRef('none'); // 'none', 'draw', or 'erase'
  const FINGER_THRESHOLD = 0.05; // Reduced from 0.1 to 0.05
  const MODE_NEUTRAL_TIMEOUT = 100; // Time in ms required in neutral state
  const lastModeChangeRef = useRef(0);
  const neutralTimeoutRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Check for background image
    const backgroundImage = localStorage.getItem('backgroundImage');
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => {
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate dimensions to maintain aspect ratio
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;

        context.drawImage(
          img,
          x,
          y,
          img.width * scale,
          img.height * scale
        );
        localStorage.removeItem('backgroundImage');
      };
      img.src = backgroundImage;
    } else {
      // Check for saved drawing to restore
      const savedDrawing = localStorage.getItem('currentDrawing');
      const editingIndex = localStorage.getItem('editingIndex');

      // Load existing drawing name if editing
      if (editingIndex !== null && editingIndex !== 'null') {
        const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
        const index = parseInt(editingIndex);
        if (index >= 0 && index < drawings.length) {
          setDrawingName(drawings[index].name || '');
        }
      }

      if (savedDrawing) {
        const img = new Image();
        img.onload = () => {
          // Clear canvas first
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          // Draw the saved image
          context.drawImage(img, 0, 0);
          localStorage.removeItem('currentDrawing');
        };
        img.src = savedDrawing;
      } else {
        // Initial canvas setup
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    context.strokeStyle = 'black';
    context.lineWidth = 8;
    context.lineCap = 'round';
    context.lineJoin = 'round';

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

      // Get all landmarks first
      const indexTip = hand[8];
      const middleTip = hand[12];
      const ringTip = hand[16];
      const pinkyTip = hand[20];

      const indexBase = hand[5];
      const middleBase = hand[9];
      const ringBase = hand[13];
      const pinkyBase = hand[17];

      // Calculate coordinates
      const x = (1 - indexTip.x) * canvas.width;
      const y = indexTip.y * canvas.height;

      // Apply simple smoothing
      const smoothedX = lastPosRef.current.x * 0.7 + x * 0.3;
      const smoothedY = lastPosRef.current.y * 0.7 + y * 0.3;
      lastPosRef.current = { x: smoothedX, y: smoothedY };

      // Then do gesture detection
      const isFingerCurled = (tip, base) => {
        // A finger is considered curled if its tip is below its base
        return tip.y > base.y;
      };

      const isFingerExtended = (tip, base) => {
        // A finger is considered extended if its tip is above its base by the threshold
        return (base.y - tip.y) > FINGER_THRESHOLD;
      };

      // Add a helper function to check if a finger is clearly curled
      const isFingerClearlyDown = (tip, base) => {
        return (tip.y - base.y) > FINGER_THRESHOLD;
      };

      // Update the gesture detection
      const isPointing =
        isFingerExtended(indexTip, indexBase) && // Index finger up
        !isFingerExtended(middleTip, middleBase) && // Other fingers not up
        !isFingerExtended(ringTip, ringBase) &&
        !isFingerExtended(pinkyTip, pinkyBase);

      // Make fist detection more reliable
      const isFist =
        isFingerClearlyDown(indexTip, indexBase) &&
        isFingerClearlyDown(middleTip, middleBase) &&
        isFingerClearlyDown(ringTip, ringBase) &&
        isFingerClearlyDown(pinkyTip, pinkyBase);

      // Determine the new mode with neutral state requirement
      let newMode = 'none';
      if (isFist) {
        newMode = 'erase';
      } else if (isPointing) {
        newMode = 'draw';
      }

      // Handle mode transitions
      const now = Date.now();
      if (newMode !== modeRef.current) {
        // If transitioning to a different active mode, require neutral state
        if (modeRef.current !== 'none' && newMode !== 'none') {
          newMode = 'none';
          lastModeChangeRef.current = now;
        }
        // If entering neutral state, start timeout
        else if (newMode === 'none') {
          lastModeChangeRef.current = now;
        }
        // If leaving neutral state, ensure minimum time has passed
        else if (now - lastModeChangeRef.current < MODE_NEUTRAL_TIMEOUT) {
          newMode = 'none';
        }
      }

      // Update cursor appearance based on mode
      if (cursorRef.current) {
        cursorRef.current.style.left = `${smoothedX}px`;
        cursorRef.current.style.top = `${smoothedY}px`;

        switch (newMode) {
          case 'erase':
            cursorRef.current.style.backgroundColor = 'white';
            cursorRef.current.style.border = '2px solid red';
            cursorRef.current.style.width = '30px';
            cursorRef.current.style.height = '30px';
            break;
          case 'draw':
            cursorRef.current.style.backgroundColor = 'green';
            cursorRef.current.style.border = 'none';
            cursorRef.current.style.width = '20px';
            cursorRef.current.style.height = '20px';
            break;
          default:
            cursorRef.current.style.backgroundColor = 'red';
            cursorRef.current.style.border = 'none';
            cursorRef.current.style.width = '20px';
            cursorRef.current.style.height = '20px';
        }

        // Add debug info for fist detection
        const fingerDownStates = [
          isFingerClearlyDown(indexTip, indexBase),
          isFingerClearlyDown(middleTip, middleBase),
          isFingerClearlyDown(ringTip, ringBase),
          isFingerClearlyDown(pinkyTip, pinkyBase)
        ];
        cursorRef.current.setAttribute('data-gesture',
          `Mode: ${newMode}, Fist: ${isFist}, Down: ${fingerDownStates.map(f => f ? '↓' : '-').join(' ')}`
        );
      }

      // Drawing/Erasing logic
      if (newMode !== 'none') {
        if (!isDrawingRef.current) {
          context.beginPath();
          context.moveTo(smoothedX, smoothedY);
          isDrawingRef.current = true;
        }

        if (newMode === 'erase') {
          context.globalCompositeOperation = 'destination-out';
          context.lineWidth = 30;
        } else {
          context.globalCompositeOperation = 'source-over';
          context.lineWidth = 8;
        }

        context.lineTo(smoothedX, smoothedY);
        context.stroke();
      } else {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          context.closePath();
        }
      }

      modeRef.current = newMode;

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
      // Reset canvas context properties
      if (canvasCtxRef.current) {
        canvasCtxRef.current.globalCompositeOperation = 'source-over';
      }
    };
  }, []);

  const clearCanvas = () => {
    const ctx = canvasCtxRef.current;
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 8;
      isDrawingRef.current = false;
    }
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, canvas.width, canvas.height);
      tempCtx.drawImage(canvas, 0, 0);
      const dataUrl = tempCanvas.toDataURL('image/png');

      // If we already have a name, save directly and close
      if (drawingName) {
        saveAndClose(dataUrl, drawingName);
      } else {
        // No name yet, prompt for one
        localStorage.setItem('tempDrawing', dataUrl);
        setIsNaming(true);
        localStorage.setItem('isSaving', 'true');
      }
    }
  };

  const openNameDialog = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const editingIndex = localStorage.getItem('editingIndex');
      const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');

      if (editingIndex !== null && editingIndex !== 'null') {
        const index = parseInt(editingIndex);
        if (index >= 0 && index < drawings.length) {
          setDrawingName(drawings[index].name || '');
        }
      }

      // Store current canvas state
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, canvas.width, canvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      localStorage.setItem('tempDrawing', tempCanvas.toDataURL('image/png'));
      setIsNaming(true);
      localStorage.removeItem('isSaving'); // Clear save flag
    }
  };

  const saveAndClose = (dataUrl, name) => {
    const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
    const editingIndex = localStorage.getItem('editingIndex');

    if (editingIndex !== null && editingIndex !== 'null') {
      const index = parseInt(editingIndex);
      if (index >= 0 && index < drawings.length) {
        drawings[index] = {
          dataUrl,
          name,
          timestamp: Date.now()
        };
      }
    } else {
      drawings.push({
        dataUrl,
        name,
        timestamp: Date.now()
      });
    }

    localStorage.setItem('drawings', JSON.stringify(drawings));
    localStorage.removeItem('editingIndex');
    localStorage.removeItem('tempDrawing');

    // Dispatch storage event to notify other components
    window.dispatchEvent(new Event('storage'));

    window.location.href = '/gallery';
  };

  const handleNameSave = (name) => {
    setIsNaming(false); // Close the dialog
    const isSaving = localStorage.getItem('isSaving');
    const dataUrl = localStorage.getItem('tempDrawing');

    if (isSaving) {
      // If we're saving, save and close
      saveAndClose(dataUrl, name);
      localStorage.removeItem('isSaving');
    } else {
      // If we're just naming, update the name and stay on the page
      setDrawingName(name);
    }
  };

  return (
    <div className="writing-platform">
      <div className="controls-container">
        <button onClick={clearCanvas} className="control-button clear-button">
          <span className="button-icon">🗑️</span>
          Clear Canvas
        </button>
        <button onClick={openNameDialog} className="control-button name-button">
          <span className="button-icon">✏️</span>
          {drawingName ? 'Rename' : 'Name Drawing'}
        </button>
        <button onClick={saveDrawing} className="control-button save-button">
          <span className="button-icon">💾</span>
          Save Drawing
        </button>
        <Link to="/" className="control-button return-button">
          <span className="button-icon">🏠</span>
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
      <NameDialog
        isOpen={isNaming}
        onClose={() => setIsNaming(false)}
        onSave={handleNameSave}
        defaultValue={drawingName}
        existingNames={JSON.parse(localStorage.getItem('drawings') || '[]').map(d => d.name)}
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/write" element={<WritingPlatform />} />
        <Route path="/gallery" element={<GalleryPage />} />
      </Routes>
    </Router>
  );
}

export default App;
