import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { NodeData, NodeKind } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MobileNodeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData: NodeData | null;
  onSave: (data: NodeData) => void;
}

export function MobileNodeEditor({
  isOpen,
  onClose,
  nodeData,
  onSave,
}: MobileNodeEditorProps) {
  const [editedData, setEditedData] = useState<NodeData | null>(null);

  useEffect(() => {
    if (nodeData) {
      setEditedData({ ...nodeData });
    }
  }, [nodeData]);

  if (!isOpen || !editedData) return null;

  const handleSave = () => {
    if (editedData) {
      onSave(editedData);
      onClose();
    }
  };

  const updateConfig = (key: string, value: any) => {
    setEditedData({
      ...editedData,
      config: {
        ...editedData.config,
        [key]: value,
      },
    });
  };

  const renderConfigFields = () => {
    switch (editedData.kind) {
      case "MobileTap":
        return (
          <>
            <div className="space-y-2">
              <Label>Tọa độ X</Label>
              <Input
                type="number"
                value={editedData.config?.tapX || 360}
                onChange={(e) => updateConfig("tapX", Number(e.target.value))}
                placeholder="360"
              />
            </div>
            <div className="space-y-2">
              <Label>Tọa độ Y</Label>
              <Input
                type="number"
                value={editedData.config?.tapY || 640}
                onChange={(e) => updateConfig("tapY", Number(e.target.value))}
                placeholder="640"
              />
            </div>
            <div className="space-y-2">
              <Label>Offset Radius (px)</Label>
              <Input
                type="number"
                value={editedData.config?.tapOffsetRadius || 3}
                onChange={(e) => updateConfig("tapOffsetRadius", Number(e.target.value))}
                placeholder="3"
              />
            </div>
          </>
        );

      case "MobileTapByText":
        return (
          <>
            <div className="space-y-2">
              <Label>Text cần tìm</Label>
              <Input
                type="text"
                value={editedData.config?.tapText || ""}
                onChange={(e) => updateConfig("tapText", e.target.value)}
                placeholder="Đăng nhập"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedData.config?.tapTextPartialMatch ?? true}
                  onChange={(e) => updateConfig("tapTextPartialMatch", e.target.checked)}
                  className="rounded"
                />
                Tìm kiếm một phần (partial match)
              </Label>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedData.config?.tapTextCaseSensitive ?? false}
                  onChange={(e) => updateConfig("tapTextCaseSensitive", e.target.checked)}
                  className="rounded"
                />
                Phân biệt hoa thường (case sensitive)
              </Label>
            </div>
          </>
        );

      case "MobileSwipe":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start X</Label>
                <Input
                  type="number"
                  value={editedData.config?.swipeX1 || 360}
                  onChange={(e) => updateConfig("swipeX1", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Y</Label>
                <Input
                  type="number"
                  value={editedData.config?.swipeY1 || 800}
                  onChange={(e) => updateConfig("swipeY1", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>End X</Label>
                <Input
                  type="number"
                  value={editedData.config?.swipeX2 || 360}
                  onChange={(e) => updateConfig("swipeX2", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Y</Label>
                <Input
                  type="number"
                  value={editedData.config?.swipeY2 || 400}
                  onChange={(e) => updateConfig("swipeY2", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.swipeDuration || 500}
                onChange={(e) => updateConfig("swipeDuration", Number(e.target.value))}
              />
            </div>
          </>
        );

      case "MobileScroll":
        return (
          <>
            <div className="space-y-2">
              <Label>Hướng cuộn</Label>
              <Select
                value={editedData.config?.scrollDirection || "down"}
                onValueChange={(value) => updateConfig("scrollDirection", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Lên</SelectItem>
                  <SelectItem value="down">Xuống</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Khoảng cách (px)</Label>
              <Input
                type="number"
                value={editedData.config?.scrollDistance || 400}
                onChange={(e) => updateConfig("scrollDistance", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.scrollDuration || 500}
                onChange={(e) => updateConfig("scrollDuration", Number(e.target.value))}
              />
            </div>
          </>
        );

      case "MobileLongPress":
        return (
          <>
            <div className="space-y-2">
              <Label>Tọa độ X</Label>
              <Input
                type="number"
                value={editedData.config?.longPressX || 360}
                onChange={(e) => updateConfig("longPressX", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tọa độ Y</Label>
              <Input
                type="number"
                value={editedData.config?.longPressY || 640}
                onChange={(e) => updateConfig("longPressY", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.longPressDuration || 1000}
                onChange={(e) => updateConfig("longPressDuration", Number(e.target.value))}
              />
            </div>
          </>
        );

      case "MobileDoubleTap":
        return (
          <>
            <div className="space-y-2">
              <Label>Tọa độ X</Label>
              <Input
                type="number"
                value={editedData.config?.doubleTapX || 360}
                onChange={(e) => updateConfig("doubleTapX", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tọa độ Y</Label>
              <Input
                type="number"
                value={editedData.config?.doubleTapY || 640}
                onChange={(e) => updateConfig("doubleTapY", Number(e.target.value))}
              />
            </div>
          </>
        );

      case "MobilePinch":
        return (
          <>
            <div className="space-y-2">
              <Label>Zoom</Label>
              <Select
                value={editedData.config?.pinchZoom || "in"}
                onValueChange={(value) => updateConfig("pinchZoom", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Phóng to</SelectItem>
                  <SelectItem value="out">Thu nhỏ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Center X</Label>
                <Input
                  type="number"
                  value={editedData.config?.pinchCenterX || 360}
                  onChange={(e) => updateConfig("pinchCenterX", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Center Y</Label>
                <Input
                  type="number"
                  value={editedData.config?.pinchCenterY || 640}
                  onChange={(e) => updateConfig("pinchCenterY", Number(e.target.value))}
                />
              </div>
            </div>
          </>
        );

      case "MobileTypeText":
        return (
          <>
            <div className="space-y-2">
              <Label>Text</Label>
              <Input
                type="text"
                value={editedData.config?.mobileText || ""}
                onChange={(e) => updateConfig("mobileText", e.target.value)}
                placeholder="Nhập text..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field X</Label>
                <Input
                  type="number"
                  value={editedData.config?.mobileFieldX || 360}
                  onChange={(e) => updateConfig("mobileFieldX", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Field Y</Label>
                <Input
                  type="number"
                  value={editedData.config?.mobileFieldY || 640}
                  onChange={(e) => updateConfig("mobileFieldY", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedData.config?.mobileClearFirst || false}
                  onChange={(e) => updateConfig("mobileClearFirst", e.target.checked)}
                  className="rounded"
                />
                Xóa text trước khi gõ
              </Label>
            </div>
          </>
        );

      case "MobileWait":
        return (
          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input
              type="number"
              value={editedData.config?.mobileWaitTimeout || 2000}
              onChange={(e) => updateConfig("mobileWaitTimeout", Number(e.target.value))}
              placeholder="2000"
            />
          </div>
        );

      case "MobileScreenshot":
        return (
          <div className="space-y-2">
            <Label>Đường dẫn lưu</Label>
            <Input
              type="text"
              value={editedData.config?.screenshotPath || "./screenshots"}
              onChange={(e) => updateConfig("screenshotPath", e.target.value)}
              placeholder="./screenshots"
            />
          </div>
        );

      case "MobileOpenApp":
        return (
          <>
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input
                type="text"
                value={editedData.config?.appPackageName || ""}
                onChange={(e) => updateConfig("appPackageName", e.target.value)}
                placeholder="com.twitter.android"
              />
            </div>
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input
                type="text"
                value={editedData.config?.appName || ""}
                onChange={(e) => updateConfig("appName", e.target.value)}
                placeholder="Twitter"
              />
            </div>
          </>
        );

      case "MobileBack":
      case "MobileHome":
        return (
          <div className="text-center text-gray-500 py-4">
            Node này không cần cấu hình thêm
          </div>
        );

      // Human behavior nodes
      case "HumanTap":
      case "HumanQuickTap":
      case "HumanSlowTap":
        return (
          <>
            <div className="space-y-2">
              <Label>Tọa độ X</Label>
              <Input
                type="number"
                value={editedData.config?.humanTapX || 360}
                onChange={(e) => updateConfig("humanTapX", Number(e.target.value))}
                placeholder="360"
              />
            </div>
            <div className="space-y-2">
              <Label>Tọa độ Y</Label>
              <Input
                type="number"
                value={editedData.config?.humanTapY || 640}
                onChange={(e) => updateConfig("humanTapY", Number(e.target.value))}
                placeholder="640"
              />
            </div>
            <div className="space-y-2">
              <Label>Offset Range (px)</Label>
              <Input
                type="number"
                value={editedData.config?.humanTapOffsetRange || 15}
                onChange={(e) => updateConfig("humanTapOffsetRange", Number(e.target.value))}
                placeholder="15"
              />
              <p className="text-xs text-gray-500">Random offset for natural variation</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Pre-delay Min (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanPreTapDelayMin || 50}
                  onChange={(e) => updateConfig("humanPreTapDelayMin", Number(e.target.value))}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label>Pre-delay Max (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanPreTapDelayMax || 150}
                  onChange={(e) => updateConfig("humanPreTapDelayMax", Number(e.target.value))}
                  placeholder="150"
                />
              </div>
            </div>
          </>
        );

      case "HumanType":
        return (
          <>
            <div className="space-y-2">
              <Label>Text to Type</Label>
              <Input
                type="text"
                value={editedData.config?.humanTypeText || ""}
                onChange={(e) => updateConfig("humanTypeText", e.target.value)}
                placeholder="Enter text..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Char Delay Min (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanCharDelayMin || 80}
                  onChange={(e) => updateConfig("humanCharDelayMin", Number(e.target.value))}
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label>Char Delay Max (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanCharDelayMax || 200}
                  onChange={(e) => updateConfig("humanCharDelayMax", Number(e.target.value))}
                  placeholder="200"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pause Chance (0-1)</Label>
              <Input
                type="number"
                step="0.01"
                value={editedData.config?.humanPauseChance || 0.03}
                onChange={(e) => updateConfig("humanPauseChance", Number(e.target.value))}
                placeholder="0.03"
              />
              <p className="text-xs text-gray-500">Probability of random pauses (3% = 0.03)</p>
            </div>
          </>
        );

      case "HumanSwipe":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start X</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanSwipeX1 || 360}
                  onChange={(e) => updateConfig("humanSwipeX1", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Y</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanSwipeY1 || 800}
                  onChange={(e) => updateConfig("humanSwipeY1", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>End X</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanSwipeX2 || 360}
                  onChange={(e) => updateConfig("humanSwipeX2", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Y</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanSwipeY2 || 400}
                  onChange={(e) => updateConfig("humanSwipeY2", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.humanSwipeDuration || 500}
                onChange={(e) => updateConfig("humanSwipeDuration", Number(e.target.value))}
              />
              <p className="text-xs text-gray-500">Uses Bézier curve for natural movement</p>
            </div>
          </>
        );

      case "HumanScroll":
        return (
          <>
            <div className="space-y-2">
              <Label>Distance (px)</Label>
              <Input
                type="number"
                value={editedData.config?.humanScrollDistance || 300}
                onChange={(e) => updateConfig("humanScrollDistance", Number(e.target.value))}
                placeholder="300"
              />
              <p className="text-xs text-gray-500">Positive = scroll down, Negative = scroll up</p>
            </div>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.humanScrollDuration || 500}
                onChange={(e) => updateConfig("humanScrollDuration", Number(e.target.value))}
                placeholder="500"
              />
            </div>
          </>
        );

      case "HumanThink":
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Min Delay (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanThinkMin || 800}
                  onChange={(e) => updateConfig("humanThinkMin", Number(e.target.value))}
                  placeholder="800"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Delay (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanThinkMax || 2000}
                  onChange={(e) => updateConfig("humanThinkMax", Number(e.target.value))}
                  placeholder="2000"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Natural thinking pause before action</p>
          </>
        );

      case "HumanRead":
        return (
          <>
            <div className="space-y-2">
              <Label>Text Length (characters)</Label>
              <Input
                type="number"
                value={editedData.config?.humanReadTextLength || 100}
                onChange={(e) => updateConfig("humanReadTextLength", Number(e.target.value))}
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label>Reading Speed (WPM)</Label>
              <Input
                type="number"
                value={editedData.config?.humanReadWpm || 200}
                onChange={(e) => updateConfig("humanReadWpm", Number(e.target.value))}
                placeholder="200"
              />
              <p className="text-xs text-gray-500">Words per minute (average: 200-250)</p>
            </div>
          </>
        );

      case "HumanDelay":
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Min Delay (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanDelayMin || 500}
                  onChange={(e) => updateConfig("humanDelayMin", Number(e.target.value))}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Delay (ms)</Label>
                <Input
                  type="number"
                  value={editedData.config?.humanDelayMax || 1500}
                  onChange={(e) => updateConfig("humanDelayMax", Number(e.target.value))}
                  placeholder="1500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Uses Gaussian distribution for realistic timing</p>
          </>
        );

      case "HumanIdle":
        return (
          <>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.humanIdleDuration || 5000}
                onChange={(e) => updateConfig("humanIdleDuration", Number(e.target.value))}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Random Movements</Label>
              <Input
                type="number"
                value={editedData.config?.humanIdleMovements || 3}
                onChange={(e) => updateConfig("humanIdleMovements", Number(e.target.value))}
                placeholder="3"
              />
              <p className="text-xs text-gray-500">Simulates random micro-movements during idle</p>
            </div>
          </>
        );

      // Cloudflare nodes
      case "CloudflareDetect":
        return (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedData.config?.cloudflareDetectLog ?? true}
                  onChange={(e) => updateConfig("cloudflareDetectLog", e.target.checked)}
                  className="rounded"
                />
                Log detection results
              </Label>
            </div>
            <p className="text-xs text-gray-500">Detects Cloudflare challenge type (JS, Turnstile, Blocked)</p>
          </>
        );

      case "CloudflareWait":
        return (
          <>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.cloudflareWaitTimeout || 30000}
                onChange={(e) => updateConfig("cloudflareWaitTimeout", Number(e.target.value))}
                placeholder="30000"
              />
              <p className="text-xs text-gray-500">Max time to wait for challenge to pass</p>
            </div>
            <div className="space-y-2">
              <Label>Check Interval (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.cloudflareWaitCheckInterval || 2000}
                onChange={(e) => updateConfig("cloudflareWaitCheckInterval", Number(e.target.value))}
                placeholder="2000"
              />
              <p className="text-xs text-gray-500">How often to check if challenge passed</p>
            </div>
          </>
        );

      case "CloudflareHandle":
        return (
          <>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.cloudflareHandleTimeout || 30000}
                onChange={(e) => updateConfig("cloudflareHandleTimeout", Number(e.target.value))}
                placeholder="30000"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editedData.config?.cloudflareHandleSolveIfNeeded ?? false}
                  onChange={(e) => updateConfig("cloudflareHandleSolveIfNeeded", e.target.checked)}
                  className="rounded"
                />
                Use paid API if needed (Turnstile)
              </Label>
              <p className="text-xs text-gray-500">Default: FREE mode (wait for JS challenges only)</p>
            </div>
          </>
        );

      case "CloudflareSolve":
        return (
          <>
            <div className="space-y-2">
              <Label>Captcha Provider</Label>
              <Select
                value={editedData.config?.cloudflareSolveProvider || "2captcha"}
                onValueChange={(value) => updateConfig("cloudflareSolveProvider", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2captcha">2Captcha</SelectItem>
                  <SelectItem value="capsolver">CapSolver</SelectItem>
                  <SelectItem value="anticaptcha">Anti-Captcha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={editedData.config?.cloudflareSolveApiKey || ""}
                onChange={(e) => updateConfig("cloudflareSolveApiKey", e.target.value)}
                placeholder="Enter API key..."
              />
              <p className="text-xs text-gray-500">Cost: ~$0.002 per solve</p>
            </div>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={editedData.config?.cloudflareSolveTimeout || 120000}
                onChange={(e) => updateConfig("cloudflareSolveTimeout", Number(e.target.value))}
                placeholder="120000"
              />
            </div>
          </>
        );

      default:
        return (
          <div className="text-center text-gray-500 py-4">
            Chưa có cấu hình cho loại node này
          </div>
        );
    }
  };

  return (
    <>
      {/* Right Sidebar Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-96 bg-white dark:bg-gray-900 shadow-2xl z-[101] animate-in slide-in-from-right duration-300 flex flex-col border-l-2 border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-500">
          <h2 className="text-lg font-bold text-white">
            Edit {editedData.label}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-10 w-10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {renderConfigFields()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">
            Hủy
          </Button>
          <Button onClick={handleSave} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
            Lưu
          </Button>
        </div>
      </div>
    </>
  );
}
