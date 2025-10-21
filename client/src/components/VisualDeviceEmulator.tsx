import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Trash2, Save, MousePointer, Hand, Type, Clock, Camera, FileCode, MessageSquare, Timer, MousePointer2, ArrowUpDown, ChevronLeft, Home as HomeIcon, AppWindow, Settings, X, Copy, Download, Clipboard, ArrowDown, ArrowUp } from 'lucide-react';

interface Action {
  id: string;
  type: 'click' | 'swipe' | 'type' | 'wait' | 'screenshot' | 'tapByText' | 'longPress' | 'doubleTap' | 'scroll' | 'back' | 'home' | 'openApp';
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  // Relative coordinates (percentage) for cross-device compatibility
  xPercent?: number;
  yPercent?: number;
  endXPercent?: number;
  endYPercent?: number;
  text?: string;
  duration?: number;
  timestamp: number;
  // Additional fields for new actions
  tapText?: string;
  scrollDirection?: 'up' | 'down';
  appPackage?: string;
  appName?: string;
  // Config for type action
  textSource?: 'manual' | 'account'; // Where to get text from
  accountField?: 'username' | 'password'; // Which field from account
  // Config for wait action
  waitType?: 'time' | 'element'; // Wait by time or wait for element
  waitElementText?: string; // Text of element to wait for
  waitTimeout?: number; // Max timeout for waiting element (ms)
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
  const [selectedTool, setSelectedTool] = useState<'click' | 'swipe' | 'type' | 'wait' | 'tapByText' | 'longPress' | 'doubleTap' | 'scroll' | 'scrollCustom'>('click');
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [deviceResolution, setDeviceResolution] = useState({ width: 360, height: 640 });
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [isPickingElement, setIsPickingElement] = useState(false); // For element picking mode
  const [savedScripts, setSavedScripts] = useState<Array<{
    name: string;
    actions: Action[];
    createdAt: string;
  }>>([]); // Saved scripts with localStorage persistence
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load saved scripts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('visualRecorder_savedScripts');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSavedScripts(parsed);
        console.log('[VisualRecorder] Loaded', parsed.length, 'saved scripts from localStorage');
      }
    } catch (error) {
      console.error('[VisualRecorder] Failed to load saved scripts:', error);
    }
  }, []);

  // Auto-save scripts to localStorage whenever they change
  useEffect(() => {
    if (savedScripts.length > 0) {
      try {
        localStorage.setItem('visualRecorder_savedScripts', JSON.stringify(savedScripts));
        console.log('[VisualRecorder] Auto-saved', savedScripts.length, 'scripts to localStorage');
      } catch (error) {
        console.error('[VisualRecorder] Failed to save scripts:', error);
      }
    }
  }, [savedScripts]);

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

  // Handle element picking for Wait for Element
  const pickElementAtPosition = async (x: number, y: number) => {
    if (!selectedAction || selectedAction.type !== 'wait' || selectedAction.waitType !== 'element') {
      return;
    }

    try {
      console.log(`[ElementPicker] Picking element at (${x}, ${y})`);

      const response = await fetch(`/api/inspector/${profileId}/xpath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      });

      const data = await response.json();

      if (data.success && data.element) {
        const elementText = data.element.text || data.element.contentDesc || '';

        if (elementText) {
          console.log(`[ElementPicker] Found element with text: "${elementText}"`);

          // Update the action with the detected element text
          updateActionConfig(selectedAction.id, {
            waitElementText: elementText
          });

          // Exit picking mode
          setIsPickingElement(false);

          alert(`✅ Element detected: "${elementText}"`);
        } else {
          alert('⚠️ Element has no text. Please pick an element with visible text or description.');
        }
      } else {
        alert('❌ No element found at this position. Try clicking on a button or text.');
      }
    } catch (error) {
      console.error('[ElementPicker] Failed to detect element:', error);
      alert('❌ Failed to detect element. Make sure the profile is running.');
    }
  };

  // Handle click on device
  const handleDeviceClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / SCALE);
    const y = Math.round((e.clientY - rect.top) / SCALE);

    // If in element picking mode, detect element instead of creating action
    if (isPickingElement) {
      await pickElementAtPosition(x, y);
      return;
    }

    if (selectedTool === 'click') {
      // Record click with both absolute and relative coordinates
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'click',
        x,
        y,
        xPercent: (x / DEVICE_WIDTH) * 100,
        yPercent: (y / DEVICE_HEIGHT) * 100,
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
        // End of swipe with relative coordinates
        const action: Action = {
          id: `action_${Date.now()}`,
          type: 'swipe',
          x: swipeStart.x,
          y: swipeStart.y,
          endX: x,
          endY: y,
          xPercent: (swipeStart.x / DEVICE_WIDTH) * 100,
          yPercent: (swipeStart.y / DEVICE_HEIGHT) * 100,
          endXPercent: (x / DEVICE_WIDTH) * 100,
          endYPercent: (y / DEVICE_HEIGHT) * 100,
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
      // Create type action with relative coordinates
      const action: Action = {
        id: `action_${Date.now()}`,
        type: 'type',
        x,
        y,
        xPercent: (x / DEVICE_WIDTH) * 100,
        yPercent: (y / DEVICE_HEIGHT) * 100,
        text: '', // Empty text - will be configured in sidebar
        textSource: 'manual', // Default to manual
        timestamp: Date.now()
      };
      setActions([...actions, action]);

      // Auto-select this action to open sidebar
      setSelectedAction(action);

      // Create node in ReactFlow if callback provided
      if (onCreateNode) {
        onCreateNode({
          type: 'type',
          coordinates: { x, y },
          text: ''
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
              text: ''
            })
          });
        } catch (error) {
          console.error('Failed to record type:', error);
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
    } else if (selectedTool === 'scrollCustom') {
      // Custom scroll - draw swipe gesture on screen
      if (!swipeStart) {
        // Start of scroll gesture
        setSwipeStart({ x, y });
      } else {
        // End of scroll gesture - create swipe action
        const action: Action = {
          id: `action_${Date.now()}`,
          type: 'swipe',
          x: swipeStart.x,
          y: swipeStart.y,
          endX: x,
          endY: y,
          xPercent: (swipeStart.x / DEVICE_WIDTH) * 100,
          yPercent: (swipeStart.y / DEVICE_HEIGHT) * 100,
          endXPercent: (x / DEVICE_WIDTH) * 100,
          endYPercent: (y / DEVICE_HEIGHT) * 100,
          timestamp: Date.now()
        };
        setActions([...actions, action]);
        setSwipeStart(null);
      }
    }
  };

  // Add wait action
  const addWaitAction = () => {
    const action: Action = {
      id: `action_${Date.now()}`,
      type: 'wait',
      waitType: 'time', // Default to wait by time
      duration: 1000, // Default 1 second
      timestamp: Date.now()
    };
    setActions([...actions, action]);

    // Auto-select to open sidebar for configuration
    setSelectedAction(action);

    // Create node in ReactFlow if callback provided
    if (onCreateNode) {
      onCreateNode({
        type: 'wait',
        duration: 1000
      });
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

  // Add scroll action with specific direction
  const addScrollAction = (direction: 'up' | 'down') => {
    const action: Action = {
      id: `action_${Date.now()}`,
      type: 'scroll',
      scrollDirection: direction,
      timestamp: Date.now()
    };
    setActions([...actions, action]);
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

  // Generate script from actions
  const generateScript = () => {
    let script = `// Auto-generated mobile automation script\n`;
    script += `// Device: ${instanceName}\n`;
    script += `// Base Resolution: ${DEVICE_WIDTH}x${DEVICE_HEIGHT}\n`;
    script += `// Generated: ${new Date().toLocaleString()}\n`;
    script += `// NOTE: Uses relative coordinates (%) for cross-device compatibility\n`;
    script += `// NOTE: Using human.* APIs for human-like behavior (anti-detect)\n\n`;
    script += `async function automationScript() {\n`;
    script += `  try {\n`;
    script += `    // Get current device screen size\n`;
    script += `    const screenSize = await helpers.getScreenSize();\n`;
    script += `    log(\`Device resolution: \${screenSize.width}x\${screenSize.height}\`);\n\n`;
    script += `    // Handle Cloudflare if present (FREE mode)\n`;
    script += `    await cloudflare.handle();\n\n`;

    actions.forEach((action, index) => {
      script += `    // Step ${index + 1}: ${action.type}\n`;

      if (action.type === 'click' && action.xPercent !== undefined && action.yPercent !== undefined) {
        // Convert relative coords to absolute coords using current screen size
        // Use unique variable names per step to avoid redeclaration errors
        script += `    const tapX_${index} = Math.round((${action.xPercent.toFixed(2)} / 100) * screenSize.width);\n`;
        script += `    const tapY_${index} = Math.round((${action.yPercent.toFixed(2)} / 100) * screenSize.height);\n`;
        script += `    await human.tap(tapX_${index}, tapY_${index});\n`;
        script += `    log('Human-like tap at ${action.xPercent.toFixed(1)}%, ${action.yPercent.toFixed(1)}%');\n`;
      } else if (action.type === 'swipe' && action.xPercent !== undefined && action.yPercent !== undefined && action.endXPercent !== undefined && action.endYPercent !== undefined) {
        script += `    const swipeX1_${index} = Math.round((${action.xPercent.toFixed(2)} / 100) * screenSize.width);\n`;
        script += `    const swipeY1_${index} = Math.round((${action.yPercent.toFixed(2)} / 100) * screenSize.height);\n`;
        script += `    const swipeX2_${index} = Math.round((${action.endXPercent.toFixed(2)} / 100) * screenSize.width);\n`;
        script += `    const swipeY2_${index} = Math.round((${action.endYPercent.toFixed(2)} / 100) * screenSize.height);\n`;
        script += `    await human.swipe(swipeX1_${index}, swipeY1_${index}, swipeX2_${index}, swipeY2_${index});\n`;
        script += `    log('Human-like swipe from ${action.xPercent.toFixed(1)}%, ${action.yPercent.toFixed(1)}% to ${action.endXPercent.toFixed(1)}%, ${action.endYPercent.toFixed(1)}%');\n`;
      } else if (action.type === 'type') {
        if (action.xPercent !== undefined && action.yPercent !== undefined) {
          // Tap field with human-like behavior
          script += `    const fieldX_${index} = Math.round((${action.xPercent.toFixed(2)} / 100) * screenSize.width);\n`;
          script += `    const fieldY_${index} = Math.round((${action.yPercent.toFixed(2)} / 100) * screenSize.height);\n`;
          script += `    await human.tap(fieldX_${index}, fieldY_${index});\n`;
          script += `    await human.delay(300, 600);\n`;
        }

        // Handle text from account or manual input
        if (action.textSource === 'account' && action.accountField) {
          // Access accounts from profile.metadata.accounts.x (Twitter/X app)
          script += `    await human.type(profile.metadata?.accounts?.x?.${action.accountField} || '');\n`;
          script += `    log('Typed from account: ${action.accountField} (human-like)');\n`;
        } else if (action.text) {
          script += `    await human.type("${action.text.replace(/"/g, '\\"')}");\n`;
          script += `    log('Typed: "${action.text}" (human-like)');\n`;
        }
      } else if (action.type === 'wait') {
        if (action.waitType === 'element' && action.waitElementText) {
          script += `    await helpers.waitForText("${action.waitElementText.replace(/"/g, '\\"')}", { timeout: ${action.waitTimeout || 10000} });\n`;
          script += `    log('Waited for element: "${action.waitElementText.replace(/"/g, '\\"')}');\n`;
        } else if (action.duration) {
          const min = Math.max(100, action.duration - 200);
          const max = action.duration + 200;
          script += `    await human.delay(${min}, ${max});\n`;
          script += `    log('Human-like delay ~${action.duration}ms');\n`;
        }
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
        const distance = direction === 'down' ? 300 : -300;
        script += `    await human.scroll(${distance});\n`;
        script += `    log('Human-like scroll ${direction}');\n`;
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

    return script;
  };

  // Copy script to clipboard
  const copyScriptToClipboard = () => {
    if (actions.length === 0) {
      alert('❌ No actions to copy!');
      return;
    }

    const script = generateScript();
    navigator.clipboard.writeText(script).then(() => {
      alert('✅ Script copied to clipboard!');
    }).catch(err => {
      alert('❌ Failed to copy to clipboard: ' + err.message);
    });
  };

  // Save script to file
  const saveScriptToFile = () => {
    if (actions.length === 0) {
      alert('❌ No actions to save!');
      return;
    }

    const script = generateScript();
    const blob = new Blob([script], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation_${Date.now()}.js`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✅ Script saved to file!');
  };

  // Save script to memory (temporary storage)
  const saveScriptToMemory = () => {
    if (actions.length === 0) {
      alert('❌ No actions to save!');
      return;
    }

    const scriptName = prompt('Enter script name:', `Script_${new Date().toLocaleTimeString()}`);
    if (!scriptName) return;

    // Save to state (memory only)
    const scriptData = {
      name: scriptName,
      actions: [...actions], // Clone actions array
      createdAt: new Date().toISOString()
    };

    setSavedScripts([...savedScripts, scriptData]);
    alert(`✅ Script "${scriptName}" saved to memory!\n\nTotal saved: ${savedScripts.length + 1}`);
  };

  // Load script from memory
  const loadScriptFromMemory = () => {
    if (savedScripts.length === 0) {
      alert('❌ No saved scripts in memory!');
      return;
    }

    // Show list of saved scripts
    const scriptList = savedScripts.map((s, i) =>
      `${i + 1}. ${s.name} (${new Date(s.createdAt).toLocaleTimeString()}) - ${s.actions?.length || 0} actions`
    ).join('\n');

    const selection = prompt(`Select script to load:\n\n${scriptList}\n\nEnter number:`);
    if (!selection) return;

    const index = parseInt(selection) - 1;
    if (index < 0 || index >= savedScripts.length) {
      alert('❌ Invalid selection!');
      return;
    }

    const selectedScript = savedScripts[index];

    if (actions.length > 0) {
      if (!confirm(`Load script "${selectedScript.name}"?\n\nThis will replace current actions (${actions.length} actions).`)) {
        return;
      }
    }

    setActions([...selectedScript.actions]); // Clone to avoid reference issues
    alert(`✅ Script "${selectedScript.name}" loaded! (${selectedScript.actions?.length || 0} actions)`);
  };

  // Clear all saved scripts from localStorage
  const clearAllSavedScripts = () => {
    if (savedScripts.length === 0) {
      alert('❌ No saved scripts to clear!');
      return;
    }

    if (confirm(`⚠️ Delete ALL ${savedScripts.length} saved scripts from localStorage?\n\nThis cannot be undone!`)) {
      setSavedScripts([]);
      localStorage.removeItem('visualRecorder_savedScripts');
      alert('✅ All saved scripts cleared!');
    }
  };

  // Track mouse position
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / SCALE);
    const y = Math.round((e.clientY - rect.top) / SCALE);
    setMousePos({ x, y });
  };

  // Fetch profile data with accounts
  const fetchProfileData = async () => {
    try {
      const response = await fetch(`/api/profiles/${profileId}`);
      const data = await response.json();
      setProfileData(data);
      console.log('[VisualRecorder] Profile data loaded:', data);
    } catch (error) {
      console.error('[VisualRecorder] Failed to fetch profile data:', error);
    }
  };

  // Update action config
  const updateActionConfig = (actionId: string, updates: Partial<Action>) => {
    const updatedActions = actions.map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    );
    setActions(updatedActions);

    // Also update selectedAction if it's the one being modified
    if (selectedAction && selectedAction.id === actionId) {
      setSelectedAction({ ...selectedAction, ...updates });
    }

    console.log('[VisualRecorder] Updated action:', actionId, updates);
  };

  // Fetch device info and screenshot on mount
  useEffect(() => {
    fetchDeviceResolution();
    fetchProfileData();
    captureScreenshot();
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      captureScreenshot();
    }, 5000);
    return () => clearInterval(interval);
  }, [profileId]);

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
            className={`relative bg-white overflow-hidden ${
              isPickingElement ? 'cursor-pointer border-4 border-orange-500' : 'cursor-crosshair'
            }`}
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

            {/* Element Picking Overlay */}
            {isPickingElement && (
              <div className="absolute inset-0 bg-orange-500 bg-opacity-20 pointer-events-none flex items-center justify-center">
                <div className="bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm animate-bounce">
                  🎯 Click on element to detect
                </div>
              </div>
            )}
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
            <strong>Tip:</strong> Click on the device screen to create actions. Click on any action in the list below to configure it in the sidebar.
          </p>
        </div>

        {/* Action Controls */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Action Controls</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveScriptToMemory}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 font-medium"
              disabled={actions.length === 0}
              title="Save script to temporary memory (session only)"
            >
              <Save size={16} /> Save Temp
            </button>
            <button
              onClick={loadScriptFromMemory}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
              title="Load previously saved script from memory"
            >
              <FileCode size={16} /> Load Temp
            </button>
            <button
              onClick={copyScriptToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={actions.length === 0}
              title="Copy generated script to clipboard"
            >
              <Copy size={16} /> Copy
            </button>
            <button
              onClick={saveScriptToFile}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={actions.length === 0}
              title="Download script as .js file"
            >
              <Download size={16} /> Download
            </button>
            <button
              onClick={clearActions}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              disabled={actions.length === 0}
            >
              <Trash2 size={16} /> Clear
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {actions.length > 0 ? (
              <div className="text-sm text-green-600 font-medium">
                {actions.length} action{actions.length > 1 ? 's' : ''} recorded
              </div>
            ) : (
              <div className="text-sm text-gray-400">No actions recorded</div>
            )}
            {savedScripts.length > 0 && (
              <div className="text-xs text-purple-600 font-medium">
                📦 {savedScripts.length} saved in memory
              </div>
            )}
          </div>
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
              onClick={() => setSelectedTool('scrollCustom')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                selectedTool === 'scrollCustom' ? 'bg-blue-500 text-white' : 'bg-cyan-100 hover:bg-cyan-200'
              }`}
              title="Draw scroll gesture on device"
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
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                  selectedAction?.id === action.id
                    ? 'bg-blue-50 border-blue-400 shadow-md'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                }`}
                onClick={() => setSelectedAction(action)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">#{index + 1}</span>
                  <div>
                    <div className="font-medium capitalize">{action.type}</div>
                    <div className="text-xs text-gray-500">
                      {action.type === 'click' && `at (${action.x}, ${action.y})`}
                      {action.type === 'swipe' && `(${action.x}, ${action.y}) → (${action.endX}, ${action.endY})`}
                      {action.type === 'type' && `"${action.text}" at (${action.x}, ${action.y})`}
                      {action.type === 'wait' && (
                        action.waitType === 'element'
                          ? `for element: "${action.waitElementText}" (max: ${action.waitTimeout || 10000}ms)`
                          : `${action.duration}ms`
                      )}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAction(action.id);
                  }}
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

      {/* Action Settings Sidebar - RIGHT */}
      {selectedAction && !selectedNodeData && (
        <div className="w-full lg:w-80 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col max-h-[700px]">
          <div className="p-4 border-b bg-gradient-to-r from-green-500 to-teal-500 rounded-t-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">Action Settings</h3>
              <p className="text-xs text-white/80 mt-1 capitalize">{selectedAction.type} Action</p>
            </div>
            <button
              onClick={() => setSelectedAction(null)}
              className="text-white hover:bg-white/20 rounded p-1 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Common Fields for Click, LongPress, DoubleTap */}
            {['click', 'longPress', 'doubleTap'].includes(selectedAction.type) && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Coordinate X</label>
                  <input
                    type="number"
                    value={selectedAction.x || 0}
                    onChange={(e) => updateActionConfig(selectedAction.id, { x: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Coordinate Y</label>
                  <input
                    type="number"
                    value={selectedAction.y || 0}
                    onChange={(e) => updateActionConfig(selectedAction.id, { y: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Duration for LongPress */}
            {selectedAction.type === 'longPress' && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Duration (ms)</label>
                <input
                  type="number"
                  value={selectedAction.duration || 1000}
                  onChange={(e) => updateActionConfig(selectedAction.id, { duration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Swipe coordinates */}
            {selectedAction.type === 'swipe' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Start X</label>
                    <input
                      type="number"
                      value={selectedAction.x || 0}
                      onChange={(e) => updateActionConfig(selectedAction.id, { x: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Start Y</label>
                    <input
                      type="number"
                      value={selectedAction.y || 0}
                      onChange={(e) => updateActionConfig(selectedAction.id, { y: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">End X</label>
                    <input
                      type="number"
                      value={selectedAction.endX || 0}
                      onChange={(e) => updateActionConfig(selectedAction.id, { endX: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">End Y</label>
                    <input
                      type="number"
                      value={selectedAction.endY || 0}
                      onChange={(e) => updateActionConfig(selectedAction.id, { endY: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Type action with account integration */}
            {selectedAction.type === 'type' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Text Source</label>
                  <select
                    value={selectedAction.textSource || 'manual'}
                    onChange={(e) => updateActionConfig(selectedAction.id, {
                      textSource: e.target.value as 'manual' | 'account',
                      // Clear text if switching to account
                      ...(e.target.value === 'account' ? { text: '' } : {})
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="manual">Manual Input</option>
                    <option value="account">From Account</option>
                  </select>
                </div>

                {selectedAction.textSource === 'account' ? (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Account Field</label>
                      <select
                        value={selectedAction.accountField || 'username'}
                        onChange={(e) => updateActionConfig(selectedAction.id, {
                          accountField: e.target.value as 'username' | 'password'
                        })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="username">Username</option>
                        <option value="password">Password</option>
                      </select>
                    </div>
                    {profileData?.metadata?.accounts?.x && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-800 mb-1">Preview (X/Twitter Account):</p>
                        <p className="text-sm text-blue-900">
                          {selectedAction.accountField === 'username'
                            ? profileData.metadata.accounts.x.username || '(not set)'
                            : profileData.metadata.accounts.x.password || '(not set)'}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Text to Type</label>
                    <textarea
                      value={selectedAction.text || ''}
                      onChange={(e) => updateActionConfig(selectedAction.id, { text: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={3}
                      placeholder="Enter text to type..."
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Field X</label>
                    <input
                      type="number"
                      value={selectedAction.x || 0}
                      onChange={(e) => updateActionConfig(selectedAction.id, { x: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Field Y</label>
                    <input
                      type="number"
                      value={selectedAction.y || 0}
                      onChange={(e) => updateActionConfig(selectedAction.id, { y: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Wait action */}
            {selectedAction.type === 'wait' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Wait Type</label>
                  <select
                    value={selectedAction.waitType || 'time'}
                    onChange={(e) => updateActionConfig(selectedAction.id, {
                      waitType: e.target.value as 'time' | 'element'
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="time">Wait by Time</option>
                    <option value="element">Wait for Element</option>
                  </select>
                </div>

                {selectedAction.waitType === 'time' ? (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Duration (ms)</label>
                    <input
                      type="number"
                      value={selectedAction.duration || 1000}
                      onChange={(e) => updateActionConfig(selectedAction.id, { duration: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Element Text</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={selectedAction.waitElementText || ''}
                          onChange={(e) => updateActionConfig(selectedAction.id, { waitElementText: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="e.g., Welcome, Login button"
                        />
                        <button
                          onClick={() => setIsPickingElement(true)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            isPickingElement
                              ? 'bg-orange-500 text-white animate-pulse'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                          title="Click on device screen to detect element"
                        >
                          {isPickingElement ? '👆 Click Element' : '🎯 Pick'}
                        </button>
                      </div>
                      {isPickingElement && (
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          👆 Click on an element on the device screen to detect its text
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Max Timeout (ms)</label>
                      <input
                        type="number"
                        value={selectedAction.waitTimeout || 10000}
                        onChange={(e) => updateActionConfig(selectedAction.id, { waitTimeout: Number(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="10000"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum time to wait for element (default: 10000ms)</p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Tap by text */}
            {selectedAction.type === 'tapByText' && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Text to Find</label>
                <input
                  type="text"
                  value={selectedAction.tapText || ''}
                  onChange={(e) => updateActionConfig(selectedAction.id, { tapText: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Đăng nhập"
                />
              </div>
            )}

            {/* Scroll direction */}
            {selectedAction.type === 'scroll' && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Scroll Direction</label>
                <select
                  value={selectedAction.scrollDirection || 'down'}
                  onChange={(e) => updateActionConfig(selectedAction.id, {
                    scrollDirection: e.target.value as 'up' | 'down'
                  })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="down">Down</option>
                  <option value="up">Up</option>
                </select>
              </div>
            )}

            {/* Open app */}
            {selectedAction.type === 'openApp' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">App Package</label>
                  <input
                    type="text"
                    value={selectedAction.appPackage || ''}
                    onChange={(e) => updateActionConfig(selectedAction.id, { appPackage: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., com.twitter.android"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">App Name (Optional)</label>
                  <input
                    type="text"
                    value={selectedAction.appName || ''}
                    onChange={(e) => updateActionConfig(selectedAction.id, { appName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Twitter"
                  />
                </div>
              </>
            )}

            {/* Info for actions without config */}
            {['back', 'home', 'screenshot'].includes(selectedAction.type) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">
                  This action type has no configurable properties.
                </p>
              </div>
            )}
          </div>
          <div className="p-3 border-t bg-gray-50 rounded-b-xl">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Settings size={12} />
              <span>Changes are saved automatically</span>
            </div>
          </div>
        </div>
      )}

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
