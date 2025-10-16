import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Trash2, Save, MousePointer, Hand, Type, Clock, Camera, FileCode, MessageSquare, Timer, MousePointer2, ArrowUpDown, ChevronLeft, Home as HomeIcon, AppWindow } from 'lucide-react';

interface Action {
  id: string;
  type: 'click' | 'swipe' | 'type' | 'wait' | 'screenshot' | 'tapByText' | 'longPress' | 'doubleTap' | 'scroll' | 'back' | 'home' | 'openApp';
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  text?: string;
  duration?: number;
  timestamp: number;
  // Additional fields for new actions
  tapText?: string;
  scrollDirection?: 'up' | 'down';
  appPackage?: string;
  appName?: string;
}

interface VisualDeviceEmulatorProps {
  profileId: number;
  port: number;
  instanceName: string;
  onCreateNode?: (nodeData: {
    type: 'click' | 'swipe' | 'type' | 'wait';
    coordinates?: { x: number; y: number; endX?: number; endY?: number };
    text?: string;
    duration?: number;
  }) => void;
  selectedNodeData?: any; // NodeData from parent
  onSaveNodeConfig?: (data: any) => void;
}

export const VisualDeviceEmulator: React.FC<VisualDeviceEmulatorProps> = ({
  profileId,
  port,
  instanceName,
  onCreateNode,
  selectedNodeData,
  onSaveNodeConfig
}) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<'click' | 'swipe' | 'type' | 'wait' | 'tapByText' | 'longPress' | 'doubleTap' | 'scroll'>('click');
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [deviceResolution, setDeviceResolution] = useState({ width: 360, height: 640 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Device dimensions - dynamically fetched from actual device
  const DEVICE_WIDTH = deviceResolution.width;
  const DEVICE_HEIGHT = deviceResolution.height;

  // Calculate responsive scale - fit device within max viewport size
  const MAX_DEVICE_WIDTH = 450; // Max width in pixels for device display
  const MAX_DEVICE_HEIGHT = 700; // Max height in pixels for device display

  const scaleByWidth = MAX_DEVICE_WIDTH / DEVICE_WIDTH;
  const scaleByHeight = MAX_DEVICE_HEIGHT / DEVICE_HEIGHT;
  const SCALE = Math.min(scaleByWidth, scaleByHeight, 1); // Never scale up beyond 1x

  // Fetch device resolution from device fingerprint (actual device resolution)
  const fetchDeviceResolution = async () => {
    try {
      const response = await fetch(`/api/profiles/${profileId}`);
      const data = await response.json();

      console.log('[VisualRecorder] Profile data:', JSON.stringify(data.device, null, 2));

      // Try to get resolution from device fingerprint
      // Check multiple possible fields: realResolution, resolution
      const resolutionStr = data.device?.realResolution || data.device?.resolution;

      if (resolutionStr) {
        // Support both comma and x separator: "1080,2400" or "1080x2400"
        const [width, height] = resolutionStr.includes(',')
          ? resolutionStr.split(',').map(Number)
          : resolutionStr.split('x').map(Number);

        if (width && height) {
          console.log(`[VisualRecorder] Loaded resolution from device fingerprint: ${width}x${height}`);
          setDeviceResolution({ width, height });
          return;
        }
      }

      // Fallback: Try settings.resolution
      if (data.settings?.resolution) {
        const resStr = data.settings.resolution;
        const [width, height] = resStr.includes(',')
          ? resStr.split(',').map(Number)
          : resStr.split('x').map(Number);

        if (width && height) {
          console.log(`[VisualRecorder] Loaded resolution from settings: ${width}x${height}`);
          setDeviceResolution({ width, height });
          return;
        }
      }

      console.warn('[VisualRecorder] No device resolution found, using default 360x640');
    } catch (error) {
      console.error('[VisualRecorder] Failed to fetch device resolution:', error);
    }
  };

  // Capture screenshot from device
  const captureScreenshot = async () => {
    try {
      const response = await fetch(`/api/inspector/${profileId}/screenshot`);
      const data = await response.json();
      if (data.success) {
        setScreenshot(data.image);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const response = await fetch('/api/actions/start-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptName: `Script_${Date.now()}`,
          options: {
            description: 'Visual automation script',
            profileId,
            appPackage: 'auto-generated'
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setRecordingId(data.scriptId);
        setIsRecording(true);
        setActions([]);
        // Capture initial screenshot
        await captureScreenshot();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      const response = await fetch('/api/actions/stop-recording', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setIsRecording(false);
        alert(`Script saved! ID: ${data.script.id}\nActions: ${data.script.actions.length}`);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Handle click on device
  const handleDeviceClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / SCALE);
    const y = Math.round((e.clientY - rect.top) / SCALE);

    if (selectedTool === 'click') {
      // Record click
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'click',
        x,
        y,
        timestamp: Date.now()
      };
      setActions([...actions, action]);

      // Create node in ReactFlow if callback provided
      if (onCreateNode) {
        onCreateNode({
          type: 'click',
          coordinates: { x, y }
        });
      }

      // Send to backend if recording
      if (isRecording) {
        try {
          await fetch('/api/actions/record-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              port,
              selector: {
                type: 'coordinates',
                value: { x, y }
              },
              takeScreenshot: false
            })
          });
        } catch (error) {
          console.error('Failed to record click:', error);
        }
      }
    } else if (selectedTool === 'swipe') {
      // Handle swipe
      if (!swipeStart) {
        // Start of swipe
        setSwipeStart({ x, y });
      } else {
        // End of swipe
        const action: Action = {
          id: `action_${Date.now()}`,
          type: 'swipe',
          x: swipeStart.x,
          y: swipeStart.y,
          endX: x,
          endY: y,
          timestamp: Date.now()
        };
        setActions([...actions, action]);
        setSwipeStart(null);

        // Create node in ReactFlow if callback provided
        if (onCreateNode) {
          onCreateNode({
            type: 'swipe',
            coordinates: { x: swipeStart.x, y: swipeStart.y, endX: x, endY: y }
          });
        }

        // Send to backend if recording
        if (isRecording) {
          try {
            await fetch('/api/actions/record-swipe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                port,
                startX: swipeStart.x,
                startY: swipeStart.y,
                endX: x,
                endY: y,
                duration: 300
              })
            });
          } catch (error) {
            console.error('Failed to record swipe:', error);
          }
        }
      }
    } else if (selectedTool === 'type') {
      // Prompt for text input
      const text = prompt('Enter text to type:');
      if (text) {
        const action: Action = {
          id: `action_${Date.now()}`,
          type: 'type',
          x,
          y,
          text,
          timestamp: Date.now()
        };
        setActions([...actions, action]);

        // Create node in ReactFlow if callback provided
        if (onCreateNode) {
          onCreateNode({
            type: 'type',
            coordinates: { x, y },
            text
          });
        }

        // Send to backend if recording
        if (isRecording) {
          try {
            await fetch('/api/actions/record-type', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                port,
                selector: {
                  type: 'coordinates',
                  value: { x, y }
                },
                text
              })
            });
          } catch (error) {
            console.error('Failed to record type:', error);
          }
        }
      }
    } else if (selectedTool === 'tapByText') {
      // Prompt for text to find
      const tapText = prompt('Enter text to tap (e.g., "Đăng nhập"):');
      if (tapText) {
        const action: Action = {
          id: `action_${Date.now()}`,
          type: 'tapByText',
          tapText,
          timestamp: Date.now()
        };
        setActions([...actions, action]);
      }
    } else if (selectedTool === 'longPress') {
      // Long press at coordinates
      const duration = parseInt(prompt('Long press duration (ms):', '1000') || '1000');
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'longPress',
        x,
        y,
        duration,
        timestamp: Date.now()
      };
      setActions([...actions, action]);
    } else if (selectedTool === 'doubleTap') {
      // Double tap at coordinates
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'doubleTap',
        x,
        y,
        timestamp: Date.now()
      };
      setActions([...actions, action]);
    } else if (selectedTool === 'scroll') {
      // Scroll (doesn't need click position)
      const direction = confirm('Scroll down? (Cancel for scroll up)') ? 'down' : 'up';
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'scroll',
        scrollDirection: direction,
        timestamp: Date.now()
      };
      setActions([...actions, action]);
    }
  };

  // Add wait action
  const addWaitAction = () => {
    const duration = parseInt(prompt('Wait duration (ms):', '1000') || '1000');
    const action: Action = {
      id: `action_${Date.now()}`,
      type: 'wait',
      duration,
      timestamp: Date.now()
    };
    setActions([...actions, action]);

    // Create node in ReactFlow if callback provided
    if (onCreateNode) {
      onCreateNode({
        type: 'wait',
        duration
      });
    }

    // Send to backend if recording
    if (isRecording) {
      fetch('/api/actions/record-wait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration })
      }).catch(console.error);
    }
  };

  // Add back button action
  const addBackAction = () => {
    const action: Action = {
      id: `action_${Date.now()}`,
      type: 'back',
      timestamp: Date.now()
    };
    setActions([...actions, action]);
  };

  // Add home button action
  const addHomeAction = () => {
    const action: Action = {
      id: `action_${Date.now()}`,
      type: 'home',
      timestamp: Date.now()
    };
    setActions([...actions, action]);
  };

  // Add screenshot action
  const addScreenshotAction = () => {
    const action: Action = {
      id: `action_${Date.now()}`,
      type: 'screenshot',
      timestamp: Date.now()
    };
    setActions([...actions, action]);
  };

  // Add open app action
  const addOpenAppAction = () => {
    const appPackage = prompt('Enter app package name (e.g., com.twitter.android):');
    if (appPackage) {
      const appName = prompt('Enter app name (e.g., Twitter):', appPackage.split('.').pop());
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'openApp',
        appPackage,
        appName: appName || appPackage,
        timestamp: Date.now()
      };
      setActions([...actions, action]);
    }
  };

  // Delete action
  const deleteAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  // Clear all actions
  const clearActions = () => {
    if (confirm('Clear all actions?')) {
      setActions([]);
    }
  };

  // Export actions to JavaScript code
  const exportToScript = () => {
    if (actions.length === 0) {
      alert('No actions to export!');
      return;
    }

    let script = `// Auto-generated mobile automation script\n`;
    script += `// Device: ${instanceName}\n`;
    script += `// Resolution: ${DEVICE_WIDTH}x${DEVICE_HEIGHT}\n`;
    script += `// Generated: ${new Date().toLocaleString()}\n\n`;
    script += `async function automationScript() {\n`;
    script += `  try {\n`;

    actions.forEach((action, index) => {
      script += `    // Step ${index + 1}: ${action.type}\n`;

      if (action.type === 'click' && action.x && action.y) {
        script += `    await helpers.tap(${action.x}, ${action.y});\n`;
        script += `    log('Tapped at (${action.x}, ${action.y})');\n`;
      } else if (action.type === 'swipe' && action.x && action.y && action.endX && action.endY) {
        script += `    await helpers.swipe(${action.x}, ${action.y}, ${action.endX}, ${action.endY}, 300);\n`;
        script += `    log('Swiped from (${action.x}, ${action.y}) to (${action.endX}, ${action.endY})');\n`;
      } else if (action.type === 'type' && action.text) {
        if (action.x && action.y) {
          script += `    await helpers.tap(${action.x}, ${action.y});\n`;
          script += `    await helpers.sleep(500);\n`;
        }
        script += `    await helpers.type("${action.text.replace(/"/g, '\\"')}");\n`;
        script += `    log('Typed: "${action.text}');\n`;
      } else if (action.type === 'wait' && action.duration) {
        script += `    await helpers.sleep(${action.duration});\n`;
        script += `    log('Waited ${action.duration}ms');\n`;
      } else if (action.type === 'tapByText' && action.tapText) {
        script += `    await helpers.tapByText("${action.tapText.replace(/"/g, '\\"')}", { partialMatch: true, caseSensitive: false });\n`;
        script += `    log('Tapped on text: "${action.tapText}');\n`;
      } else if (action.type === 'longPress' && action.x && action.y) {
        const duration = action.duration || 1000;
        script += `    await helpers.longPress(${action.x}, ${action.y}, ${duration});\n`;
        script += `    log('Long pressed at (${action.x}, ${action.y}) for ${duration}ms');\n`;
      } else if (action.type === 'doubleTap' && action.x && action.y) {
        script += `    await helpers.doubleTap(${action.x}, ${action.y});\n`;
        script += `    log('Double tapped at (${action.x}, ${action.y})');\n`;
      } else if (action.type === 'scroll') {
        const direction = action.scrollDirection || 'down';
        script += `    await helpers.scroll('${direction}');\n`;
        script += `    log('Scrolled ${direction}');\n`;
      } else if (action.type === 'back') {
        script += `    await helpers.pressKey('BACK');\n`;
        script += `    log('Pressed BACK button');\n`;
      } else if (action.type === 'home') {
        script += `    await helpers.pressKey('HOME');\n`;
        script += `    log('Pressed HOME button');\n`;
      } else if (action.type === 'screenshot') {
        script += `    const screenshotPath = await helpers.screenshot('./screenshots/screenshot_${Date.now()}.png');\n`;
        script += `    log('Screenshot saved: ' + screenshotPath);\n`;
      } else if (action.type === 'openApp' && action.appPackage) {
        script += `    await helpers.launchApp('${action.appPackage}');\n`;
        script += `    log('Opened app: ${action.appName || action.appPackage}');\n`;
        script += `    await helpers.sleep(2000); // Wait for app to load\n`;
      }

      script += `\n`;
    });

    script += `    log('✅ Script completed successfully');\n`;
    script += `    return { success: true };\n`;
    script += `  } catch (error) {\n`;
    script += `    log('❌ Error: ' + error.message);\n`;
    script += `    return { success: false, error: error.message };\n`;
    script += `  }\n`;
    script += `}\n\n`;
    script += `// Execute the automation\n`;
    script += `await automationScript();\n`;

    // Copy to clipboard and download
    navigator.clipboard.writeText(script).then(() => {
      alert('✅ Script exported to clipboard!\n\nYou can also download it as a file.');

      // Download as file
      const blob = new Blob([script], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `automation_${Date.now()}.js`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Track mouse position
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / SCALE);
    const y = Math.round((e.clientY - rect.top) / SCALE);
    setMousePos({ x, y });
  };

  // Fetch device info and screenshot on mount
  useEffect(() => {
    fetchDeviceResolution();
    captureScreenshot();
    // Auto-refresh every 5 seconds if not recording
    const interval = setInterval(() => {
      if (!isRecording) {
        captureScreenshot();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [profileId, isRecording]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* Device Emulator - LEFT */}
      <div className="flex-shrink-0 mx-auto lg:mx-0">
        <div className="bg-gray-900 rounded-3xl p-4 shadow-2xl">
          {/* Device Header */}
          <div className="bg-black rounded-t-2xl px-4 py-2 flex items-center justify-between">
            <div className="w-16 h-1 bg-gray-700 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
          </div>

          {/* Device Screen */}
          <div
            ref={canvasRef}
            className="relative bg-white cursor-crosshair overflow-hidden"
            style={{
              width: DEVICE_WIDTH * SCALE,
              height: DEVICE_HEIGHT * SCALE
            }}
            onClick={handleDeviceClick}
            onMouseMove={handleMouseMove}
          >
            {/* Screenshot Background */}
            {screenshot && (
              <img
                src={screenshot}
                alt="Device screen"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            )}

            {/* Coordinate Grid Overlay */}
            {showCoordinates && (
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full opacity-20">
                  {/* Vertical lines */}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <line
                      key={`v${i}`}
                      x1={(i + 1) * (DEVICE_WIDTH * SCALE) / 10}
                      y1={0}
                      x2={(i + 1) * (DEVICE_WIDTH * SCALE) / 10}
                      y2={DEVICE_HEIGHT * SCALE}
                      stroke="#3b82f6"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Horizontal lines */}
                  {Array.from({ length: 15 }).map((_, i) => (
                    <line
                      key={`h${i}`}
                      x1={0}
                      y1={(i + 1) * (DEVICE_HEIGHT * SCALE) / 16}
                      x2={DEVICE_WIDTH * SCALE}
                      y2={(i + 1) * (DEVICE_HEIGHT * SCALE) / 16}
                      stroke="#3b82f6"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              </div>
            )}

            {/* Show recorded actions */}
            {actions.map(action => (
              <div key={action.id}>
                {action.type === 'click' && action.x && action.y && (
                  <div
                    className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-blue-500 opacity-50 animate-ping"
                    style={{
                      left: action.x * SCALE,
                      top: action.y * SCALE
                    }}
                  />
                )}
                {action.type === 'swipe' && action.x && action.y && action.endX && action.endY && (
                  <svg className="absolute inset-0 pointer-events-none">
                    <defs>
                      <marker
                        id={`arrow-${action.id}`}
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
                      </marker>
                    </defs>
                    <line
                      x1={action.x * SCALE}
                      y1={action.y * SCALE}
                      x2={action.endX * SCALE}
                      y2={action.endY * SCALE}
                      stroke="#10b981"
                      strokeWidth="3"
                      markerEnd={`url(#arrow-${action.id})`}
                    />
                  </svg>
                )}
              </div>
            ))}

            {/* Swipe preview */}
            {swipeStart && (
              <div
                className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-green-500 border-2 border-white"
                style={{
                  left: swipeStart.x * SCALE,
                  top: swipeStart.y * SCALE
                }}
              />
            )}

            {/* Mouse position indicator */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: 0,
                bottom: 0,
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                fontSize: '12px',
                borderTopRightRadius: '4px'
              }}
            >
              ({mousePos.x}, {mousePos.y})
            </div>
          </div>

          {/* Device Footer */}
          <div className="bg-black rounded-b-2xl px-4 py-2">
            <div className="w-24 h-1 bg-gray-700 rounded-full mx-auto"></div>
          </div>
        </div>

        {/* Device Info */}
        <div className="mt-2 text-center text-sm text-gray-600">
          <div>{instanceName} • Port: {port}</div>
          <div className="text-xs text-gray-500 mt-1">
            Resolution: {DEVICE_WIDTH}x{DEVICE_HEIGHT}
          </div>
        </div>
      </div>

      {/* Control Panel - CENTER */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Info Hint */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Click on screen to create node. Settings Panel will appear on the right to edit config.
          </p>
        </div>

        {/* Recording Controls */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Recording Controls</h3>
          <div className="flex flex-wrap gap-2">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                <Play size={16} /> Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
              >
                <Square size={16} /> Stop Recording
              </button>
            )}
            <button
              onClick={captureScreenshot}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Camera size={16} /> Refresh
            </button>
            <button
              onClick={clearActions}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              disabled={actions.length === 0}
            >
              <Trash2 size={16} /> Clear
            </button>
            <button
              onClick={exportToScript}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={actions.length === 0}
            >
              <FileCode size={16} /> Export to Script
            </button>
          </div>
          {isRecording && (
            <div className="mt-2 text-sm text-red-600 font-semibold animate-pulse">
              Recording... ({actions.length} actions)
            </div>
          )}
        </div>

        {/* Tool Selection */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Select Tool</h3>
          <div className="grid grid-cols-2 gap-2">
            {/* Basic Actions - Click on device */}
            <button
              onClick={() => setSelectedTool('click')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'click' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <MousePointer size={16} /> Tap
            </button>
            <button
              onClick={() => setSelectedTool('swipe')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'swipe' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Hand size={16} /> Swipe
            </button>
            <button
              onClick={() => setSelectedTool('type')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'type' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Type size={16} /> Type
            </button>
            <button
              onClick={() => setSelectedTool('longPress')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'longPress' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Timer size={16} /> Long Press
            </button>
            <button
              onClick={() => setSelectedTool('doubleTap')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'doubleTap' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <MousePointer2 size={16} /> Double Tap
            </button>
            <button
              onClick={() => setSelectedTool('tapByText')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'tapByText' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <MessageSquare size={16} /> Tap by Text
            </button>

            {/* Non-click actions */}
            <button
              onClick={addWaitAction}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-100 rounded hover:bg-yellow-200 text-sm"
            >
              <Clock size={16} /> Wait
            </button>
            <button
              onClick={() => setSelectedTool('scroll')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'scroll' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <ArrowUpDown size={16} /> Scroll
            </button>
            <button
              onClick={addBackAction}
              className="flex items-center gap-2 px-3 py-2 bg-orange-100 rounded hover:bg-orange-200 text-sm"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={addHomeAction}
              className="flex items-center gap-2 px-3 py-2 bg-purple-100 rounded hover:bg-purple-200 text-sm"
            >
              <HomeIcon size={16} /> Home
            </button>
            <button
              onClick={addScreenshotAction}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded hover:bg-green-200 text-sm"
            >
              <Camera size={16} /> Screenshot
            </button>
            <button
              onClick={addOpenAppAction}
              className="flex items-center gap-2 px-3 py-2 bg-pink-100 rounded hover:bg-pink-200 text-sm"
            >
              <AppWindow size={16} /> Open App
            </button>
          </div>
          <div className="mt-3 pt-3 border-t">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCoordinates}
                onChange={(e) => setShowCoordinates(e.target.checked)}
              />
              Show coordinate grid
            </label>
          </div>
        </div>

        {/* Actions List */}
        <div className="bg-white rounded-lg p-4 shadow flex-1 overflow-auto">
          <h3 className="font-semibold mb-3">Actions ({actions.length})</h3>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">#{index + 1}</span>
                  <div>
                    <div className="font-medium capitalize">{action.type}</div>
                    <div className="text-xs text-gray-500">
                      {action.type === 'click' && `at (${action.x}, ${action.y})`}
                      {action.type === 'swipe' && `(${action.x}, ${action.y}) → (${action.endX}, ${action.endY})`}
                      {action.type === 'type' && `"${action.text}" at (${action.x}, ${action.y})`}
                      {action.type === 'wait' && `${action.duration}ms`}
                      {action.type === 'tapByText' && `"${action.tapText}"`}
                      {action.type === 'longPress' && `at (${action.x}, ${action.y}) for ${action.duration}ms`}
                      {action.type === 'doubleTap' && `at (${action.x}, ${action.y})`}
                      {action.type === 'scroll' && `${action.scrollDirection}`}
                      {action.type === 'back' && 'Press BACK button'}
                      {action.type === 'home' && 'Press HOME button'}
                      {action.type === 'screenshot' && 'Capture screen'}
                      {action.type === 'openApp' && `${action.appName || action.appPackage}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteAction(action.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {actions.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No actions recorded yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Node Settings Panel - RIGHT */}
      {selectedNodeData && onSaveNodeConfig && (
        <div className="w-full lg:w-80 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col max-h-[600px]">
          <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-xl">
            <h3 className="font-bold text-white text-lg">Node Settings</h3>
            <p className="text-xs text-white/80 mt-1">{selectedNodeData.label}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Render config fields based on node kind */}
            {selectedNodeData.kind === 'MobileTap' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700">Tọa độ X</label>
                  <input
                    type="number"
                    value={selectedNodeData.config?.tapX || 0}
                    onChange={(e) => onSaveNodeConfig({
                      ...selectedNodeData,
                      config: { ...selectedNodeData.config, tapX: Number(e.target.value) }
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Tọa độ Y</label>
                  <input
                    type="number"
                    value={selectedNodeData.config?.tapY || 0}
                    onChange={(e) => onSaveNodeConfig({
                      ...selectedNodeData,
                      config: { ...selectedNodeData.config, tapY: Number(e.target.value) }
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded"
                  />
                </div>
              </>
            )}
            {selectedNodeData.kind === 'MobileSwipe' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Start X</label>
                    <input
                      type="number"
                      value={selectedNodeData.config?.swipeX1 || 0}
                      onChange={(e) => onSaveNodeConfig({
                        ...selectedNodeData,
                        config: { ...selectedNodeData.config, swipeX1: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Start Y</label>
                    <input
                      type="number"
                      value={selectedNodeData.config?.swipeY1 || 0}
                      onChange={(e) => onSaveNodeConfig({
                        ...selectedNodeData,
                        config: { ...selectedNodeData.config, swipeY1: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">End X</label>
                    <input
                      type="number"
                      value={selectedNodeData.config?.swipeX2 || 0}
                      onChange={(e) => onSaveNodeConfig({
                        ...selectedNodeData,
                        config: { ...selectedNodeData.config, swipeX2: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">End Y</label>
                    <input
                      type="number"
                      value={selectedNodeData.config?.swipeY2 || 0}
                      onChange={(e) => onSaveNodeConfig({
                        ...selectedNodeData,
                        config: { ...selectedNodeData.config, swipeY2: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              </>
            )}
            {selectedNodeData.kind === 'MobileTypeText' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700">Text</label>
                  <input
                    type="text"
                    value={selectedNodeData.config?.mobileText || ''}
                    onChange={(e) => onSaveNodeConfig({
                      ...selectedNodeData,
                      config: { ...selectedNodeData.config, mobileText: e.target.value }
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded"
                    placeholder="Nhập text..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Field X</label>
                    <input
                      type="number"
                      value={selectedNodeData.config?.mobileFieldX || 0}
                      onChange={(e) => onSaveNodeConfig({
                        ...selectedNodeData,
                        config: { ...selectedNodeData.config, mobileFieldX: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Field Y</label>
                    <input
                      type="number"
                      value={selectedNodeData.config?.mobileFieldY || 0}
                      onChange={(e) => onSaveNodeConfig({
                        ...selectedNodeData,
                        config: { ...selectedNodeData.config, mobileFieldY: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              </>
            )}
            {selectedNodeData.kind === 'MobileWait' && (
              <div>
                <label className="text-xs font-medium text-gray-700">Timeout (ms)</label>
                <input
                  type="number"
                  value={selectedNodeData.config?.mobileWaitTimeout || 1000}
                  onChange={(e) => onSaveNodeConfig({
                    ...selectedNodeData,
                    config: { ...selectedNodeData.config, mobileWaitTimeout: Number(e.target.value) }
                  })}
                  className="w-full mt-1 px-3 py-2 border rounded"
                  placeholder="1000"
                />
              </div>
            )}
            {!['MobileTap', 'MobileSwipe', 'MobileTypeText', 'MobileWait'].includes(selectedNodeData.kind) && (
              <div className="text-center text-gray-500 py-8 text-sm">
                Node type: {selectedNodeData.kind}
                <br />
                <span className="text-xs">Config không khả dụng trong inline editor</span>
              </div>
            )}
          </div>
          <div className="p-3 border-t bg-gray-50 rounded-b-xl">
            <div className="text-xs text-gray-600">
              Auto-save when changed
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
