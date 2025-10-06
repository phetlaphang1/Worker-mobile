import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Download, FileImage, Plus, Copy } from "lucide-react";
import CodeEditor from "@uiw/react-textarea-code-editor";

interface ScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptDetails: { profileId: number; content: string } | null;
  editedContent: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

export const ScriptModal: React.FC<ScriptModalProps> = ({
  isOpen,
  onClose,
  scriptDetails,
  editedContent,
  onContentChange,
  onSave,
  isSaving = false
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-white text-gray-900">
      <DialogHeader>
        <DialogTitle className="text-gray-900">
          Script Details - Profile {scriptDetails?.profileId}
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-auto space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900">Source Code:</label>
          <div className="relative">
            <CodeEditor
              value={editedContent}
              language="js"
              placeholder="// Enter your JavaScript code here..."
              onChange={(evn) => onContentChange(evn.target.value)}
              padding={15}
              style={{
                fontSize: 14,
                backgroundColor: "#f9fafb",
                color: "#111827",
                fontFamily:
                  'ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",Menlo,monospace',
                minHeight: "400px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
              data-color-mode="light"
            />
            <div className="absolute top-2 right-2 text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">
              JavaScript
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Updating..." : "Update"}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  profileName?: string;
  isDeleting?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  profileName,
  isDeleting = false
}) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Profile</AlertDialogTitle>
        <AlertDialogDescription>
          {profileName && <span className="font-semibold">{profileName}</span>}
          {' '}All data of this profile will be deleted. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={isDeleting}
          className="bg-red-600 hover:bg-red-700"
        >
          {isDeleting ? "Deleting..." : "Delete Profile"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: any;
  onDownload: (file: any, profileId: number) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  imageFile,
  onDownload
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-green-600" />
          Image Preview - {imageFile?.name}
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        {imageFile && (
          <div className="text-center">
            <img 
              src={`http://localhost:5050/api/profiles/${imageFile.profileId}/output/${imageFile.name}`}
              alt={imageFile.name}
              className="max-w-full max-h-[60vh] object-contain mx-auto border rounded-lg shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.removeAttribute('style');
              }}
            />
            <div className="hidden text-center py-8 text-gray-500">
              <FileImage className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Unable to load image preview</p>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>File: {imageFile.name}</p>
              <p>Size: {imageFile.size ? (imageFile.size / 1024).toFixed(2) + ' KB' : 'Unknown'}</p>
              <p>Modified: {imageFile.mtime ? new Date(imageFile.mtime).toLocaleString() : 'Unknown'}</p>
            </div>
            <div className="mt-4">
              <Button
                onClick={() => onDownload(imageFile, imageFile.profileId)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Image
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

interface NewInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: any) => void;
  isCreating?: boolean;
}

interface CloneInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newName: string, copyApps: boolean) => void;
  isCloning?: boolean;
  originalName?: string;
}

