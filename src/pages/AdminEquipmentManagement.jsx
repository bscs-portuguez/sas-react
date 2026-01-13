import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById, getAllOrganizationsForAdmin } from "../services/organizationService";
import { getAllEquipment, getAllBorrowRequests, getAllActiveBorrows, getAllReturnedBorrows, approveBorrowRequest, rejectBorrowRequest, returnEquipment, calculateAvailability, addEquipment, updateEquipment, getEquipmentById } from "../services/equipmentService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminEquipmentManagement.css";

const AdminEquipmentManagement = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [activeBorrows, setActiveBorrows] = useState([]);
  const [historyItems, setHistoryItems] = useState([]); // Contains both rejected requests and returned transactions
  const [organizations, setOrganizations] = useState([]);
  const [view, setView] = useState("inventory"); // "inventory" | "requests" | "borrowed" | "history"
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedBorrow, setSelectedBorrow] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [equipmentFormData, setEquipmentFormData] = useState({
    name: "",
    category: "",
    totalQuantity: "",
    condition: "",
    location: "",
    description: "",
    specifications: ""
  });
  
  // Filter states for Borrow Requests
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [requestOrgTypeFilter, setRequestOrgTypeFilter] = useState("all");
  const [requestOrgNameFilter, setRequestOrgNameFilter] = useState("all");
  const [requestMonthFilter, setRequestMonthFilter] = useState("all");
  const [requestYearFilter, setRequestYearFilter] = useState("all");
  
  // Filter states for Active Borrows
  const [borrowStatusFilter, setBorrowStatusFilter] = useState("all"); // "all" | "dueToday" | "pastDue"
  const [borrowSearchQuery, setBorrowSearchQuery] = useState("");
  const [borrowOrgTypeFilter, setBorrowOrgTypeFilter] = useState("all");
  const [borrowOrgNameFilter, setBorrowOrgNameFilter] = useState("all");
  const [borrowMonthFilter, setBorrowMonthFilter] = useState("all");
  const [borrowYearFilter, setBorrowYearFilter] = useState("all");
  
  // Filter states for History
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all"); // "all" | "rejected" | "returned"
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyOrgTypeFilter, setHistoryOrgTypeFilter] = useState("all");
  const [historyOrgNameFilter, setHistoryOrgNameFilter] = useState("all");
  const [historyMonthFilter, setHistoryMonthFilter] = useState("all");
  const [historyYearFilter, setHistoryYearFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        // Load organizations for filters
        const orgs = await getAllOrganizationsForAdmin();
        setOrganizations(orgs);

        await loadData();
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [equipList, requests, borrows, returned] = await Promise.all([
        getAllEquipment(),
        getAllBorrowRequests(),
        getAllActiveBorrows(),
        getAllReturnedBorrows()
      ]);
      
      // Enrich equipment with calculated availability
      const enrichedEquipment = await Promise.all(
        equipList.map(async (item) => {
          try {
            const availability = await calculateAvailability(item.equipmentId);
            return {
              ...item,
              availableQuantity: availability.available,
              borrowedQuantity: availability.borrowed
            };
          } catch (error) {
            console.error(`Error calculating availability for ${item.equipmentId}:`, error);
            return {
              ...item,
              availableQuantity: item.totalQuantity || 0,
              borrowedQuantity: 0
            };
          }
        })
      );
      setEquipment(enrichedEquipment);
      
      // Enrich requests with organization names
      const enrichedRequests = await enrichRequestsWithDetails(requests);
      setBorrowRequests(enrichedRequests);
      
      // Get rejected requests and returned transactions for history
      const rejected = enrichedRequests.filter(req => req.status === "rejected");
      const enrichedReturned = await enrichBorrowsWithDetails(returned);
      
      // Combine rejected requests and returned transactions for history
      // Mark rejected requests with type "rejected" and returned transactions with type "returned"
      const history = [
        ...rejected.map(req => ({ ...req, historyType: "rejected" })),
        ...enrichedReturned.map(trans => ({ ...trans, historyType: "returned" }))
      ];
      setHistoryItems(history);
      
      // Enrich active borrows with organization names
      const enrichedBorrows = await enrichBorrowsWithDetails(borrows);
      setActiveBorrows(enrichedBorrows);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load equipment data");
    } finally {
      setLoading(false);
    }
  };

  const enrichRequestsWithDetails = async (requests) => {
    const enriched = await Promise.all(
      requests.map(async (request) => {
        const enrichedRequest = { ...request };
        
        if (request.organizationId) {
          try {
            const organization = await getOrganizationById(request.organizationId);
            enrichedRequest.organizationName = organization?.name || request.organizationId;
          } catch (error) {
            console.error("Error fetching organization:", error);
            enrichedRequest.organizationName = request.organizationId;
          }
        }
        
        // Fetch requester information
        if (request.requestedBy) {
          try {
            const requester = await getUserById(request.requestedBy);
            enrichedRequest.requesterName = requester?.fullName || requester?.email || "Unknown";
            enrichedRequest.requesterEmail = requester?.email || "";
          } catch (error) {
            console.error("Error fetching requester:", error);
            enrichedRequest.requesterName = "Unknown";
            enrichedRequest.requesterEmail = "";
          }
        }
        
        return enrichedRequest;
      })
    );
    
    return enriched;
  };

  const enrichBorrowsWithDetails = async (borrows) => {
    const enriched = await Promise.all(
      borrows.map(async (borrow) => {
        const enrichedBorrow = { ...borrow };
        
        if (borrow.organizationId) {
          try {
            const organization = await getOrganizationById(borrow.organizationId);
            enrichedBorrow.organizationName = organization?.name || borrow.organizationId;
          } catch (error) {
            console.error("Error fetching organization:", error);
            enrichedBorrow.organizationName = borrow.organizationId;
          }
        }
        
        // Fetch requester information
        if (borrow.requestedBy) {
          try {
            const requester = await getUserById(borrow.requestedBy);
            enrichedBorrow.requesterName = requester?.fullName || requester?.email || "Unknown";
            enrichedBorrow.requesterEmail = requester?.email || "";
          } catch (error) {
            console.error("Error fetching requester:", error);
            enrichedBorrow.requesterName = "Unknown";
            enrichedBorrow.requesterEmail = "";
          }
        }
        
        return enrichedBorrow;
      })
    );
    
    return enriched;
  };

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
      overdue: "status-badge-overdue"
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
      overdue: "Overdue"
    };
    return statusLabels[status] || status;
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;

    try {
      setLoading(true);
      setError("");
      await approveBorrowRequest(selectedRequest.requestId, auth.currentUser.uid, remarks);
      setSuccess("Borrow request approved successfully");
      setShowRequestModal(false);
      setSelectedRequest(null);
      setRemarks("");
      await loadData();
    } catch (error) {
      setError(error.message || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    try {
      setLoading(true);
      setError("");
      await rejectBorrowRequest(selectedRequest.requestId, auth.currentUser.uid, remarks);
      setSuccess("Borrow request rejected");
      setShowRequestModal(false);
      setSelectedRequest(null);
      setRemarks("");
      await loadData();
    } catch (error) {
      setError(error.message || "Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReturned = async () => {
    if (!selectedBorrow) return;

    try {
      setLoading(true);
      setError("");
      await returnEquipment(selectedBorrow.transactionId, auth.currentUser.uid, "");
      setSuccess("Equipment marked as returned");
      setShowBorrowModal(false);
      setSelectedBorrow(null);
      await loadData();
    } catch (error) {
      setError(error.message || "Failed to mark equipment as returned");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEquipment = () => {
    setSelectedEquipment(null);
    setEquipmentFormData({
      name: "",
      category: "",
      totalQuantity: "",
      condition: "",
      location: ""
    });
    setShowEquipmentModal(true);
  };

  const handleEditEquipment = async (equipmentId) => {
    try {
      setLoading(true);
      const equipmentItem = await getEquipmentById(equipmentId);
      if (equipmentItem) {
        // Calculate borrowed quantity
        const availability = await calculateAvailability(equipmentId);
        const borrowedQuantity = availability.borrowed || 0;
        
        setSelectedEquipment({
          ...equipmentItem,
          borrowedQuantity: borrowedQuantity
        });
        setEquipmentFormData({
          name: equipmentItem.name || "",
          category: equipmentItem.category || "",
          totalQuantity: equipmentItem.totalQuantity || "",
          condition: equipmentItem.condition || "",
          location: equipmentItem.location || "",
          description: equipmentItem.description || "",
          specifications: equipmentItem.specifications || ""
        });
        setShowEquipmentModal(true);
      }
    } catch (error) {
      setError("Failed to load equipment details");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEquipment = async () => {
    if (!equipmentFormData.name.trim()) {
      setError("Equipment name is required");
      return;
    }

    if (!equipmentFormData.category) {
      setError("Category is required");
      return;
    }

    const newQuantity = parseInt(equipmentFormData.totalQuantity) || 0;
    if (newQuantity < 0) {
      setError("Total quantity must be a positive number");
      return;
    }

    // Check if equipment is in use and validate quantity
    if (selectedEquipment && selectedEquipment.borrowedQuantity > 0) {
      if (newQuantity < selectedEquipment.borrowedQuantity) {
        setError(`Cannot set quantity to ${newQuantity}. There are ${selectedEquipment.borrowedQuantity} items currently borrowed. Minimum quantity must be ${selectedEquipment.borrowedQuantity}.`);
        return;
      }
    }

    try {
      setLoading(true);
      setError("");
      
      const equipmentData = {
        name: equipmentFormData.name.trim(),
        category: equipmentFormData.category.trim(),
        totalQuantity: parseInt(equipmentFormData.totalQuantity) || 0,
        condition: equipmentFormData.condition.trim() || null,
        location: equipmentFormData.location.trim() || null,
        description: equipmentFormData.description.trim() || null,
        specifications: equipmentFormData.specifications.trim() || null
      };

      if (selectedEquipment) {
        // Update existing equipment
        await updateEquipment(selectedEquipment.equipmentId, equipmentData, auth.currentUser.uid);
        setSuccess("Equipment updated successfully");
      } else {
        // Add new equipment
        await addEquipment(equipmentData, auth.currentUser.uid);
        setSuccess("Equipment added successfully");
      }

      setShowEquipmentModal(false);
      setSelectedEquipment(null);
      setEquipmentFormData({
        name: "",
        category: "",
        totalQuantity: "",
        condition: "",
        location: "",
        description: "",
        specifications: ""
      });
      await loadData();
    } catch (error) {
      setError(error.message || "Failed to save equipment");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    return "N/A";
  };

  // Filter functions
  const filterRequests = (requests) => {
    let filtered = [...requests];

    // Filter by search query (equipment name)
    if (requestSearchQuery.trim()) {
      const query = requestSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((req) => {
        const equipmentName = (req.equipmentName || "").toLowerCase();
        return equipmentName.includes(query);
      });
    }

    // Filter by organization type
    if (requestOrgTypeFilter !== "all") {
      filtered = filtered.filter((req) => {
        const org = organizations.find((o) => o.organizationId === req.organizationId);
        return org && org.type === requestOrgTypeFilter;
      });
    }

    // Filter by organization name
    if (requestOrgNameFilter !== "all") {
      filtered = filtered.filter((req) => req.organizationId === requestOrgNameFilter);
    }

    // Filter by month
    if (requestMonthFilter !== "all") {
      const month = parseInt(requestMonthFilter);
      filtered = filtered.filter((req) => {
        if (!req.dateRequested) return false;
        const date = req.dateRequested.toDate ? req.dateRequested.toDate() : new Date(req.dateRequested);
        return date.getMonth() + 1 === month;
      });
    }

    // Filter by year
    if (requestYearFilter !== "all") {
      const year = parseInt(requestYearFilter);
      filtered = filtered.filter((req) => {
        if (!req.dateRequested) return false;
        const date = req.dateRequested.toDate ? req.dateRequested.toDate() : new Date(req.dateRequested);
        return date.getFullYear() === year;
      });
    }

    return filtered;
  };

  const filterBorrows = (borrows) => {
    let filtered = [...borrows];

    // Filter by status (due date)
    if (borrowStatusFilter !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter((borrow) => {
        if (!borrow.expectedReturnDate) return false;
        const returnDate = borrow.expectedReturnDate.toDate ? borrow.expectedReturnDate.toDate() : new Date(borrow.expectedReturnDate);
        const returnDateOnly = new Date(returnDate);
        returnDateOnly.setHours(0, 0, 0, 0);

        if (borrowStatusFilter === "dueToday") {
          return returnDateOnly.getTime() === today.getTime();
        } else if (borrowStatusFilter === "pastDue") {
          return returnDateOnly.getTime() < today.getTime();
        }
        return true;
      });
    }

    // Filter by search query (equipment name)
    if (borrowSearchQuery.trim()) {
      const query = borrowSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((borrow) => {
        const equipmentName = (borrow.equipmentName || "").toLowerCase();
        return equipmentName.includes(query);
      });
    }

    // Filter by organization type
    if (borrowOrgTypeFilter !== "all") {
      filtered = filtered.filter((borrow) => {
        const org = organizations.find((o) => o.organizationId === borrow.organizationId);
        return org && org.type === borrowOrgTypeFilter;
      });
    }

    // Filter by organization name
    if (borrowOrgNameFilter !== "all") {
      filtered = filtered.filter((borrow) => borrow.organizationId === borrowOrgNameFilter);
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
  };

  const filterHistory = (history) => {
    let filtered = [...history];

    // Filter by history type (rejected/returned)
    if (historyTypeFilter !== "all") {
      filtered = filtered.filter((item) => item.historyType === historyTypeFilter);
    }

    // Filter by search query (equipment name)
    if (historySearchQuery.trim()) {
      const query = historySearchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const equipmentName = (item.equipmentName || "").toLowerCase();
        return equipmentName.includes(query);
      });
    }

    // Filter by organization type
    if (historyOrgTypeFilter !== "all") {
      filtered = filtered.filter((item) => {
        const org = organizations.find((o) => o.organizationId === item.organizationId);
        return org && org.type === historyOrgTypeFilter;
      });
    }

    // Filter by organization name
    if (historyOrgNameFilter !== "all") {
      filtered = filtered.filter((item) => item.organizationId === historyOrgNameFilter);
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
  };

  // Get unique organization types
  const orgTypes = ["all", ...new Set(organizations.map((org) => org.type).filter(Boolean))];
  
  // Get organizations filtered by type for dropdowns
  const getFilteredOrgsForDropdown = (orgTypeFilter) => {
    return orgTypeFilter === "all" 
      ? organizations 
      : organizations.filter((org) => org.type === orgTypeFilter);
  };

  // Get available years and months from data
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

  // Get filtered data
  // Only show pending requests in Borrow Requests tab (not approved or rejected)
  const filteredBorrowRequests = filterRequests(borrowRequests.filter(req => req.status === "pending"));
  const filteredActiveBorrows = filterBorrows(activeBorrows);
  const filteredHistoryItems = filterHistory(historyItems);
  
  // Filter out equipment where quantity is 0 AND available is 0
  const visibleEquipment = equipment.filter(item => 
    !(item.totalQuantity === 0 && item.availableQuantity === 0)
  );

  // Removed early return - loading will be shown inside AdminLayout

  return (
    <AdminLayout userData={userData} currentPage="equipment">
      {loading && !equipment.length ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-equipment-management">
        <div className="admin-equipment-header">
          <h1 className="admin-equipment-title">Equipment Management</h1>
          <div className="view-tabs">
            <button
              className={`tab-btn ${view === "inventory" ? "active" : ""}`}
              onClick={() => setView("inventory")}
            >
              Inventory
            </button>
            <button
              className={`tab-btn ${view === "requests" ? "active" : ""}`}
              onClick={() => setView("requests")}
            >
              Borrow Requests ({borrowRequests.filter(req => req.status === "pending").length})
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

        {error && (
          <div className="admin-equipment-alert admin-equipment-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-equipment-alert admin-equipment-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        {view === "inventory" && (
          <div className="equipment-inventory">
            <div className="inventory-header">
              <h2>Equipment Inventory</h2>
              <button className="btn-add-equipment" onClick={handleAddEquipment}>+ Add Equipment</button>
            </div>
            {visibleEquipment.length === 0 ? (
              <div className="empty-state">
                <p>No equipment in inventory</p>
              </div>
            ) : (
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Total Quantity</th>
                    <th>Available</th>
                    <th>Condition</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEquipment.map((item) => (
                    <tr key={item.equipmentId}>
                      <td>{item.name}</td>
                      <td>{item.category || "—"}</td>
                      <td>{item.totalQuantity || 0}</td>
                      <td>{item.availableQuantity || 0}</td>
                      <td>{item.condition || "—"}</td>
                      <td>{item.location || "—"}</td>
                      <td>
                        <button 
                          className="action-button action-button-view"
                          onClick={() => handleEditEquipment(item.equipmentId)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "requests" && (
          <div className="borrow-requests">
            <h2>Borrow Requests</h2>
            
            {/* Filters */}
            <div className="admin-equipment-filters">
              <div className="filters-row">
                <div className="filter-group">
                  <label htmlFor="request-search" className="filter-label">Search</label>
                  <input
                    id="request-search"
                    type="text"
                    className="filter-input"
                    placeholder="Search by equipment name..."
                    value={requestSearchQuery}
                    onChange={(e) => setRequestSearchQuery(e.target.value)}
                  />
                </div>
                <div className="filter-group filter-group-small">
                  <label htmlFor="request-org-type" className="filter-label">Org. Type</label>
                  <select
                    id="request-org-type"
                    className="filter-select"
                    value={requestOrgTypeFilter}
                    onChange={(e) => {
                      setRequestOrgTypeFilter(e.target.value);
                      setRequestOrgNameFilter("all");
                    }}
                  >
                    <option value="all">All Types</option>
                    {orgTypes.filter((type) => type !== "all").map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group filter-group-org-name">
                  <label htmlFor="request-org-name" className="filter-label">Org. Name</label>
                  <select
                    id="request-org-name"
                    className="filter-select"
                    value={requestOrgNameFilter}
                    onChange={(e) => setRequestOrgNameFilter(e.target.value)}
                  >
                    <option value="all">All Organizations</option>
                    {getFilteredOrgsForDropdown(requestOrgTypeFilter).map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.name}
                      </option>
                    ))}
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

            {filteredBorrowRequests.length === 0 ? (
              <div className="empty-state">
                <p>No borrow requests found</p>
              </div>
            ) : (
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Equipment</th>
                    <th>Borrower</th>
                    <th>Quantity</th>
                    <th>Purpose</th>
                    <th>Borrow Date</th>
                    <th>Return Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBorrowRequests.map((request) => (
                    <tr key={request.requestId}>
                      <td>{request.equipmentName || "N/A"}</td>
                      <td>{request.organizationName || request.organizationId}</td>
                      <td>{request.quantity}</td>
                      <td className="table-purpose">{request.purpose || "—"}</td>
                      <td>{formatDate(request.borrowDate)}</td>
                      <td>{formatDate(request.expectedReturnDate)}</td>
                      <td>
                        <div className="table-actions">
                          <button 
                            className="action-button action-button-view"
                            onClick={() => {
                              setSelectedRequest(request);
                              setRemarks("");
                              setShowRequestModal(true);
                            }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "borrowed" && (
          <div className="active-borrows">
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <h2>Active Borrows</h2>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="borrowStatus"
                    value="all"
                    checked={borrowStatusFilter === "all"}
                    onChange={(e) => setBorrowStatusFilter(e.target.value)}
                  />
                  <span>All</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="borrowStatus"
                    value="dueToday"
                    checked={borrowStatusFilter === "dueToday"}
                    onChange={(e) => setBorrowStatusFilter(e.target.value)}
                  />
                  <span>Due Today</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="borrowStatus"
                    value="pastDue"
                    checked={borrowStatusFilter === "pastDue"}
                    onChange={(e) => setBorrowStatusFilter(e.target.value)}
                  />
                  <span>Past Due</span>
                </label>
              </div>
            </div>
            
            {/* Filters */}
            <div className="admin-equipment-filters">
              <div className="filters-row">
                <div className="filter-group">
                  <label htmlFor="borrow-search" className="filter-label">Search</label>
                  <input
                    id="borrow-search"
                    type="text"
                    className="filter-input"
                    placeholder="Search by equipment name..."
                    value={borrowSearchQuery}
                    onChange={(e) => setBorrowSearchQuery(e.target.value)}
                  />
                </div>
                <div className="filter-group filter-group-small">
                  <label htmlFor="borrow-org-type" className="filter-label">Org. Type</label>
                  <select
                    id="borrow-org-type"
                    className="filter-select"
                    value={borrowOrgTypeFilter}
                    onChange={(e) => {
                      setBorrowOrgTypeFilter(e.target.value);
                      setBorrowOrgNameFilter("all");
                    }}
                  >
                    <option value="all">All Types</option>
                    {orgTypes.filter((type) => type !== "all").map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group filter-group-org-name">
                  <label htmlFor="borrow-org-name" className="filter-label">Org. Name</label>
                  <select
                    id="borrow-org-name"
                    className="filter-select"
                    value={borrowOrgNameFilter}
                    onChange={(e) => setBorrowOrgNameFilter(e.target.value)}
                  >
                    <option value="all">All Organizations</option>
                    {getFilteredOrgsForDropdown(borrowOrgTypeFilter).map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.name}
                      </option>
                    ))}
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

            {filteredActiveBorrows.length === 0 ? (
              <div className="empty-state">
                <p>No active borrows found</p>
              </div>
            ) : (
              <table className="borrowed-table">
                <thead>
                  <tr>
                    <th>Equipment</th>
                    <th>Borrower</th>
                    <th>Quantity</th>
                    <th>Borrow Date</th>
                    <th>Return Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActiveBorrows.map((borrow) => (
                    <tr key={borrow.transactionId} className={borrow.status === "overdue" ? "row-overdue" : ""}>
                      <td>{borrow.equipmentName || "N/A"}</td>
                      <td>{borrow.organizationName || borrow.organizationId}</td>
                      <td>{borrow.quantity}</td>
                      <td>{formatDate(borrow.borrowDate)}</td>
                      <td>
                        {formatDate(borrow.expectedReturnDate)}
                        {borrow.status === "overdue" && <span className="overdue-badge">Overdue</span>}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button 
                            className="action-button action-button-view"
                            onClick={() => {
                              setSelectedBorrow(borrow);
                              setShowBorrowModal(true);
                            }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "history" && (
          <div className="history-section">
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <h2>History</h2>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="historyType"
                    value="all"
                    checked={historyTypeFilter === "all"}
                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  />
                  <span>All</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="historyType"
                    value="rejected"
                    checked={historyTypeFilter === "rejected"}
                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  />
                  <span>Rejected</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="historyType"
                    value="returned"
                    checked={historyTypeFilter === "returned"}
                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  />
                  <span>Returned</span>
                </label>
              </div>
            </div>
            
            {/* Filters */}
            <div className="admin-equipment-filters">
              <div className="filters-row">
                <div className="filter-group">
                  <label htmlFor="history-search" className="filter-label">Search</label>
                  <input
                    id="history-search"
                    type="text"
                    className="filter-input"
                    placeholder="Search by equipment name..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                  />
                </div>
                <div className="filter-group filter-group-small">
                  <label htmlFor="history-org-type" className="filter-label">Org. Type</label>
                  <select
                    id="history-org-type"
                    className="filter-select"
                    value={historyOrgTypeFilter}
                    onChange={(e) => {
                      setHistoryOrgTypeFilter(e.target.value);
                      setHistoryOrgNameFilter("all");
                    }}
                  >
                    <option value="all">All Types</option>
                    {orgTypes.filter((type) => type !== "all").map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group filter-group-org-name">
                  <label htmlFor="history-org-name" className="filter-label">Org. Name</label>
                  <select
                    id="history-org-name"
                    className="filter-select"
                    value={historyOrgNameFilter}
                    onChange={(e) => setHistoryOrgNameFilter(e.target.value)}
                  >
                    <option value="all">All Organizations</option>
                    {getFilteredOrgsForDropdown(historyOrgTypeFilter).map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.name}
                      </option>
                    ))}
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

            {filteredHistoryItems.length === 0 ? (
              <div className="empty-state">
                <p>No history items found</p>
              </div>
            ) : (
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Equipment</th>
                    <th>Borrower</th>
                    <th>Quantity</th>
                    <th>Purpose</th>
                    <th>Borrow Date</th>
                    <th>Return Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryItems.map((item) => (
                    <tr key={item.historyType === "rejected" ? item.requestId : item.transactionId}>
                      <td>
                        <span className={`status-badge ${item.historyType === "rejected" ? "status-badge-rejected" : "status-badge-returned"}`}>
                          {item.historyType === "rejected" ? "Rejected" : "Returned"}
                        </span>
                      </td>
                      <td>{item.equipmentName || "N/A"}</td>
                      <td>{item.organizationName || item.organizationId}</td>
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
                        <div className="table-actions">
                          <button 
                            className="action-button action-button-view"
                            onClick={() => {
                              if (item.historyType === "rejected") {
                                setSelectedRequest(item);
                                setRemarks("");
                                setShowRequestModal(true);
                              } else {
                                setSelectedBorrow(item);
                                setShowBorrowModal(true);
                              }
                            }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Borrow Request Detail Modal */}
        {showRequestModal && selectedRequest && (
          <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Borrow Request Details</h3>
                <button className="modal-close" onClick={() => setShowRequestModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">Equipment:</span>
                    <span className="info-value">{selectedRequest.equipmentName || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Organization:</span>
                    <span className="info-value">{selectedRequest.organizationName || selectedRequest.organizationId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Requested By:</span>
                    <span className="info-value">
                      {selectedRequest.requesterName || "Unknown"}
                      {selectedRequest.requesterEmail && ` (${selectedRequest.requesterEmail})`}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Quantity:</span>
                    <span className="info-value">{selectedRequest.quantity}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Purpose:</span>
                    <span className="info-value">{selectedRequest.purpose || "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Borrow Date:</span>
                    <span className="info-value">{formatDate(selectedRequest.borrowDate)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Expected Return Date:</span>
                    <span className="info-value">{formatDate(selectedRequest.expectedReturnDate)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedRequest.status)}`}>
                      {getStatusLabel(selectedRequest.status)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date Requested:</span>
                    <span className="info-value">{formatDateTime(selectedRequest.dateRequested)}</span>
                  </div>
                  {selectedRequest.adminRemarks && (
                    <div className="info-row-full">
                      <span className="info-label">Admin Remarks:</span>
                      <p className="info-remarks">{selectedRequest.adminRemarks}</p>
                    </div>
                  )}
                  {selectedRequest.rejectionReason && (
                    <div className="info-row-full">
                      <span className="info-label">Rejection Reason:</span>
                      <p className="info-remarks">{selectedRequest.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {selectedRequest.status === "pending" && (
                  <div className="modal-actions-section">
                    <div className="form-group">
                      <label htmlFor="remarks-input">Remarks</label>
                      <textarea
                        id="remarks-input"
                        className="form-input form-textarea"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={4}
                        placeholder="Enter remarks (optional)"
                      />
                    </div>
                    <div className="modal-actions">
                      <button 
                        className="form-button form-button-secondary" 
                        onClick={() => {
                          setShowRequestModal(false);
                          setSelectedRequest(null);
                          setRemarks("");
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="form-button form-button-reject" 
                        onClick={handleRejectRequest}
                        disabled={loading}
                      >
                        Reject
                      </button>
                      <button 
                        className="form-button form-button-primary" 
                        onClick={handleApproveRequest}
                        disabled={loading}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active Borrow Detail Modal */}
        {showBorrowModal && selectedBorrow && (
          <div className="modal-overlay" onClick={() => setShowBorrowModal(false)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Active Borrow Details</h3>
                <button className="modal-close" onClick={() => setShowBorrowModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">Equipment:</span>
                    <span className="info-value">{selectedBorrow.equipmentName || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Organization:</span>
                    <span className="info-value">{selectedBorrow.organizationName || selectedBorrow.organizationId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Requested By:</span>
                    <span className="info-value">
                      {selectedBorrow.requesterName || "Unknown"}
                      {selectedBorrow.requesterEmail && ` (${selectedBorrow.requesterEmail})`}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Quantity:</span>
                    <span className="info-value">{selectedBorrow.quantity}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Purpose:</span>
                    <span className="info-value">{selectedBorrow.purpose || "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Borrow Date:</span>
                    <span className="info-value">{formatDate(selectedBorrow.borrowDate)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Expected Return Date:</span>
                    <span className="info-value">
                      {formatDate(selectedBorrow.expectedReturnDate)}
                      {selectedBorrow.status === "overdue" && <span className="overdue-badge" style={{marginLeft: "0.5rem"}}>Overdue</span>}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedBorrow.status)}`}>
                      {getStatusLabel(selectedBorrow.status)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date Borrowed:</span>
                    <span className="info-value">{formatDateTime(selectedBorrow.dateBorrowed)}</span>
                  </div>
                  {selectedBorrow.adminRemarks && (
                    <div className="info-row-full">
                      <span className="info-label">Admin Remarks:</span>
                      <p className="info-remarks">{selectedBorrow.adminRemarks}</p>
                    </div>
                  )}
                </div>

                <div className="modal-actions-section">
                  <div className="modal-actions">
                    <button 
                      className="form-button form-button-secondary" 
                      onClick={() => {
                        setShowBorrowModal(false);
                        setSelectedBorrow(null);
                        setReturnConditionNotes("");
                      }}
                    >
                      Close
                    </button>
                    <button 
                      className="form-button form-button-primary" 
                      onClick={handleMarkReturned}
                      disabled={loading}
                    >
                      Mark Returned
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Equipment Form Modal */}
        {showEquipmentModal && (
          <div className="modal-overlay" onClick={() => setShowEquipmentModal(false)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedEquipment ? "Edit Equipment" : "Add Equipment"}</h3>
                <button className="modal-close" onClick={() => setShowEquipmentModal(false)}>×</button>
              </div>
              <div className="modal-body">
                {selectedEquipment && selectedEquipment.borrowedQuantity > 0 && (
                  <div className="admin-equipment-alert" style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#fff3cd", color: "#856404", borderRadius: "6px" }}>
                    <strong>Note:</strong> This equipment is currently in use ({selectedEquipment.borrowedQuantity} item{selectedEquipment.borrowedQuantity > 1 ? "s" : ""} borrowed). Only quantity can be edited.
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="equipment-name">Equipment Name *</label>
                  <input
                    id="equipment-name"
                    type="text"
                    className="form-input"
                    value={equipmentFormData.name}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, name: e.target.value })}
                    placeholder="Enter equipment name"
                    required
                    disabled={selectedEquipment && selectedEquipment.borrowedQuantity > 0}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="equipment-category">Category *</label>
                  <select
                    id="equipment-category"
                    className="form-input"
                    value={equipmentFormData.category}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, category: e.target.value })}
                    required
                    disabled={selectedEquipment && selectedEquipment.borrowedQuantity > 0}
                  >
                    <option value="">Select category</option>
                    <option value="audio_visual">Audio Visual</option>
                    <option value="furniture">Furniture</option>
                    <option value="electronics">Electronics</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="equipment-quantity">Total Quantity *</label>
                  <input
                    id="equipment-quantity"
                    type="number"
                    className="form-input"
                    value={equipmentFormData.totalQuantity}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, totalQuantity: e.target.value })}
                    placeholder="Enter total quantity"
                    min={selectedEquipment && selectedEquipment.borrowedQuantity > 0 ? selectedEquipment.borrowedQuantity : 0}
                    required
                  />
                  {selectedEquipment && selectedEquipment.borrowedQuantity > 0 && (
                    <small style={{ display: "block", marginTop: "0.25rem", color: "#666" }}>
                      Minimum: {selectedEquipment.borrowedQuantity} (currently borrowed)
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="equipment-condition">Condition</label>
                  <input
                    id="equipment-condition"
                    type="text"
                    className="form-input"
                    value={equipmentFormData.condition}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, condition: e.target.value })}
                    placeholder="Enter condition (optional)"
                    disabled={selectedEquipment && selectedEquipment.borrowedQuantity > 0}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="equipment-location">Location</label>
                  <input
                    id="equipment-location"
                    type="text"
                    className="form-input"
                    value={equipmentFormData.location}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, location: e.target.value })}
                    placeholder="Enter location (optional)"
                    disabled={selectedEquipment && selectedEquipment.borrowedQuantity > 0}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="equipment-description">Description</label>
                  <textarea
                    id="equipment-description"
                    className="form-input form-textarea"
                    value={equipmentFormData.description}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, description: e.target.value })}
                    placeholder="Enter description (optional)"
                    rows={4}
                    disabled={selectedEquipment && selectedEquipment.borrowedQuantity > 0}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="equipment-specifications">Specifications</label>
                  <textarea
                    id="equipment-specifications"
                    className="form-input form-textarea"
                    value={equipmentFormData.specifications}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, specifications: e.target.value })}
                    placeholder="Enter specifications (optional)"
                    rows={4}
                    disabled={selectedEquipment && selectedEquipment.borrowedQuantity > 0}
                  />
                </div>
                <div className="modal-actions-section">
                  <div className="modal-actions">
                    <button 
                      className="form-button form-button-secondary" 
                      onClick={() => {
                        setShowEquipmentModal(false);
                        setSelectedEquipment(null);
                        setEquipmentFormData({
                          name: "",
                          category: "",
                          totalQuantity: "",
                          condition: "",
                          location: "",
                          description: "",
                          specifications: ""
                        });
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className="form-button form-button-primary" 
                      onClick={handleSaveEquipment}
                      disabled={loading}
                    >
                      {selectedEquipment ? "Update" : "Add"} Equipment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminEquipmentManagement;

