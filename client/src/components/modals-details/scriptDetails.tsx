import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Code, FileText, Calendar, HardDrive } from "lucide-react";

interface ScriptDetailsModalProps {
  scriptData: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScriptDetailsModal({ scriptData, isOpen, onClose }: ScriptDetailsModalProps) {
  if (!scriptData) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-600" />
            Script Details - {scriptData.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Script ID</label>
              <p className="text-lg font-semibold">{scriptData.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="text-base font-medium">{scriptData.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <HardDrive className="h-4 w-4" />
                Size
              </label>
              <p className="text-base">{formatFileSize(scriptData.size)}</p>
            </div>
          </div>

          {/* Description */}
          {scriptData.description && (
            <div>
              <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Description
              </label>
              <p className="text-base text-gray-700">{scriptData.description}</p>
            </div>
          )}

          {/* Script Content */}
          <div className="space-y-2 flex-1 min-h-0">
            <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Code className="h-4 w-4" />
              Script Content
            </label>
            <div className="bg-gray-900 text-gray-100 rounded-lg overflow-auto max-h-[50vh]">
              {scriptData.content.split('\n').map((line: string, index: number) => (
                <div key={index} className="flex border-b border-gray-800 last:border-b-0">
                  <div className="w-12 bg-gray-800 text-gray-500 text-right px-2 py-1 text-xs border-r border-gray-700 select-none flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 px-4 py-1 font-mono text-sm whitespace-pre-wrap break-all">
                    {line}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created
              </label>
              <p className="text-sm text-gray-600">
                {new Date(scriptData.createdAt).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Updated</label>
              <p className="text-sm text-gray-600">
                {new Date(scriptData.updatedAt).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}