export const CloneInstanceModal: React.FC<CloneInstanceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isCloning = false,
  originalName = ""
}) => {
  const [newName, setNewName] = useState('');
  const [copyApps, setCopyApps] = useState(true);

  const handleSubmit = () => {
    if (newName.trim()) {
      onSubmit(newName.trim(), copyApps);
      setNewName('');
      setCopyApps(true);
    }
  };

  const handleClose = () => {
    setNewName('');
    setCopyApps(true);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            Clone Instance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name" className="text-gray-900">New Instance Name</Label>
            <Input
              id="clone-name"
              placeholder={`${originalName} - Copy`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-white text-gray-900"
            />
          </div>

          <div className="flex items-center space-x-2 p-3 bg-emerald-50 border border-emerald-200 rounded">
            <Checkbox
              id="copy-apps"
              checked={copyApps}
              onCheckedChange={(checked) => setCopyApps(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="copy-apps" className="cursor-pointer text-gray-900 font-medium">
                Copy all installed apps
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                Clone the instance with all installed applications (recommended)
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
            <p className="font-medium text-gray-700 mb-1">Note:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Settings and configurations will be copied</li>
              <li>If "Copy apps" is checked, all apps will be cloned</li>
              <li>The cloned instance will be created as inactive</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isCloning}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCloning || !newName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Copy className="h-4 w-4 mr-2" />
            {isCloning ? "Cloning..." : "Clone Instance"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const NewInstanceModal: React.FC<NewInstanceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isCreating = false
}) => {
  const [name, setName] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [proxyType, setProxyType] = useState('http');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [resolution, setResolution] = useState('360,640');
  const [cpu, setCpu] = useState('2');
  const [memory, setMemory] = useState('2048');
  const [availableApps, setAvailableApps] = useState<any[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  // Fetch available apps
  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:5050/api/apps/available')
        .then(res => res.json())
        .then(data => setAvailableApps(data))
        .catch(err => console.error('Failed to fetch apps:', err));
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const config = {
      name: name || `Instance_${Date.now()}`,
      settings: {
        resolution,
        dpi: 160,
        cpu: parseInt(cpu),
        memory: parseInt(memory),
        androidVersion: '9'
      },
      network: {
        useProxy,
        ...(useProxy && {
          proxyType,
          proxyHost,
          proxyPort: parseInt(proxyPort) || 0,
          proxyUsername,
          proxyPassword,
        })
      },
      selectedApps,
      autoActivate: false
    };
    onSubmit(config);
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setUseProxy(false);
    setProxyHost('');
    setProxyPort('');
    setProxyUsername('');
    setProxyPassword('');
    setSelectedApps([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Plus className="h-5 w-5 text-emerald-600" />
            Create New Instance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
            <div className="space-y-2">
              <Label htmlFor="name">Instance Name</Label>
              <Input
                id="name"
                placeholder="Instance_1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Hardware Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Hardware Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="360,640">360x640</SelectItem>
                    <SelectItem value="720,1280">720x1280</SelectItem>
                    <SelectItem value="1080,1920">1080x1920</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpu">CPU Cores</Label>
                <Input
                  id="cpu"
                  type="number"
                  value={cpu}
                  onChange={(e) => setCpu(e.target.value)}
                  min="1"
                  max="8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory">Memory (MB)</Label>
                <Input
                  id="memory"
                  type="number"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  min="512"
                  step="512"
                />
              </div>
            </div>
          </div>

          {/* Proxy Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useProxy"
                checked={useProxy}
                onCheckedChange={(checked) => setUseProxy(checked as boolean)}
              />
              <Label htmlFor="useProxy" className="font-semibold cursor-pointer text-gray-900">
                Use Proxy
              </Label>
            </div>

            {useProxy && (
              <div className="pl-6 space-y-4 border-l-2 border-emerald-500">
                <div className="space-y-2">
                  <Label htmlFor="proxyType">Proxy Type</Label>
                  <Select value={proxyType} onValueChange={setProxyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="socks5">SOCKS5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proxyHost">Host</Label>
                    <Input
                      id="proxyHost"
                      placeholder="proxy.example.com"
                      value={proxyHost}
                      onChange={(e) => setProxyHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proxyPort">Port</Label>
                    <Input
                      id="proxyPort"
                      type="number"
                      placeholder="8080"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proxyUsername">Username (optional)</Label>
                    <Input
                      id="proxyUsername"
                      placeholder="username"
                      value={proxyUsername}
                      onChange={(e) => setProxyUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proxyPassword">Password (optional)</Label>
                    <Input
                      id="proxyPassword"
                      type="password"
                      placeholder="password"
                      value={proxyPassword}
                      onChange={(e) => setProxyPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* APK Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Apps to Install ({selectedApps.length} selected)
            </h3>
            <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
              {availableApps.length === 0 ? (
                <p className="text-sm text-gray-500">No APK files found in apks folder</p>
              ) : (
                availableApps.map((app) => (
                  <div key={app.fileName} className="flex items-center space-x-2 bg-white p-2 rounded border border-gray-200">
                    <Checkbox
                      id={app.fileName}
                      checked={selectedApps.includes(app.fileName)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedApps([...selectedApps, app.fileName]);
                        } else {
                          setSelectedApps(selectedApps.filter(f => f !== app.fileName));
                        }
                      }}
                    />
                    <Label htmlFor={app.fileName} className="text-sm cursor-pointer flex-1 text-gray-900">
                      {app.name || app.fileName}
                      <span className="text-xs text-gray-500 ml-2">
                        ({(app.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? "Creating..." : "Create Instance"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};