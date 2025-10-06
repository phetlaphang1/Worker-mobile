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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] animate-in fade-in backdrop-blur-sm"
        onClick={onClose}
        style={{ touchAction: "none" }}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-[101] animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit {editedData.label}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-10 w-10"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {renderConfigFields()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12">
            Hủy
          </Button>
          <Button onClick={handleSave} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700">
            Lưu
          </Button>
        </div>
      </div>
    </>
  );
}
