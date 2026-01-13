import { useState, useEffect, useMemo } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { getAllEquipment, getBorrowRequests, getActiveBorrows, getReturnedBorrows, submitBorrowRequest } from "../services/equipmentService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./EquipmentBorrowingPage.css";

const EquipmentBorrowingPage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [activeBorrows, setActiveBorrows] = useState([]);
  const [view, setView] = useState("available"); // "available" | "requests" | "borrowed" | "history"
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [requestFilter, setRequestFilter] = useState("organization"); // "organization" | "me"
  const [requestSearchTerm, setRequestSearchTerm] = useState("");
  const [borrowFilter, setBorrowFilter] = useState("organization"); // "organization" | "me"
  const [borrowSearchTerm, setBorrowSearchTerm] = useState("");
  const [historyItems, setHistoryItems] = useState([]); // Contains both rejected requests and returned transactions
  
  // Filter states for My Requests
  const [requestMonthFilter, setRequestMonthFilter] = useState("all");
  const [requestYearFilter, setRequestYearFilter] = useState("all");
  
  // Filter states for Active Borrows
  const [borrowMonthFilter, setBorrowMonthFilter] = useState("all");
  const [borrowYearFilter, setBorrowYearFilter] = useState("all");
  
  // Filter states for History
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyFilter, setHistoryFilter] = useState("organization"); // "organization" | "me"
  const [historyMonthFilter, setHistoryMonthFilter] = useState("all");
  const [historyYearFilter, setHistoryYearFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        if (userDoc?.organizationId) {
          const orgDoc = await getOrganizationById(userDoc.organizationId);
          setOrganizationData(orgDoc);

          // Fetch equipment, requests, active borrows, and history
          const [equipList, requests, borrows, returned] = await Promise.all([
            getAllEquipment(),
            getBorrowRequests(userDoc.organizationId),
            getActiveBorrows(userDoc.organizationId),
            getReturnedBorrows(userDoc.organizationId)
          ]);

          setEquipment(equipList);
          
          // Get requestIds of returned transactions to identify which approved requests have been returned
          const returnedRequestIds = new Set(returned.map(trans => trans.requestId).filter(Boolean));
          
          // Filter out rejected, returned status, and approved requests that have been returned
          const activeRequests = requests.filter(req => {
            // Exclude rejected and returned status
            if (req.status === "rejected" || req.status === "returned") {
              return false;
            }
            // Exclude approved requests that have a corresponding returned transaction
            if (req.status === "approved" && returnedRequestIds.has(req.requestId)) {
              return false;
            }
            return true;
          });
          
          const rejectedRequests = requests.filter(req => req.status === "rejected");
          
          setBorrowRequests(activeRequests);
          setActiveBorrows(borrows);
          
          // Combine rejected requests and returned transactions for history
          const history = [
            ...rejectedRequests.map(req => ({ ...req, historyType: "rejected" })),
            ...returned.map(trans => ({ ...trans, historyType: "returned" }))
          ];
          setHistoryItems(history);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
    return "N/A";
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      pending: "status-badge-pending",
      approved: "status-badge-approved",
      rejected: "status-badge-rejected",
      borrowed: "status-badge-borrowed",
      returned: "status-badge-returned",
      overdue: "status-badge-overdue",
      cancelled: "status-badge-cancelled"
    };
    return statusClasses[status] || "status-badge-default";
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      borrowed: "Borrowed",
      returned: "Returned",
      overdue: "Overdue",
      cancelled: "Cancelled"
    };
    return statusLabels[status] || status;
  };

  const formatCategory = (category) => {
    if (!category) return "Uncategorized";
    return category
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getConditionBadgeClass = (condition) => {
    const conditionClasses = {
      excellent: "condition-badge-excellent",
      good: "condition-badge-good",
      fair: "condition-badge-fair",
      poor: "condition-badge-poor"
    };
    return conditionClasses[condition] || "condition-badge-default";
  };

  // Filter equipment based on search, category, and condition
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      // Search filter (name, description, specifications)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          item.name?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.specifications?.toLowerCase().includes(searchLower) ||
          item.location?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      // Condition filter
      if (conditionFilter !== "all" && item.condition !== conditionFilter) {
        return false;
      }

      return true;
    });
  }, [equipment, searchTerm, categoryFilter, conditionFilter]);

  // Get unique categories for filter dropdown
  const availableCategories = useMemo(() => {
    const categories = new Set(equipment.map(item => item.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [equipment]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setConditionFilter("all");
  };

  // Months array for filters
  const months = [
    { value: "all", label: "All Months" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" }
  ];

  // Get available years from data
  const getAvailableYears = (data, dateField) => {
    const years = new Set();
    data.forEach((item) => {
      let dateValue;
      if (typeof dateField === "function") {
        dateValue = dateField(item);
      } else {
        dateValue = item[dateField];
      }
      
      if (dateValue) {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  // Filter requests based on submitted by filter, search, month, and year
  const filteredBorrowRequests = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return [];

    // First filter by submitted by
    let filtered = borrowRequests;
    if (requestFilter === "me") {
      filtered = borrowRequests.filter(request => request.requestedBy === currentUserId);
    }
    // requestFilter === "organization" - show all from organization (already filtered by service)
    
    // Then apply search filter
    if (requestSearchTerm) {
      const searchLower = requestSearchTerm.toLowerCase();
      filtered = filtered.filter(request => 
        request.equipmentName?.toLowerCase().includes(searchLower) ||
        request.purpose?.toLowerCase().includes(searchLower) ||
        request.adminRemarks?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by month
    if (requestMonthFilter !== "all") {
      const month = parseInt(requestMonthFilter);
      filtered = filtered.filter((request) => {
        if (!request.dateRequested) return false;
        const date = request.dateRequested.toDate ? request.dateRequested.toDate() : new Date(request.dateRequested);
        return date.getMonth() + 1 === month;
      });
    }

    // Filter by year
    if (requestYearFilter !== "all") {
      const year = parseInt(requestYearFilter);
      filtered = filtered.filter((request) => {
        if (!request.dateRequested) return false;
        const date = request.dateRequested.toDate ? request.dateRequested.toDate() : new Date(request.dateRequested);
        return date.getFullYear() === year;
      });
    }
    
    return filtered;
  }, [borrowRequests, requestFilter, requestSearchTerm, requestMonthFilter, requestYearFilter]);

  // Calculate request counts for filter dropdown
  const requestCounts = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    const myRequestsCount = borrowRequests.filter(r => r.requestedBy === currentUserId).length;
    return {
      organization: borrowRequests.length,
      me: myRequestsCount
    };
  }, [borrowRequests]);

  // Filter active borrows based on submitted by filter, search, month, and year
  const filteredActiveBorrows = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return [];

    // First filter by submitted by (using requestedBy field for transactions)
    let filtered = activeBorrows;
    if (borrowFilter === "me") {
      filtered = activeBorrows.filter(borrow => borrow.requestedBy === currentUserId);
    }
    // borrowFilter === "organization" - show all from organization (already filtered by service)
    
    // Then apply search filter
    if (borrowSearchTerm) {
      const searchLower = borrowSearchTerm.toLowerCase();
      filtered = filtered.filter(borrow => 
        borrow.equipmentName?.toLowerCase().includes(searchLower) ||
        borrow.conditionNotes?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by month
    if (borrowMonthFilter !== "all") {
      const month = parseInt(borrowMonthFilter);
      filtered = filtered.filter((borrow) => {
        if (!borrow.dateBorrowed) return false;
        const date = borrow.dateBorrowed.toDate ? borrow.dateBorrowed.toDate() : new Date(borrow.dateBorrowed);
        return date.getMonth() + 1 === month;
      });
    }

    // Filter by year
    if (borrowYearFilter !== "all") {
      const year = parseInt(borrowYearFilter);
      filtered = filtered.filter((borrow) => {
        if (!borrow.dateBorrowed) return false;
        const date = borrow.dateBorrowed.toDate ? borrow.dateBorrowed.toDate() : new Date(borrow.dateBorrowed);
        return date.getFullYear() === year;
      });
    }
    
    return filtered;
  }, [activeBorrows, borrowFilter, borrowSearchTerm, borrowMonthFilter, borrowYearFilter]);

  // Filter history items
  const filteredHistoryItems = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return [];

    // First filter by submitted by
    let filtered = historyItems;
    if (historyFilter === "me") {
      filtered = historyItems.filter(item => {
        if (item.historyType === "rejected") {
          return item.requestedBy === currentUserId;
        } else {
          return item.requestedBy === currentUserId;
        }
      });
    }

    // Apply search filter
    if (historySearchTerm) {
      const searchLower = historySearchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.equipmentName?.toLowerCase().includes(searchLower) ||
        item.purpose?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by month
    if (historyMonthFilter !== "all") {
      const month = parseInt(historyMonthFilter);
      filtered = filtered.filter((item) => {
        let date;
        if (item.historyType === "rejected" && item.dateRejected) {
          date = item.dateRejected.toDate ? item.dateRejected.toDate() : new Date(item.dateRejected);
        } else if (item.historyType === "returned" && item.dateReturned) {
          date = item.dateReturned.toDate ? item.dateReturned.toDate() : new Date(item.dateReturned);
        } else {
          return false;
        }
        return date.getMonth() + 1 === month;
      });
    }

    // Filter by year
    if (historyYearFilter !== "all") {
      const year = parseInt(historyYearFilter);
      filtered = filtered.filter((item) => {
        let date;
        if (item.historyType === "rejected" && item.dateRejected) {
          date = item.dateRejected.toDate ? item.dateRejected.toDate() : new Date(item.dateRejected);
        } else if (item.historyType === "returned" && item.dateReturned) {
          date = item.dateReturned.toDate ? item.dateReturned.toDate() : new Date(item.dateReturned);
        } else {
          return false;
        }
        return date.getFullYear() === year;
      });
    }
    
    return filtered;
  }, [historyItems, historyFilter, historySearchTerm, historyMonthFilter, historyYearFilter]);

  // Calculate history counts for filter dropdown
  const historyCounts = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    const myHistoryCount = historyItems.filter(item => {
      if (item.historyType === "rejected") {
        return item.requestedBy === currentUserId;
      } else {
        return item.requestedBy === currentUserId;
      }
    }).length;
    return {
      organization: historyItems.length,
      me: myHistoryCount
    };
  }, [historyItems]);

  // Calculate borrow counts for filter dropdown
  const borrowCounts = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    const myBorrowsCount = activeBorrows.filter(b => b.borrowedBy === currentUserId).length;
    return {
      organization: activeBorrows.length,
      me: myBorrowsCount
    };
  }, [activeBorrows]);

  const handleRequestSuccess = async () => {
    setShowRequestForm(false);
    setSelectedEquipment(null);
    // Reload requests and history
    if (userData?.organizationId) {
      const [requests, returned] = await Promise.all([
        getBorrowRequests(userData.organizationId),
        getReturnedBorrows(userData.organizationId)
      ]);
      
      // Get requestIds of returned transactions
      const returnedRequestIds = new Set(returned.map(trans => trans.requestId).filter(Boolean));
      
      // Filter out rejected, returned status, and approved requests that have been returned
      const activeRequests = requests.filter(req => {
        if (req.status === "rejected" || req.status === "returned") {
          return false;
        }
        if (req.status === "approved" && returnedRequestIds.has(req.requestId)) {
          return false;
        }
        return true;
      });
      
      const rejectedRequests = requests.filter(req => req.status === "rejected");
      
      setBorrowRequests(activeRequests);
      
      // Update history
      const history = [
        ...rejectedRequests.map(req => ({ ...req, historyType: "rejected" })),
        ...returned.map(trans => ({ ...trans, historyType: "returned" }))
      ];
      setHistoryItems(history);
    }
  };

  const organizationName = organizationData?.name || "Organization";
  const userRole = userData?.role || "ISG";
  const userName = userData?.fullName || auth.currentUser?.email || "User";
  const verificationStatus = userData?.verificationStatus || "unverified";

  return (
    <div className="home-container">
      <Navbar
        organizationName={organizationName}
        role={userRole}
        verificationStatus={verificationStatus}
        userName={userName}
      />
      
      <DashboardLayout currentPage="equipment">
        {loading ? (
          <LoadingScreen compact={true} />
        ) : (
        <div className="equipment-borrowing-page">
          <div className="page-header">
            <h1 className="page-title">Equipment Borrowing</h1>
            <div className="view-tabs">
              <button
                className={`tab-btn ${view === "available" ? "active" : ""}`}
                onClick={() => setView("available")}
              >
                Available Equipment
              </button>
              <button
                className={`tab-btn ${view === "requests" ? "active" : ""}`}
                onClick={() => setView("requests")}
              >
                My Requests ({borrowRequests.length})
              </button>
              <button
                className={`tab-btn ${view === "borrowed" ? "active" : ""}`}
                onClick={() => setView("borrowed")}
              >
                Active Borrows ({activeBorrows.length})
              </button>
              <button
                className={`tab-btn ${view === "history" ? "active" : ""}`}
                onClick={() => setView("history")}
              >
                History ({historyItems.length})
              </button>
            </div>
          </div>

          {view === "available" && (
            <div className="equipment-list">
              {equipment.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔧</div>
                  <p className="empty-message">No equipment available</p>
                </div>
              ) : (
                <>
                  {/* Filters Section */}
                  <div className="filters-section">
                    <div className="filters-row">
                      <div className="filter-group">
                        <label htmlFor="equipment-search" className="filter-label">Search</label>
                        <input
                          id="equipment-search"
                          type="text"
                          className="filter-input"
                          placeholder="Search by name, description, specifications, or location..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="filter-group">
                        <label htmlFor="category-filter" className="filter-label">Category</label>
                        <select
                          id="category-filter"
                          className="filter-select"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                          <option value="all">All Categories</option>
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {formatCategory(cat)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label htmlFor="condition-filter" className="filter-label">Condition</label>
                        <select
                          id="condition-filter"
                          className="filter-select"
                          value={conditionFilter}
                          onChange={(e) => setConditionFilter(e.target.value)}
                        >
                          <option value="all">All Conditions</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="poor">Poor</option>
                        </select>
                      </div>
                      {(searchTerm || categoryFilter !== "all" || conditionFilter !== "all") && (
                        <button
                          className="btn-clear-filters"
                          onClick={handleClearFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredEquipment.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🔍</div>
                      <p className="empty-message">No equipment matches your filters</p>
                      <p className="empty-hint">Try adjusting your search criteria</p>
                    </div>
                  ) : (
                    <div className="equipment-grid">
                      {filteredEquipment.map((item) => (
                        <div key={item.equipmentId} className="equipment-card">
                          <div className="equipment-card-header">
                            <h3 className="equipment-name">{item.name}</h3>
                            <span className="equipment-category">{formatCategory(item.category)}</span>
                          </div>
                          <div className="equipment-card-body">
                            <div className="equipment-info">
                              <div className="info-item">
                                <span className="info-label">Available:</span>
                                <span className={`info-value ${(item.availableQuantity || 0) === 0 ? 'unavailable' : ''}`}>
                                  {item.availableQuantity || 0} / {item.totalQuantity || 0}
                                </span>
                              </div>
                              {item.location && (
                                <div className="info-item">
                                  <span className="info-label">Location:</span>
                                  <span className="info-value">{item.location}</span>
                                </div>
                              )}
                              {item.condition && (
                                <div className="info-item">
                                  <span className="info-label">Condition:</span>
                                  <span className={`condition-badge ${getConditionBadgeClass(item.condition)}`}>
                                    {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                            {item.description && (
                              <p className="equipment-description">{item.description}</p>
                            )}
                            {item.specifications && (
                              <div className="equipment-specifications">
                                <span className="spec-label">Specifications:</span>
                                <p className="spec-text">{item.specifications}</p>
                              </div>
                            )}
                          </div>
                          <div className="equipment-card-footer">
                            <button
                              className="btn-request"
                              onClick={() => {
                                setSelectedEquipment(item);
                                setShowRequestForm(true);
                              }}
                              disabled={verificationStatus !== "verified" || (item.availableQuantity || 0) === 0}
                            >
                              {(item.availableQuantity || 0) === 0 ? "Out of Stock" : "Request to Borrow"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {view === "requests" && (
            <>
              {/* Request Filter Section */}
              {borrowRequests.length > 0 && (
                <div className="filters-section">
                  <div className="filters-row">
                    <div className="filter-group">
                      <label htmlFor="request-search" className="filter-label">Search</label>
                      <input
                        id="request-search"
                        type="text"
                        className="filter-input"
                        placeholder="Search by equipment name, purpose, or remarks..."
                        value={requestSearchTerm}
                        onChange={(e) => setRequestSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="filter-group">
                      <label htmlFor="request-filter" className="filter-label">Submitted by</label>
                      <select
                        id="request-filter"
                        className="filter-select"
                        value={requestFilter}
                        onChange={(e) => setRequestFilter(e.target.value)}
                      >
                        <option value="organization">{organizationName} ({requestCounts.organization})</option>
                        <option value="me">You ({requestCounts.me})</option>
                      </select>
                    </div>
                    <div className="filter-group filter-group-date">
                      <label htmlFor="request-month" className="filter-label">Month</label>
                      <select
                        id="request-month"
                        className="filter-select"
                        value={requestMonthFilter}
                        onChange={(e) => setRequestMonthFilter(e.target.value)}
                      >
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group filter-group-date">
                      <label htmlFor="request-year" className="filter-label">Year</label>
                      <select
                        id="request-year"
                        className="filter-select"
                        value={requestYearFilter}
                        onChange={(e) => setRequestYearFilter(e.target.value)}
                      >
                        <option value="all">All Years</option>
                        {getAvailableYears(borrowRequests, "dateRequested").map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="requests-table-container">
                {filteredBorrowRequests.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <p className="empty-message">
                      {borrowRequests.length === 0 
                        ? "No borrow requests yet" 
                        : "No requests match your search or filter"}
                    </p>
                    {borrowRequests.length > 0 && (
                      <p className="empty-hint">Try adjusting your search or filter criteria</p>
                    )}
                  </div>
                ) : (
                  <table className="requests-table">
                    <thead>
                      <tr>
                        <th>Equipment</th>
                        <th>Quantity</th>
                        <th>Purpose</th>
                        <th>Borrow Date</th>
                        <th>Return Date</th>
                        <th>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBorrowRequests.map((request) => (
                        <tr key={request.requestId}>
                          <td>{request.equipmentName || "N/A"}</td>
                          <td>{request.quantity}</td>
                          <td className="table-purpose">{request.purpose || "—"}</td>
                          <td>{formatDate(request.borrowDate)}</td>
                          <td>{formatDate(request.expectedReturnDate)}</td>
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                              {getStatusLabel(request.status)}
                            </span>
                          </td>
                          <td className="table-remarks">
                            {request.adminRemarks ? (
                              <span title={request.adminRemarks}>
                                {request.adminRemarks.length > 50 
                                  ? `${request.adminRemarks.substring(0, 50)}...` 
                                  : request.adminRemarks}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {view === "borrowed" && (
            <>
              {/* Borrow Filter Section */}
              {activeBorrows.length > 0 && (
                <div className="filters-section">
                  <div className="filters-row">
                    <div className="filter-group">
                      <label htmlFor="borrow-search" className="filter-label">Search</label>
                      <input
                        id="borrow-search"
                        type="text"
                        className="filter-input"
                        placeholder="Search by equipment name or condition notes..."
                        value={borrowSearchTerm}
                        onChange={(e) => setBorrowSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="filter-group">
                      <label htmlFor="borrow-filter" className="filter-label">Submitted by</label>
                      <select
                        id="borrow-filter"
                        className="filter-select"
                        value={borrowFilter}
                        onChange={(e) => setBorrowFilter(e.target.value)}
                      >
                        <option value="organization">{organizationName} ({borrowCounts.organization})</option>
                        <option value="me">You ({borrowCounts.me})</option>
                      </select>
                    </div>
                    <div className="filter-group filter-group-date">
                      <label htmlFor="borrow-month" className="filter-label">Month</label>
                      <select
                        id="borrow-month"
                        className="filter-select"
                        value={borrowMonthFilter}
                        onChange={(e) => setBorrowMonthFilter(e.target.value)}
                      >
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group filter-group-date">
                      <label htmlFor="borrow-year" className="filter-label">Year</label>
                      <select
                        id="borrow-year"
                        className="filter-select"
                        value={borrowYearFilter}
                        onChange={(e) => setBorrowYearFilter(e.target.value)}
                      >
                        <option value="all">All Years</option>
                        {getAvailableYears(activeBorrows, "dateBorrowed").map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="borrowed-table-container">
                {filteredActiveBorrows.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <p className="empty-message">
                      {activeBorrows.length === 0 
                        ? "No active borrows" 
                        : "No borrows match your search or filter"}
                    </p>
                    {activeBorrows.length > 0 && (
                      <p className="empty-hint">Try adjusting your search or filter criteria</p>
                    )}
                  </div>
                ) : (
                  <table className="borrowed-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Borrow Date</th>
                        <th>Return Date</th>
                        <th>Status</th>
                        <th>Condition Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActiveBorrows.map((borrow) => (
                        <tr key={borrow.transactionId} className={borrow.status === "overdue" ? "row-overdue" : ""}>
                          <td>{borrow.equipmentName || "N/A"}</td>
                          <td>{borrow.quantity}</td>
                          <td>{formatDate(borrow.borrowDate)}</td>
                          <td>
                            {formatDate(borrow.expectedReturnDate)}
                            {borrow.status === "overdue" && <span className="overdue-badge">Overdue</span>}
                          </td>
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(borrow.status)}`}>
                              {getStatusLabel(borrow.status)}
                            </span>
                          </td>
                          <td className="table-notes">{borrow.conditionNotes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {view === "history" && (
            <>
              {/* History Filter Section */}
              {historyItems.length > 0 && (
                <div className="filters-section">
                  <div className="filters-row">
                    <div className="filter-group">
                      <label htmlFor="history-search" className="filter-label">Search</label>
                      <input
                        id="history-search"
                        type="text"
                        className="filter-input"
                        placeholder="Search by equipment name or purpose..."
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="filter-group">
                      <label htmlFor="history-filter" className="filter-label">Submitted by</label>
                      <select
                        id="history-filter"
                        className="filter-select"
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                      >
                        <option value="organization">{organizationName} ({historyCounts.organization})</option>
                        <option value="me">You ({historyCounts.me})</option>
                      </select>
                    </div>
                    <div className="filter-group filter-group-date">
                      <label htmlFor="history-month" className="filter-label">Month</label>
                      <select
                        id="history-month"
                        className="filter-select"
                        value={historyMonthFilter}
                        onChange={(e) => setHistoryMonthFilter(e.target.value)}
                      >
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group filter-group-date">
                      <label htmlFor="history-year" className="filter-label">Year</label>
                      <select
                        id="history-year"
                        className="filter-select"
                        value={historyYearFilter}
                        onChange={(e) => setHistoryYearFilter(e.target.value)}
                      >
                        <option value="all">All Years</option>
                        {getAvailableYears(historyItems, (item) => {
                          if (item.historyType === "rejected" && item.dateRejected) {
                            return item.dateRejected;
                          } else if (item.historyType === "returned" && item.dateReturned) {
                            return item.dateReturned;
                          }
                          return null;
                        }).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="requests-table-container">
                {filteredHistoryItems.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📜</div>
                    <p className="empty-message">
                      {historyItems.length === 0 
                        ? "No history items" 
                        : "No history items match your search or filter"}
                    </p>
                    {historyItems.length > 0 && (
                      <p className="empty-hint">Try adjusting your search or filter criteria</p>
                    )}
                  </div>
                ) : (
                  <table className="requests-table">
                    <thead>
                      <tr>
                        <th>Equipment</th>
                        <th>Quantity</th>
                        <th>Purpose</th>
                        <th>Borrow Date</th>
                        <th>Return Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryItems.map((item) => (
                        <tr key={item.historyType === "rejected" ? item.requestId : item.transactionId}>
                          <td>{item.equipmentName || "N/A"}</td>
                          <td>{item.quantity}</td>
                          <td className="table-purpose">{item.purpose || "—"}</td>
                          <td>{formatDate(item.borrowDate || item.expectedReturnDate)}</td>
                          <td>
                            {item.historyType === "rejected" 
                              ? formatDate(item.expectedReturnDate)
                              : formatDate(item.dateReturned || item.expectedReturnDate)
                            }
                          </td>
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(item.status || (item.historyType === "rejected" ? "rejected" : "returned"))}`}>
                              {getStatusLabel(item.status || (item.historyType === "rejected" ? "rejected" : "returned"))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* Request Form Modal */}
          {showRequestForm && selectedEquipment && (
            <div className="modal-overlay" onClick={() => setShowRequestForm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <BorrowRequestForm
                  equipment={selectedEquipment}
                  organizationId={userData?.organizationId}
                  userId={auth.currentUser?.uid}
                  onSuccess={handleRequestSuccess}
                  onCancel={() => {
                    setShowRequestForm(false);
                    setSelectedEquipment(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>
        )}
      </DashboardLayout>
    </div>
  );
};

// Borrow Request Form Component
const BorrowRequestForm = ({ equipment, organizationId, userId, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: 1,
    purpose: "",
    borrowDate: "",
    returnDate: ""
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.purpose.trim()) {
        throw new Error("Please enter a purpose for borrowing");
      }
      if (!formData.borrowDate) {
        throw new Error("Please select a borrow date");
      }
      if (!formData.returnDate) {
        throw new Error("Please select a return date");
      }

      const borrowDate = new Date(formData.borrowDate);
      const returnDate = new Date(formData.returnDate);

      if (returnDate <= borrowDate) {
        throw new Error("Return date must be after borrow date");
      }

      if (formData.quantity > (equipment.availableQuantity || 0)) {
        throw new Error(`Only ${equipment.availableQuantity} items available`);
      }

      await submitBorrowRequest({
        equipmentId: equipment.equipmentId,
        equipmentName: equipment.name,
        organizationId: organizationId,
        quantity: parseInt(formData.quantity),
        purpose: formData.purpose.trim(),
        borrowDate: borrowDate,
        expectedReturnDate: returnDate
      }, userId);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      setError(error.message || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="borrow-request-form">
      <div className="form-header">
        <h2>Request to Borrow: {equipment.name}</h2>
        {onCancel && (
          <button className="close-button" onClick={onCancel}>×</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="request-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="quantity" className="form-label">
            Quantity <span className="required">*</span>
          </label>
          <input
            type="number"
            id="quantity"
            className="form-input"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
            min="1"
            max={equipment.availableQuantity || 0}
            required
          />
          <span className="form-hint">Available: {equipment.availableQuantity || 0}</span>
        </div>

        <div className="form-group">
          <label htmlFor="purpose" className="form-label">
            Purpose <span className="required">*</span>
          </label>
          <textarea
            id="purpose"
            className="form-textarea"
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            placeholder="Describe the purpose for borrowing this equipment..."
            rows={4}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="borrowDate" className="form-label">
            Borrow Date <span className="required">*</span>
          </label>
          <input
            type="date"
            id="borrowDate"
            className="form-input"
            value={formData.borrowDate}
            onChange={(e) => setFormData({ ...formData, borrowDate: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="returnDate" className="form-label">
            Expected Return Date <span className="required">*</span>
          </label>
          <input
            type="date"
            id="returnDate"
            className="form-input"
            value={formData.returnDate}
            onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
            min={formData.borrowDate || new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EquipmentBorrowingPage;

