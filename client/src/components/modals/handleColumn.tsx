import React from 'react';
import { Button } from '@/components/ui/button';
import { Chrome, Copy, Trash2 } from 'lucide-react';

interface HandleColumnProps {
  // For Profile or Task entity
  entity?: {
    id: number;
    name?: string;
    status?: string;
    [key: string]: any;
  };
  
  // Handlers
  onOpenBrowser?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  
  // Loading states
  isOpeningBrowser?: boolean;
  isDuplicating?: boolean;
  isDeleting?: boolean;
  
  // Configuration
  showOpenBrowser?: boolean;
  showDuplicate?: boolean;
  showDelete?: boolean;
  
  // Custom tooltips
  openBrowserTooltip?: string;
  duplicateTooltip?: string;
  deleteTooltip?: string;
  
  // Disable conditions
  disableOpenBrowser?: boolean;
  disableDuplicate?: boolean;
  disableDelete?: boolean;
}

export const HandleColumn: React.FC<HandleColumnProps> = ({
  entity,
  onOpenBrowser,
  onDuplicate,
  onDelete,
  isOpeningBrowser = false,
  isDuplicating = false,
  isDeleting = false,
  showOpenBrowser = true,
  showDuplicate = true,
  showDelete = true,
  openBrowserTooltip,
  duplicateTooltip,
  deleteTooltip,
  disableOpenBrowser = false,
  disableDuplicate = false,
  disableDelete = false,
}) => {
  const isRunning = entity?.status === 'RUNNING';
  
  return (
    <div className="flex items-center space-x-1">
      {/* Open Chrome Browser Button */}
      {showOpenBrowser && entity && onOpenBrowser && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:text-gray-300 disabled:cursor-not-allowed"
          onClick={onOpenBrowser}
          disabled={isRunning || isOpeningBrowser || disableOpenBrowser}
          title={
            isRunning 
              ? "Cannot open browser while running"
              : openBrowserTooltip || "Open Chrome browser for testing"
          }
        >
          <Chrome className="h-3 w-3" />
        </Button>
      )}
      
      {/* Duplicate/Copy Button */}
      {showDuplicate && entity && onDuplicate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={onDuplicate}
          disabled={isDuplicating || disableDuplicate}
          title={duplicateTooltip || "Duplicate with same configuration"}
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
      
      {/* Delete/Clear Button */}
      {showDelete && onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
          onClick={onDelete}
          disabled={isDeleting || disableDelete}
          title={deleteTooltip || "Delete and remove all associated data"}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

// Keep backward compatibility
export const ProfileActions = HandleColumn;