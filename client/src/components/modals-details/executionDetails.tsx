import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WEB_SOCKET_PORT } from "../../../../shared/socket";
import { 
  RotateCcw, 
  Play, 
  Square, 
  X,
  FileText, 
  Eye, 
  Download, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  Archive, 
  Code, 
  File,
  Copy
} from "lucide-react";

interface NewLogEntry {
  type: 'task' | 'profile';
  id: number;
  message: string;
  timestamp: string;
}

interface LogDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  type: string;
  id?: number; // Optional for backward compatibility
}

interface OutputDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  path: string;
  files: any[];
  baseUrl: string; // e.g., "http://localhost:5051/api/tasks/4" or "http://localhost:5051/api/profiles/2"
}

export function LogDetailsModal({ isOpen, onClose, title, content, type, id }: LogDetailsModalProps) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [realtimeLogs, setRealtimeLogs] = useState<NewLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Combine initial content with real-time logs
  const initialLines = (content || "No log content available").split('\n');
  // const realtimeLogLines = realtimeLogs.map(log => `[${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}] ${log.message}`);
  const realtimeLogLines = realtimeLogs.map(log => `${log.timestamp} ${log.message}`);
  const allLogs = [
    ...initialLines,
    ...realtimeLogLines
  ];
  
  // console.log('LogDetailsModal logs breakdown:', {
  //   initialLines: initialLines.length,
  //   realtimeLogs: realtimeLogs.length,
  //   realtimeLogLines: realtimeLogLines.length,
  //   totalLogs: allLogs.length
  // });
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (realtimeLogs.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [realtimeLogs]);

  // WebSocket connection management (only if profileId is provided)
  useEffect(() => {
    if (isOpen && id) {
      const wsUrl = `ws://localhost:${WEB_SOCKET_PORT}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        
        // Subscribe to logs for this profile
        const subscribeMessage = {
          type: type,
          id: id
        };
        console.log('LogDetailsModal sending subscription:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          // const data: LogEntry = JSON.parse(event.data);
          // console.log('LogDetailsModal received WebSocket message:', data);
          
          // if (data.type === 'log') {
          //   console.log('LogDetailsModal adding log to realtimeLogs:', data.message);
          //   setRealtimeLogs(prev => {
          //     const newLogs = [...prev, data];
          //     console.log('LogDetailsModal updated realtimeLogs count:', newLogs.length);
          //     return newLogs;
          //   });
          // } else if (data.type === 'subscribed') {
          //   console.log('LogDetailsModal subscription confirmed:', data.message);
          // }

          const eventData = JSON.parse(event.data.toString());
          const data: NewLogEntry = { 
            type: eventData.type,
            id: eventData.id,
            message: eventData.message,
            timestamp: eventData.timestamp
          };
          console.log('LogDetailsModal received WebSocket message:', data);
          
          setRealtimeLogs(prev => {
            const newLogs = [...prev, data];
            console.log('LogDetailsModal updated realtimeLogs count:', newLogs.length);
            return newLogs;
          });


        } catch (error) {
          console.error('LogDetailsModal WebSocket message error:', error);
        }
      };

      ws.onclose = () => {
        console.log('LogDetailsModal WebSocket disconnected');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('LogDetailsModal WebSocket error:', error);
        setIsConnected(false);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    
    }
  }, [isOpen, id]);

  // Clear real-time logs when modal closes
  useEffect(() => {
    if (!isOpen) {
      setRealtimeLogs([]);
      setIsConnected(false);
    }
  }, [isOpen]);

  // Initial scroll when modal opens
  useEffect(() => {
    if (isOpen && content) {
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    }
  }, [isOpen, content]);
  
  const handleCopyContent = async () => {
    try {
      const allLogText = allLogs.join('\n');
      await navigator.clipboard.writeText(allLogText || "No log content available");
      toast({
        title: "Copied to Clipboard",
        description: "All log content (including real-time logs) has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy content to clipboard",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] w-[90vw] flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            {title}
            {id && isConnected && (
              <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400 text-xs bg-green-50 dark:bg-green-900/30">
                Live Updates
              </Badge>
            )}
            {id && !isConnected && (
              <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-600 dark:border-gray-400 text-xs">
                Static
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 mt-4 flex flex-col min-h-0">
          <div className="flex-1 bg-gray-900 dark:bg-black text-gray-100 rounded-md font-mono text-sm overflow-y-auto border border-gray-700 dark:border-gray-600 shadow-inner">
            {allLogs.map((line, index) => (
              <div key={index} className="flex border-b border-gray-800 dark:border-gray-700 last:border-b-0 hover:bg-gray-800 dark:hover:bg-gray-900">
                <div className="w-14 bg-gray-800 dark:bg-gray-950 text-gray-400 text-right px-3 py-1.5 text-xs border-r border-gray-700 dark:border-gray-600 select-none flex-shrink-0 font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 px-4 py-1.5 whitespace-pre-wrap break-all text-gray-200 dark:text-gray-300">
                  {line}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex justify-end space-x-2 mt-4 flex-shrink-0">
            <Button variant="outline" onClick={handleCopyContent} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button variant="outline" onClick={onClose} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OutputDetailsModal({ 
  isOpen, 
  onClose, 
  title, 
  path, 
  files, 
  baseUrl 
}: OutputDetailsModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    // First try scrollIntoView
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Also try direct scroll on the ScrollArea viewport
    setTimeout(() => {
      const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  useEffect(() => {
    if (isOpen && files?.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    }
  }, [isOpen, files]);


  // // Auto-scroll to bottom when Output Folder modal opens or files list updates
  // useEffect(() => {
  //   scrollAreaRef.current?.scrollIntoView({ behavior: 'smooth' });
  //   if (isOpen && scrollAreaRef.current && files?.length > 0) {
  //     const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
  //     if (scrollContainer) {
  //       scrollContainer.scrollTop = scrollContainer.scrollHeight;
  //     }
  //   }
  // }, [isOpen, files]);

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
        return <FileImage className="h-5 w-5 text-green-600" />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
        return <FileVideo className="h-5 w-5 text-purple-600" />;
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
      case 'ogg':
        return <FileAudio className="h-5 w-5 text-orange-600" />;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return <Archive className="h-5 w-5 text-yellow-600" />;
      case 'txt':
      case 'log':
      case 'md':
      case 'json':
      case 'xml':
      case 'csv':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'js':
      case 'ts':
      case 'html':
      case 'css':
      case 'py':
      case 'java':
        return <Code className="h-5 w-5 text-indigo-600" />;
      default:
        return <File className="h-5 w-5 text-gray-600" />;
    }
  };

  const getFileType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
        return 'Image';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
        return 'Video';
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
      case 'ogg':
        return 'Audio';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return 'Archive';
      case 'txt':
      case 'log':
      case 'md':
      case 'json':
      case 'xml':
      case 'csv':
        return 'Text';
      case 'js':
      case 'ts':
      case 'html':
      case 'css':
      case 'py':
      case 'java':
        return 'Code';
      default:
        return 'File';
    }
  };

  const isPreviewable = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '');
  };

  const isDownloadable = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return !['directory'].includes(ext || '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-900 dark:text-gray-100">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0">
            <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">
              Path: {path}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" ref={scrollAreaRef}>
            {files && files.length > 0 ? (
              <div className="space-y-2 p-2">
                {files.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer bg-white dark:bg-gray-800"
                    onClick={() => window.open(`${baseUrl}/output/${file.name}`, '_blank')}
                  >
                    <div className="flex-shrink-0">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline truncate">
                        {file.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                          {getFileType(file.name)}
                        </span>
                        <span>{file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'}</span>
                        {file.mtime && (
                          <span>{new Date(file.mtime).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {isDownloadable(file.name) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const downloadUrl = `${baseUrl}/output/${file.name}`;
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="text-xs h-7 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>

                  </div>

                ))}

              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No files found in output folder
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          <div className="flex justify-end space-x-2 flex-shrink-0">
            <Button variant="outline" onClick={onClose} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}