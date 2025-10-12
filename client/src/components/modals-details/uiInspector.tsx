import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, Loader2, Search, RefreshCw, List } from "lucide-react";

interface UIElement {
  xpath: string;
  text: string;
  resourceId: string;
  className: string;
  contentDesc: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  center: { x: number; y: number };
  clickable: boolean;
  enabled: boolean;
  attributes: Record<string, string>;
}

interface XPathSuggestion {
  xpath: string;
  priority: number;
  description: string;
}

interface SearchResult extends UIElement {
  matchReason?: string;
}

interface UIInspectorProps {
  profileId: number;
}

export default function UIInspector({ profileId }: UIInspectorProps) {
  const { toast } = useToast();
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UIElement | null>(null);
  const [suggestions, setSuggestions] = useState<XPathSuggestion[]>([]);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [onlyClickable, setOnlyClickable] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const loadScreenshot = async () => {
    setIsLoadingScreenshot(true);
    try {
      const response = await fetch(`http://localhost:5051/api/inspector/${profileId}/screenshot`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get screenshot');
      }

      const data = await response.json();
      setScreenshot(data.image);

      toast({
        title: "Screenshot Loaded",
        description: "Click on any element in the screenshot to inspect",
      });
    } catch (error: any) {
      toast({
        title: "Screenshot Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingScreenshot(false);
    }
  };

  const handleStartInspecting = async () => {
    if (!isInspecting) {
      await loadScreenshot();
    }
    setIsInspecting(!isInspecting);
  };

  const handleInspect = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isInspecting || !imageRef.current) return;

    // Get click position relative to image
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Get image's natural (original) size and displayed size
    const img = imageRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const displayedWidth = rect.width;
    const displayedHeight = rect.height;

    // Calculate scale ratios
    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    // Map to actual device coordinates
    const actualX = Math.floor(clickX * scaleX);
    const actualY = Math.floor(clickY * scaleY);

    setClickPosition({ x: actualX, y: actualY });

    try {
      const response = await fetch(`http://localhost:5051/api/inspector/${profileId}/xpath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: actualX, y: actualY })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get XPath');
      }

      const data = await response.json();

      if (!data.element) {
        toast({
          title: "No Element Found",
          description: `No UI element found at coordinates (${actualX}, ${actualY})`,
          variant: "destructive"
        });
        return;
      }

      setSelectedElement(data.element);
      setSuggestions(data.suggestions);

      toast({
        title: "Element Found",
        description: `Found ${data.suggestions.length} XPath suggestions`,
      });
    } catch (error: any) {
      toast({
        title: "Inspection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = async (xpath: string) => {
    try {
      await navigator.clipboard.writeText(xpath);
      toast({
        title: "Copied",
        description: "XPath copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy XPath to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search term",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(`http://localhost:5051/api/inspector/${profileId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          onlyClickable
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }

      const data = await response.json();
      setSearchResults(data.elements);

      toast({
        title: "Search Complete",
        description: `Found ${data.count} matching elements`,
      });
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (element: SearchResult) => {
    setSelectedElement(element);
    const allElements = searchResults;
    const elementSuggestions = generateXPathSuggestions(element, allElements);
    setSuggestions(elementSuggestions);
  };

  const generateXPathSuggestions = (element: UIElement, allElements: UIElement[]): XPathSuggestion[] => {
    const suggestions: XPathSuggestion[] = [];

    // By resource-id
    if (element.resourceId) {
      const count = allElements.filter(e => e.resourceId === element.resourceId).length;
      if (count === 1) {
        suggestions.push({
          xpath: `//*[@resource-id="${element.resourceId}"]`,
          priority: 1,
          description: 'By unique resource-id (most stable)'
        });
      }
    }

    // By text
    if (element.text) {
      const count = allElements.filter(e => e.text === element.text).length;
      if (count === 1) {
        suggestions.push({
          xpath: `//*[@text="${element.text}"]`,
          priority: 2,
          description: 'By unique text'
        });
      }
      suggestions.push({
        xpath: `//*[contains(@text, "${element.text}")]`,
        priority: 6,
        description: 'By text contains (flexible)'
      });
    }

    // By class
    suggestions.push({
      xpath: `//${element.className}`,
      priority: 8,
      description: `By class name`
    });

    return suggestions.sort((a, b) => a.priority - b.priority);
  };

  const getPriorityBadge = (priority: number) => {
    if (priority === 1) {
      return <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Best</span>;
    } else if (priority <= 3) {
      return <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Good</span>;
    } else if (priority <= 5) {
      return <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">Fair</span>;
    }
    return <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded">Low</span>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          UI Inspector - Auto XPath Generation
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Search by text/resource-id or click on screenshot to inspect elements
        </p>
      </div>

      {/* Auto-Search Section */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" />
          Auto-Find Elements
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder='Search by text, resource-id, or class... (e.g., "Login", "tweet_button")'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="only-clickable"
              checked={onlyClickable}
              onCheckedChange={setOnlyClickable}
            />
            <Label htmlFor="only-clickable" className="text-xs text-gray-600 dark:text-gray-400">
              Only show clickable/interactive elements
            </Label>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Found {searchResults.length} elements:
            </div>
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                onClick={() => handleSelectSearchResult(result)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-gray-900 dark:text-gray-100">
                    {result.text && <span className="font-semibold">"{result.text}"</span>}
                    {!result.text && result.contentDesc && <span className="font-semibold italic">"{result.contentDesc}"</span>}
                    {!result.text && !result.contentDesc && <span className="text-gray-500">(no text)</span>}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {result.className} {result.resourceId && `• ${result.resourceId}`}
                  </div>
                  {result.matchReason && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Match: {result.matchReason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Inspection Section */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Manual Click Inspection
        </h4>
        <div className="flex items-center gap-2 mb-3">
          {screenshot && (
            <Button
              onClick={loadScreenshot}
              variant="outline"
              size="sm"
              disabled={isLoadingScreenshot}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingScreenshot ? 'animate-spin' : ''}`} />
              Refresh Screenshot
            </Button>
          )}
          <Button
            onClick={handleStartInspecting}
            variant={isInspecting ? "destructive" : "default"}
            disabled={isLoadingScreenshot}
            size="sm"
            className="flex items-center gap-2"
          >
            {isLoadingScreenshot ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : isInspecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Stop
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Start
              </>
            )}
          </Button>
        </div>

        {/* LDPlayer Screenshot Area */}
        <div
          className={`border-2 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 ${
            isInspecting ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {screenshot ? (
            <div className="relative">
              <img
                ref={imageRef}
                src={screenshot}
                alt="LDPlayer Screenshot"
                className={`w-full h-auto ${isInspecting ? 'cursor-crosshair' : ''}`}
                onClick={handleInspect}
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
              {clickPosition && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  ({clickPosition.x}, {clickPosition.y})
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Click "Start" to load screenshot
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Element Info */}
      {selectedElement && (
        <div className="space-y-3">
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Selected Element
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Class:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                  {selectedElement.className || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Text:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                  {selectedElement.text || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Resource ID:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                  {selectedElement.resourceId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Clickable:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                  {selectedElement.clickable ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Bounds:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                  [{selectedElement.bounds.x1}, {selectedElement.bounds.y1}] -
                  [{selectedElement.bounds.x2}, {selectedElement.bounds.y2}]
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Center:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                  ({selectedElement.center.x}, {selectedElement.center.y})
                </span>
              </div>
            </div>
          </div>

          {/* XPath Suggestions */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              XPath Suggestions (sorted by priority)
            </h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      {getPriorityBadge(suggestion.priority)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {suggestion.description}
                      </span>
                    </div>
                    <code className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                      {suggestion.xpath}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(suggestion.xpath)}
                    className="flex-shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
