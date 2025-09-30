import React from 'react';
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
import { Save, Download, FileImage } from "lucide-react";
import CodeEditor from "@uiw/react-textarea-code-editor";
import type { Profile } from '@shared/schema';

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
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>
          Script Details - Profile {scriptDetails?.profileId}
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-auto space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Source Code:</label>
          <div className="relative">
            <CodeEditor
              value={editedContent}
              language="js"
              placeholder="// Enter your JavaScript code here..."
              onChange={(evn) => onContentChange(evn.target.value)}
              padding={15}
              style={{
                fontSize: 14,
                backgroundColor: "#1e293b",
                fontFamily:
                  'ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",Menlo,monospace',
                minHeight: "400px",
                border: "1px solid #374151",
                borderRadius: "6px",
              }}
              data-color-mode="dark"
            />
            <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
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
              src={`/api/profiles/${imageFile.profileId}/output/${imageFile.name}`}
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