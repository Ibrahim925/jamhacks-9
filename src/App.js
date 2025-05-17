import React, { useRef, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import OpenAI from 'openai';
import './App.css';

// Add this constant near the top of the file
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend
});

// Landing Page Component
const LandingPage = () => {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <div className="brand-header">
          <div className="logo-container">
            <span className="logo-icon">⚕️</span>
            <h1>AirScribe</h1>
          </div>
          <p className="tagline">
            Sterile documentation for the <span className="highlight">operating room</span>
          </p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🧤</span>
            <h3>Sterile Interface</h3>
            <p>Document without breaking sterility</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📋</span>
            <h3>Surgical Notes</h3>
            <p>Multi-page operative reports</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Quick Access</h3>
            <p>Instant gesture recognition</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔒</span>
            <h3>Secure Storage</h3>
            <p>Safe local data storage</p>
          </div>
        </div>
        <div className="landing-buttons">
          <Link to="/write" className="enter-button primary">
            <span>🧑‍⚕️ Start Documentation</span>
          </Link>
          <Link to="/gallery" className="enter-button secondary">
            <span>📑 View Records</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

// Gallery Page Component
const GalleryPage = () => {
  const [drawings, setDrawings] = useState(
    JSON.parse(localStorage.getItem('drawings') || '[]')
  );
  const [isNewDrawingDialogOpen, setIsNewDrawingDialogOpen] = useState(false);
  const [isNewRecordDialogOpen, setIsNewRecordDialogOpen] = useState(false);

  const handleEdit = (index) => {
    // Store the index of the drawing being edited
    localStorage.setItem('editingIndex', index);
    // Navigate to the writing platform
    window.location.href = '/write';
  };

  const handleDelete = (index) => {
    if (window.confirm('Are you sure you want to delete this operative record? This action cannot be undone.')) {
      const updatedDrawings = drawings.filter((_, i) => i !== index);
      localStorage.setItem('drawings', JSON.stringify(updatedDrawings));
      setDrawings(updatedDrawings);
    }
  };

  const openDrawing = (drawing, index) => {
    if (drawing.pages) {
      localStorage.setItem('currentPages', JSON.stringify(drawing.pages));
    } else {
      // Handle legacy single-page drawings
      localStorage.setItem('currentPages', JSON.stringify([drawing.dataUrl]));
    }
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

  const handleNewRecordSelect = (type, imageData = null) => {
    // Clear any existing editing state
    localStorage.removeItem('editingIndex');
    localStorage.removeItem('tempPages');

    if (type === 'image' && imageData) {
      localStorage.setItem('backgroundImage', imageData);
    }

    setIsNewRecordDialogOpen(false);
    window.location.href = '/write';
  };

  // Update the drawing card in GalleryPage to include a summary button and display
  const DrawingCard = ({ drawing, index, onOpen, onDelete, onGenerateSummary }) => {
    const [summary, setSummary] = useState(drawing.summary || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="drawing-card">
        <div className="drawing-image-container">
          <img
            src={drawing.pages ? drawing.pages[0] : drawing.dataUrl}
            alt={drawing.name || `Drawing ${index + 1}`}
            onClick={() => onOpen(drawing, index)}
          />
        </div>
        <div className="drawing-info">
          <div className="drawing-header">
            <h3 className="drawing-name">{drawing.name || 'Untitled'}</h3>
            <span className="drawing-date">
              {new Date(drawing.timestamp).toLocaleDateString()}
            </span>
          </div>
          {summary && (
            <div className={`drawing-summary ${isExpanded ? 'expanded' : ''}`}>
              <p>{summary}</p>
              <button
                className="expand-button"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Show Less' : 'Show More'}
              </button>
            </div>
          )}
          <div className="drawing-actions">
            <button
              onClick={() => onOpen(drawing, index)}
              className="action-button edit-button"
            >
              <span className="button-icon">✏️</span>
              Edit
            </button>
            <button
              onClick={() => onDelete(index)}
              className="action-button delete-button"
            >
              <span className="button-icon">🗑️</span>
              Delete
            </button>
            <button
              onClick={() => onGenerateSummary(drawing, index, setSummary)}
              className="action-button summary-button"
              disabled={isGenerating}
            >
              <span className="button-icon">🤖</span>
              {isGenerating ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add the generateSummary function to GalleryPage
  const generateSummary = async (drawing, index, setSummary) => {
    try {
      const pages = drawing.pages || [drawing.dataUrl];

      // Call OpenAI Vision API
      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Please analyze this handwritten note and provide a brief summary of its content. Focus on the main topics and key points."
            },
            ...pages.map(page => ({
              type: "input_image",
              image_url: page
            }))
          ],
        }],
      });

      const summary = response.output_text;

      // Update local storage
      const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
      drawings[index].summary = summary;
      localStorage.setItem('drawings', JSON.stringify(drawings));

      // Update state
      setSummary(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert(`Failed to generate summary: ${error.message}. Please try again later.`);
    }
  };

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <h1>Operative Records</h1>
        <div className="gallery-actions">
          <button
            onClick={() => setIsNewRecordDialogOpen(true)}
            className="nav-button new-drawing-button"
          >
            <span className="button-icon">📝</span>
            New Record
          </button>
        </div>
      </div>
      <div className="gallery-grid">
        {drawings.length === 0 ? (
          <div className="no-drawings">
            <span className="empty-icon">📋</span>
            <p>No operative records yet</p>
            <p className="empty-subtitle">Start documenting your first procedure</p>
          </div>
        ) : (
          drawings.map((drawing, index) => (
            <div key={drawing.timestamp} className="record-card">
              <div className="record-header">
                <h3 className="record-title">{drawing.name}</h3>
                <span className="record-date">
                  {new Date(drawing.timestamp).toLocaleDateString()}
                </span>
              </div>
              <div className="record-preview">
                <img src={drawing.pages[0]} alt="First page" />
                <span className="page-count">{drawing.pages.length} pages</span>
              </div>
              <div className="record-actions">
                <button
                  onClick={() => handleEdit(index)}
                  className="action-button edit-button"
                >
                  <span className="button-icon">✏️</span>
                  Edit Record
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="action-button delete-button"
                >
                  <span className="button-icon">🗑️</span>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <NewRecordDialog
        isOpen={isNewRecordDialogOpen}
        onClose={() => setIsNewRecordDialogOpen(false)}
        onSelectType={handleNewRecordSelect}
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

// Update the PageNavigation component to include the delete button
const PageNavigation = ({ currentPage, totalPages, onPageChange, onAddPage, onDeletePage }) => {
  return (
    <div className="page-navigation">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="page-nav-button"
      >
        <span className="button-icon">◀️</span>
      </button>
      <span className="page-indicator">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
        className="page-nav-button"
      >
        <span className="button-icon">▶️</span>
      </button>
      <button
        onClick={onAddPage}
        className="page-nav-button add-page"
      >
        <span className="button-icon">📄</span>
        Add Page
      </button>
      <button
        onClick={onDeletePage}
        className="page-nav-button delete-page"
        disabled={totalPages <= 1}
      >
        <span className="button-icon">🗑️</span>
        Delete Page
      </button>
    </div>
  );
};

// Move DeletePageDialog outside WritingPlatform component
const DeletePageDialog = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Delete Page</h2>
        <p className="dialog-message">Are you sure you want to delete this page? This action cannot be undone.</p>
        <div className="dialog-buttons">
          <button onClick={onConfirm} className="dialog-button delete-button">
            Delete Page
          </button>
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
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState([{
    dataUrl: null,
    canvas: null,
    strokes: [],
    backgroundUrl: null  // Store URL instead of Image object
  }]);
  const strokesRef = useRef([]); // Store all strokes
  const currentStrokeRef = useRef(null); // Store current stroke points
  const backgroundImageRef = useRef(null);
  const [lastClickTime, setLastClickTime] = useState(0);
  const CLICK_COOLDOWN = 500; // Minimum time between clicks in ms
  const [isDeletePageDialogOpen, setIsDeletePageDialogOpen] = useState(false);

  const deletePage = () => {
    if (pages.length <= 1) {
      alert("Cannot delete the last page");
      return;
    }

    // Save all pages except current one
    const newPages = [...pages];
    newPages.splice(currentPage, 1);
    setPages(newPages);

    // Switch to previous page if deleting last page, otherwise stay on current index
    const newPageIndex = currentPage >= newPages.length ? newPages.length - 1 : currentPage;

    // Clear current page data
    strokesRef.current = [];
    backgroundImageRef.current = null;

    // Update page state and redraw
    setCurrentPage(newPageIndex);
    canvasCtxRef.current?.redrawCanvas();
    setIsDeletePageDialogOpen(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Function to redraw canvas
    const redrawCanvas = () => {
      // Clear canvas
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Draw background image if exists
      if (backgroundImageRef.current) {
        const img = backgroundImageRef.current;
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
      }

      // Draw strokes on top
      strokesRef.current.forEach(stroke => {
        context.beginPath();
        context.strokeStyle = 'black';
        context.lineWidth = 8;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        const [firstPoint, ...points] = stroke;
        context.moveTo(firstPoint.x, firstPoint.y);
        points.forEach(point => {
          context.lineTo(point.x, point.y);
        });
        context.stroke();
      });
    };

    // Function to check if point is near a stroke
    const isPointNearStroke = (x, y, stroke, threshold = 20) => {
      for (let i = 1; i < stroke.length; i++) {
        const p1 = stroke[i - 1];
        const p2 = stroke[i];

        // Calculate distance from point to line segment
        const A = x - p1.x;
        const B = y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;

        if (len_sq !== 0) param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
          xx = p1.x;
          yy = p1.y;
        } else if (param > 1) {
          xx = p2.x;
          yy = p2.y;
        } else {
          xx = p1.x + param * C;
          yy = p1.y + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < threshold) {
          return true;
        }
      }
      return false;
    };

    // Load background image if exists
    const backgroundImage = localStorage.getItem('backgroundImage');
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        redrawCanvas();
        localStorage.removeItem('backgroundImage');
      };
      img.src = backgroundImage;
    }

    // Make redrawCanvas and isPointNearStroke available to other functions
    canvasCtxRef.current = {
      ...context,
      redrawCanvas,
      isPointNearStroke
    };

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
      const x = (1 - indexTip.x) * window.innerWidth;
      const y = indexTip.y * window.innerHeight;

      // Remove smoothing completely
      lastPosRef.current = { x, y };

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
        cursorRef.current.style.left = `${x}px`;
        cursorRef.current.style.top = `${y}px`;

        const isOverButton = isPointingAtButton(x, y);

        switch (newMode) {
          case 'erase':
            cursorRef.current.style.backgroundColor = 'white';
            cursorRef.current.style.border = '2px solid red';
            cursorRef.current.style.width = '30px';
            cursorRef.current.style.height = '30px';
            break;
          case 'draw':
            if (isOverButton && !isPointInCanvas(x, y)) {
              cursorRef.current.style.backgroundColor = '#10b981';
              cursorRef.current.style.transform = 'translate(-50%, -50%) scale(1.2)';
            } else {
              cursorRef.current.style.backgroundColor = 'green';
              cursorRef.current.style.transform = 'translate(-50%, -50%)';
            }
            cursorRef.current.style.border = 'none';
            cursorRef.current.style.width = '20px';
            cursorRef.current.style.height = '20px';
            break;
          default:
            cursorRef.current.style.backgroundColor = 'red';
            cursorRef.current.style.border = 'none';
            cursorRef.current.style.width = '20px';
            cursorRef.current.style.height = '20px';
            cursorRef.current.style.transform = 'translate(-50%, -50%)';
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
          // Initialize stroke array when starting to draw
          currentStrokeRef.current = [];
          isDrawingRef.current = true;
        }

        if (isPointInCanvas(x, y)) {
          if (newMode === 'erase') {
            // Check if eraser touches any stroke
            strokesRef.current = strokesRef.current.filter(stroke =>
              !canvasCtxRef.current.isPointNearStroke(x - canvas.getBoundingClientRect().left, y - canvas.getBoundingClientRect().top, stroke)
            );
            canvasCtxRef.current.redrawCanvas();
          } else if (newMode === 'draw') {
            // Normal drawing - adjust coordinates relative to canvas
            const rect = canvas.getBoundingClientRect();
            const canvasX = x - rect.left;
            const canvasY = y - rect.top;

            // Ensure currentStrokeRef.current exists before pushing
            if (!currentStrokeRef.current) {
              currentStrokeRef.current = [];
            }

            currentStrokeRef.current.push({ x: canvasX, y: canvasY });

            context.beginPath();
            context.strokeStyle = 'black';
            context.lineWidth = 8;
            context.lineCap = 'round';
            context.lineJoin = 'round';

            if (currentStrokeRef.current.length > 1) {
              const [prevPoint, currentPoint] = currentStrokeRef.current.slice(-2);
              context.moveTo(prevPoint.x, prevPoint.y);
              context.lineTo(currentPoint.x, currentPoint.y);
              context.stroke();
            }
          }
        }

        // Add this after the mode detection but before the drawing logic
        if (newMode === 'draw') {
          const now = Date.now();
          const button = isPointingAtButton(x, y);
          if (button && !isPointInCanvas(x, y)) {
            button.dataset.lastClick = now.toString();
            button.classList.add('in-cooldown');
            setTimeout(() => {
              button.classList.remove('in-cooldown');
            }, CLICK_COOLDOWN);

            setLastClickTime(now);
            if (button.tagName.toLowerCase() === 'a') {
              // Handle Link component click
              button.click();
              window.location.href = button.href;
            } else {
              // Handle normal button click
              button.click();
            }
            newMode = 'none';
          }
        }
      } else {
        if (isDrawingRef.current) {
          if (currentStrokeRef.current?.length > 1) {
            strokesRef.current.push([...currentStrokeRef.current]);
          }
          currentStrokeRef.current = null;
          isDrawingRef.current = false;
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

  useEffect(() => {
    // Near the start of the useEffect
    const loadExistingDrawing = () => {
      const editingIndex = localStorage.getItem('editingIndex');
      if (editingIndex !== null && editingIndex !== 'null') {
        const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
        const index = parseInt(editingIndex);
        if (index >= 0 && index < drawings.length) {
          const drawing = drawings[index];
          setDrawingName(drawing.name || '');

          // Set up pages with proper data structure
          const loadedPages = drawing.pages.map((dataUrl, i) => ({
            dataUrl,
            canvas: null,
            strokes: [],
            backgroundUrl: dataUrl // Store the dataUrl as backgroundUrl for each page
          }));
          setPages(loadedPages);

          // Load first page
          if (loadedPages[0].backgroundUrl) {
            const img = new Image();
            img.onload = () => {
              backgroundImageRef.current = img;
              canvasCtxRef.current.redrawCanvas();
            };
            img.src = loadedPages[0].backgroundUrl;
          }
        }
      }
    };

    // Call after setting up canvas
    loadExistingDrawing();
  }, []);

  const clearCanvas = () => {
    strokesRef.current = []; // Only clear strokes
    canvasCtxRef.current?.redrawCanvas(); // Redraw with background but no strokes
  };

  const switchPage = (pageIndex) => {
    // Validate pageIndex
    if (pageIndex < 0 || pageIndex >= pages.length) {
      console.error('Invalid page index:', pageIndex);
      return;
    }

    // Save current page state before switching
    const currentPages = [...pages];
    currentPages[currentPage] = {
      dataUrl: canvasRef.current.toDataURL(),
      strokes: [...strokesRef.current],
      backgroundUrl: backgroundImageRef.current?.src
    };
    setPages(currentPages);

    // Switch to new page
    setCurrentPage(pageIndex);

    // Load new page state
    const newPage = currentPages[pageIndex];
    if (!newPage) {
      console.error('Page not found:', pageIndex);
      return;
    }

    // Initialize strokes array if it doesn't exist
    strokesRef.current = [...(newPage.strokes || [])];

    // Load background if exists
    if (newPage.backgroundUrl) {
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        canvasCtxRef.current.redrawCanvas();
      };
      img.src = newPage.backgroundUrl;
    } else {
      backgroundImageRef.current = null;
      canvasCtxRef.current.redrawCanvas();
    }
  };

  const addNewPage = () => {
    // Save current page first
    const currentPages = [...pages];
    currentPages[currentPage] = {
      dataUrl: canvasRef.current.toDataURL(),
      strokes: [...strokesRef.current],
      backgroundUrl: backgroundImageRef.current?.src
    };

    // Add new blank page
    const newPageIndex = currentPages.length;
    currentPages.push({
      dataUrl: null,
      strokes: [],
      backgroundUrl: null
    });

    // Update state
    setPages(currentPages);

    // Clear current state before switching
    strokesRef.current = [];
    backgroundImageRef.current = null;

    // Switch to new page
    setCurrentPage(newPageIndex);
    canvasCtxRef.current?.redrawCanvas();
  };

  const renderPage = async (page) => {
    return new Promise((resolve) => {
      // Create a temporary canvas for this page
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Clear temp canvas
      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      const drawStrokes = () => {
        if (page.strokes && page.strokes.length > 0) {
          page.strokes.forEach(stroke => {
            tempCtx.beginPath();
            tempCtx.strokeStyle = 'black';
            tempCtx.lineWidth = 8;
            tempCtx.lineCap = 'round';
            tempCtx.lineJoin = 'round';

            const [firstPoint, ...points] = stroke;
            tempCtx.moveTo(firstPoint.x, firstPoint.y);
            points.forEach(point => {
              tempCtx.lineTo(point.x, point.y);
            });
            tempCtx.stroke();
          });
        }
        resolve(tempCanvas.toDataURL());
      };

      // Draw background if exists
      if (page.backgroundUrl) {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(
            tempCanvas.width / img.width,
            tempCanvas.height / img.height
          );
          const x = (tempCanvas.width - img.width * scale) / 2;
          const y = (tempCanvas.height - img.height * scale) / 2;

          tempCtx.drawImage(
            img,
            x,
            y,
            img.width * scale,
            img.height * scale
          );
          drawStrokes();
        };
        img.onerror = () => {
          console.error('Failed to load background image');
          drawStrokes(); // Still draw strokes even if background fails
        };
        img.src = page.backgroundUrl;
      } else {
        drawStrokes();
      }
    });
  };

  const saveDrawing = async () => {
    try {
      // Save current page state first
      const currentPages = [...pages];
      currentPages[currentPage] = {
        dataUrl: canvasRef.current.toDataURL(),
        strokes: [...strokesRef.current],
        backgroundUrl: backgroundImageRef.current?.src
      };

      // Create a temporary canvas for rendering pages
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Generate dataUrls for all pages
      const pageDataUrls = await Promise.all(
        currentPages.map(async (page) => {
          // Clear canvas
          tempCtx.fillStyle = 'white';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          // Draw background if exists
          if (page.backgroundUrl) {
            await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                resolve();
              };
              img.src = page.backgroundUrl;
            });
          }

          // Draw strokes
          if (page.strokes && page.strokes.length > 0) {
            page.strokes.forEach(stroke => {
              tempCtx.beginPath();
              tempCtx.strokeStyle = 'black';
              tempCtx.lineWidth = 8;
              tempCtx.lineCap = 'round';
              tempCtx.lineJoin = 'round';

              const [firstPoint, ...points] = stroke;
              tempCtx.moveTo(firstPoint.x, firstPoint.y);
              points.forEach(point => {
                tempCtx.lineTo(point.x, point.y);
              });
              tempCtx.stroke();
            });
          }

          return tempCanvas.toDataURL();
        })
      );

      // Save all pages
      if (!drawingName) {
        localStorage.setItem('tempPages', JSON.stringify(pageDataUrls));
        setIsNaming(true);
        localStorage.setItem('isSaving', 'true');
      } else {
        saveAndClose(pageDataUrls, drawingName);
      }
    } catch (error) {
      console.error('Error saving drawing:', error);
      alert('There was an error saving your drawing. Please try again.');
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

      // Save current page first
      const currentPages = [...pages];
      currentPages[currentPage] = {
        dataUrl: canvas.toDataURL(),
        canvas: canvas
      };

      // Store current canvas state
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, canvas.width, canvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      localStorage.setItem('tempPages', JSON.stringify(currentPages.map(p => p.dataUrl)));
      setIsNaming(true);
      localStorage.removeItem('isSaving'); // Clear save flag
    }
  };

  const saveAndClose = (pageDataUrls, name) => {
    const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
    const editingIndex = localStorage.getItem('editingIndex');

    const drawingData = {
      name,
      pages: pageDataUrls,
      timestamp: Date.now()
    };

    if (editingIndex !== null && editingIndex !== 'null') {
      const index = parseInt(editingIndex);
      if (index >= 0 && index < drawings.length) {
        drawings[index] = drawingData;
      }
    } else {
      drawings.push(drawingData);
    }

    localStorage.setItem('drawings', JSON.stringify(drawings));
    localStorage.removeItem('editingIndex');
    localStorage.removeItem('tempPages');
    window.location.href = '/gallery';
  };

  const handleNameSave = (name) => {
    setIsNaming(false); // Close the dialog
    const isSaving = localStorage.getItem('isSaving');
    const dataUrls = localStorage.getItem('tempPages');

    if (isSaving) {
      // If we're saving, save and close
      saveAndClose(JSON.parse(dataUrls), name);
      localStorage.removeItem('isSaving');
    } else {
      // If we're just naming, update the name and stay on the page
      setDrawingName(name);
    }
  };

  const removeBackground = () => {
    backgroundImageRef.current = null;

    // Remove background URL from current page in state
    const currentPages = [...pages];
    currentPages[currentPage] = {
      ...currentPages[currentPage],
      backgroundUrl: null
    };
    setPages(currentPages);

    canvasCtxRef.current.redrawCanvas();
  };

  const addBackground = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            backgroundImageRef.current = img;

            // Save the background URL in the pages state
            const currentPages = [...pages];
            currentPages[currentPage] = {
              ...currentPages[currentPage],
              backgroundUrl: img.src
            };
            setPages(currentPages);

            canvasCtxRef.current.redrawCanvas();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Add isPointInCanvas function
  const isPointInCanvas = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    return (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  };

  // Update the isPointingAtButton function to check for buttons and links
  const isPointingAtButton = (x, y) => {
    const now = Date.now();
    // Select both buttons and links with control-button class
    const buttons = document.querySelectorAll('button, .control-button');
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        // Check if button is in cooldown
        const lastClick = parseInt(button.dataset.lastClick || '0');
        if (now - lastClick < CLICK_COOLDOWN) {
          return null; // Button is in cooldown
        }
        return button;
      }
    }
    return null;
  };

  return (
    <div className="writing-platform">
      <div className="controls-container">
        <div className="controls-group">
          <PageNavigation
            currentPage={currentPage}
            totalPages={pages.length}
            onPageChange={switchPage}
            onAddPage={addNewPage}
            onDeletePage={() => setIsDeletePageDialogOpen(true)}
          />
        </div>

        <div className="controls-group">
          <button onClick={clearCanvas} className="control-button clear-button">
            <span className="button-icon">🗑️</span>
            Clear Canvas
          </button>
          <button onClick={openNameDialog} className="control-button name-button">
            <span className="button-icon">✏️</span>
            {drawingName ? 'Rename' : 'Name Drawing'}
          </button>
        </div>

        <div className="controls-group">
          <button onClick={addBackground} className="control-button background-button">
            <span className="button-icon">🖼️</span>
            Add Background
          </button>
          <button
            onClick={removeBackground}
            className="control-button background-remove-button"
            disabled={!backgroundImageRef.current}
          >
            <span className="button-icon">❌</span>
            Remove Background
          </button>
        </div>

        <div className="controls-group">
          <button onClick={saveDrawing} className="control-button save-button">
            <span className="button-icon">💾</span>
            Save Drawing
          </button>
          <Link to="/" className="control-button return-button">
            <span className="button-icon">🏠</span>
            Return Home
          </Link>
        </div>
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
      <DeletePageDialog
        isOpen={isDeletePageDialogOpen}
        onClose={() => setIsDeletePageDialogOpen(false)}
        onConfirm={deletePage}
      />
    </div>
  );
};

// New Record Dialog Component
const NewRecordDialog = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  const handleImageSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          onSelectType('image', e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Create New Record</h2>
        <div className="dialog-content">
          <button
            className="option-button"
            onClick={() => onSelectType('blank')}
          >
            <span className="button-icon">📝</span>
            <span>Blank Record</span>
            <p className="option-description">Start with a clean canvas</p>
          </button>
          <button
            className="option-button"
            onClick={handleImageSelect}
          >
            <span className="button-icon">🖼️</span>
            <span>Image Background</span>
            <p className="option-description">Start with a reference image</p>
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
