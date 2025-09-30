import { useState, useMemo, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Clock,
  User,
  Twitter,
  Activity,
  Eye,
  ChevronUp,
  ChevronDown,
  Check,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStatusBadgeVariant,
  getStatusBadgeClasses,
} from './modals/executionColumn';

interface TwitterCaringData {
  timestamp?: string;
  profileId?: number;
  username?: string;
  actionType?: string;
  postURL?: string;
  newPostId?: string;
  newPostURL?: string;
  status?: string;
  details?: string;
  [key: string]: any;
}

interface TwtCaringTabProps {
  profileId?: number;
  profileIdFilter?: number;
}

export default function TwtCaringTab({ profileId, profileIdFilter: initialProfileIdFilter }: TwtCaringTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedRecord, setSelectedRecord] = useState<TwitterCaringData | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Filter states
  const [profileIdFilter, setProfileIdFilter] = useState<string>("all");
  const [usernameFilter, setUsernameFilter] = useState<string>("all");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Effect to set initial profile ID filter when navigating from profiles
  useEffect(() => {
    if (initialProfileIdFilter !== undefined) {
      setProfileIdFilter(initialProfileIdFilter.toString());
    }
  }, [initialProfileIdFilter]);

  // Fetch Twitter caring data
  const { data: twitterData = [], isLoading, refetch, isRefetching } = useQuery<TwitterCaringData[]>({
    queryKey: [profileId ? `/api/twitters/caring/${profileId}` : "/api/twitters/caring"],
    queryFn: async (): Promise<TwitterCaringData[]> => {
      const endpoint = profileId 
        ? `/api/twitters/caring/${profileId}` 
        : "/api/twitters/caring";
      
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Twitter caring data fetched:', data);
        
        // Ensure we always return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching Twitter caring data:', error);
        return [];
      }
    },
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Process and filter data
  const processedData = useMemo(() => {
    console.log('Processing Twitter data:', twitterData);

    // Apply filters
    const filteredData = twitterData.filter((record) => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          record.username?.toLowerCase().includes(searchLower) ||
          record.actionType?.toLowerCase().includes(searchLower) ||
          record.status?.toLowerCase().includes(searchLower) ||
          record.details?.toLowerCase().includes(searchLower) ||
          record.profileId?.toString().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Profile ID filter
      if (profileIdFilter !== "all" && record.profileId?.toString() !== profileIdFilter) {
        return false;
      }
      
      // Username filter
      if (usernameFilter !== "all" && record.username !== usernameFilter) {
        return false;
      }
      
      // Action Type filter
      if (actionTypeFilter !== "all" && record.actionType !== actionTypeFilter) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }
      
      // Day filter
      if (dayFilter !== "all" && record.timestamp) {
        const recordDate = new Date(record.timestamp);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dayFilter === "today") {
          const startOfToday = new Date(today);
          const endOfToday = new Date(today);
          endOfToday.setDate(endOfToday.getDate() + 1);
          if (recordDate < startOfToday || recordDate >= endOfToday) return false;
        } else if (dayFilter === "yesterday") {
          const startOfYesterday = new Date(today);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          const endOfYesterday = new Date(today);
          if (recordDate < startOfYesterday || recordDate >= endOfYesterday) return false;
        } else if (dayFilter === "last7days") {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (recordDate < sevenDaysAgo) return false;
        } else if (dayFilter === "last30days") {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (recordDate < thirtyDaysAgo) return false;
        }
      }
      
      return true;
    });

    // Sort data
    const sortedData = filteredData.sort((a, b) => {
      const aValue = a[sortField] || "";
      const bValue = b[sortField] || "";
      
      if (sortField === "timestamp") {
        const aTime = new Date(aValue as string).getTime();
        const bTime = new Date(bValue as string).getTime();
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
      }
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    return sortedData;
  }, [twitterData, searchTerm, sortField, sortDirection, profileIdFilter, usernameFilter, actionTypeFilter, statusFilter, dayFilter]);

  // Pagination logic
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = processedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleViewDetails = (record: TwitterCaringData) => {
    setSelectedRecord(record);
    setIsDetailsOpen(true);
  };

  const getTwitterStatusBadgeVariant = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case "PASS":
      case "SUCCESS":
      case "COMPLETED":
        return "secondary";
      case "FAIL":
      case "FAILED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getTwitterStatusBadgeClasses = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case "PASS":
      case "SUCCESS":
      case "COMPLETED":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200";
      case "FAIL":
      case "FAILED":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
    }
  };

  // Get unique values for filters
  const uniqueProfileIds = Array.from(new Set(twitterData.map(record => record.profileId).filter(Boolean))).sort((a, b) => (a || 0) - (b || 0));
  const uniqueUsernames = Array.from(new Set(twitterData.map(record => record.username).filter(Boolean))).sort();
  const uniqueActionTypes = Array.from(new Set(twitterData.map(record => record.actionType).filter(Boolean))).sort();
  const uniqueStatuses = Array.from(new Set(twitterData.map(record => record.status).filter(Boolean))).sort();

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Twitter Caring Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4 w-full">       
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="bg-accent text-white hover:bg-emerald-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            {isRefetching ? "Refreshing..." : "Refresh"}
          </Button>          
          <Input
            type="text"
            placeholder="Search by username, action type, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />                     
        </div>
        
        {/* Filters and Info */}
        <div className="flex items-center justify-between w-full">
         <div></div>
          {/* Right: Filters */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={dayFilter} onValueChange={setDayFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={profileIdFilter} onValueChange={setProfileIdFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Profile ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All IDs</SelectItem>
                {uniqueProfileIds.map(id => (
                  <SelectItem key={id?.toString() || 'unknown'} value={id?.toString() || 'unknown'}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={usernameFilter} onValueChange={setUsernameFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Username" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsernames.map(username => (
                  <SelectItem key={username} value={username || 'unknown'}>@{username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActionTypes.map(action => (
                  <SelectItem key={action} value={action || 'unknown'} className="capitalize">{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status || 'unknown'}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
     
      {/* Twitter Caring Table */}
      {processedData.length === 0 ? (
        <div className="text-center py-12">
          <Twitter className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Twitter caring actions found
          </h3>
          <p className="text-gray-500 mb-6">
            No data matches your current filters
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900 h-6">
                <TableHead className="w-[80px] py-1">
                  <button
                    onClick={() => handleSort('timestamp')}
                    className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                      sortField === 'timestamp' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } p-1 rounded`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>Timestamp</span>
                    <SortIcon field="timestamp" />
                  </button>
                </TableHead>
                <TableHead className="w-[30px] py-1">
                  <button
                    onClick={() => handleSort('profileId')}
                    className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                      sortField === 'profileId' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } p-1 rounded`}
                  >
                    <span>Profile ID</span>
                    <SortIcon field="profileId" />
                  </button>
                </TableHead>
                <TableHead className="w-[120px] py-1">
                  <button
                    onClick={() => handleSort('username')}
                    className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                      sortField === 'username' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } p-1 rounded`}
                  >
                    <User className="h-3 w-3" />
                    <span>Username</span>
                    <SortIcon field="username" />
                  </button>
                </TableHead>
                <TableHead className="w-[100px] py-1">
                  <button
                    onClick={() => handleSort('actionType')}
                    className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                      sortField === 'actionType' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } p-1 rounded`}
                  >
                    <Activity className="h-3 w-3" />
                    <span>Action</span>
                    <SortIcon field="actionType" />
                  </button>
                </TableHead>
                <TableHead className="w-[100px] text-gray-500 dark:text-gray-400 py-1">Post URL</TableHead>
                <TableHead className="w-[100px] text-gray-500 dark:text-gray-400 py-1">New Post URL</TableHead>
                <TableHead className="w-[80px] py-1">
                  <button
                    onClick={() => handleSort('status')}
                    className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                      sortField === 'status' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } p-1 rounded`}
                  >
                    <span>Status</span>
                    <SortIcon field="status" />
                  </button>
                </TableHead>
                <TableHead className="w-[250px] py-1">
                  <button
                    onClick={() => handleSort('details')}
                    className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                      sortField === 'details' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } p-1 rounded`}
                  >
                    <span>Details</span>
                    <SortIcon field="details" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((record, index) => (
                <TableRow
                  key={`${record.profileId}-${record.timestamp}-${index}`}
                  className={`hover:bg-gray-100 dark:hover:bg-gray-700 h-6 ${index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"}`}
                >
                  <TableCell className="font-mono text-xs text-left py-1">
                    {record.timestamp ? (
                      <button
                        onClick={() => handleViewDetails(record)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:underline cursor-pointer"
                        title="Click to view details"
                      >
                        {(() => {
                          const date = new Date(record.timestamp);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          const seconds = String(date.getSeconds()).padStart(2, '0');
                          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        })()}
                      </button>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="font-medium text-sm text-left py-1">
                    {record.profileId || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-left py-1">
                    @{record.username || "Unknown"}
                  </TableCell>
                  <TableCell className="text-sm text-left py-1">
                    <Badge 
                      variant="outline" 
                      className={`capitalize text-xs ${
                        record.actionType?.toLowerCase() === 'like' ? 'text-red-600 border-red-200 bg-red-50' :
                        record.actionType?.toLowerCase() === 'repost' ? 'text-green-600 border-green-200 bg-green-50' :
                        record.actionType?.toLowerCase() === 'quote' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                        record.actionType?.toLowerCase() === 'reply' ? 'text-purple-600 border-purple-200 bg-purple-50' :
                        'text-gray-600 border-gray-200 bg-gray-50'
                      }`}
                    >
                      {record.actionType || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-left py-1">
                    {record.postURL ? (
                      <a 
                        href={record.postURL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:underline text-xs font-mono"
                        title={record.postURL}
                      >
                        View
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-left py-1">
                    {record.newPostURL ? (
                      <a 
                        href={record.newPostURL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:underline text-xs font-mono"
                        title={record.newPostURL}
                      >
                        View
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-left py-1">
                    <Badge 
                      variant={getTwitterStatusBadgeVariant(record.status)} 
                      className={`text-xs ${getTwitterStatusBadgeClasses(record.status)}`}
                    >
                      {record.status || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-left py-1">
                    <div className="text-xs truncate max-w-[250px]" title={record.details || "No details"}>
                      {record.details || "-"}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Pagination Controls */}
      {processedData.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          {/* Items per page - Left */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-gray-600 font-medium">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, processedData.length)} of {processedData.length} actions
          </div>

          {/* Pagination Navigation - Center/Right */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    const distance = Math.abs(page - currentPage);
                    return distance <= 2 || page === 1 || page === totalPages;
                  })
                  .map((page, index, arr) => {
                    const prevPage = arr[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;
                    
                    return (
                      <div key={page} className="flex items-center">
                        {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      </div>
                    );
                  })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Twitter className="h-5 w-5 text-blue-500" />
              Twitter Action Details
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <ScrollArea className="max-h-[80vh]">
              <div className="space-y-4">
                <div className="space-y-6">
                  {/* Timestamp and Status on same line */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Timestamp</label>
                      <p className="text-sm font-mono">
                        {selectedRecord.timestamp ? (() => {
                          const date = new Date(selectedRecord.timestamp);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          const seconds = String(date.getSeconds()).padStart(2, '0');
                          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        })() : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <div>
                        <Badge 
                          variant={getTwitterStatusBadgeVariant(selectedRecord.status)} 
                          className={getTwitterStatusBadgeClasses(selectedRecord.status)}
                        >
                          {selectedRecord.status || "Unknown"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Profile ID and Username on same line */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Profile ID</label>
                      <p className="text-sm font-mono">{selectedRecord.profileId || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Username</label>
                      <p className="text-sm font-mono">@{selectedRecord.username || "Unknown"}</p>
                    </div>
                  </div>

                  {/* Action Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Action Type</label>
                    <div>
                      <Badge variant="outline" className="capitalize">
                        {selectedRecord.actionType || "Unknown"}
                      </Badge>
                    </div>
                  </div>

                  {/* Post URL */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Post URL</label>
                    {selectedRecord.postURL ? (
                      <a 
                        href={selectedRecord.postURL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 underline text-sm break-all word-wrap"
                      >
                        {selectedRecord.postURL}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">"-"</p>
                    )}
                  </div>

                  {/* New Post URL only (excluding New Post ID) */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">New Post URL</label>
                    {selectedRecord.newPostURL ? (
                      <a 
                        href={selectedRecord.newPostURL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 underline text-sm break-all word-wrap"
                      >
                        {selectedRecord.newPostURL}
                      </a>
                    ) : (
                    <a>""</a>
                  )}
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Details</label>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded whitespace-pre-wrap break-words">
                      {selectedRecord.details || "No details available"}
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <label className="text-sm font-medium text-gray-500">Raw Data</label>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-auto whitespace-pre-wrap break-words max-h-64">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}