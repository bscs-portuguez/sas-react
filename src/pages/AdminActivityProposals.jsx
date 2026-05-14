import { useState, useEffect, useRef } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import {
  getOrganizationById,
  getAllOrganizationsForAdmin,
} from "../services/organizationService";
import {
  searchDocuments,
  getDocumentStatusHistory,
  completeSASReview,
  returnFromSAS,
  releaseFromSASToISG,
  markProposalFileViewed,
} from "../services/documentService";
import { getAllOfficeProfiles } from "../services/officeService";
import { sendReviewLinkEmail } from "../services/emailService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import DocumentPreviewModal from "../components/documents/DocumentPreviewModal";
import { subscribeToCommentSummary } from "../services/commentService";
import {
  formatDate,
  formatDateTime,
  getStatusBadgeClass,
  getStatusLabel,
} from "../utils/formatters";
import { REQUIREMENT_LABELS } from "../utils/proposalConstants";
import "../styles/colors.css";
import "./AdminActivityProposals.css";

const STAGE_LABELS = {
  sas_review: "SAS Review",
  vpaa_review: "VPAA Review",
  op_approval: "OP Approval",
  fms_review: "FMS Review",
  procurement_review: "Procurement Review",
  sas_release: "SAS Release",
  isg_distribution: "ISG Distribution",
};

const STAGE_TABS = [
  { id: "sas_review", label: "SAS Review" },
  { id: "vpaa_review", label: "VPAA Review" },
  { id: "op_approval", label: "OP Approval" },
  { id: "fms_review", label: "FMS Review" },
  { id: "procurement_review", label: "Procurement Review" },
  { id: "sas_release", label: "SAS Release" },
  { id: "isg_distribution", label: "ISG Distribution" },
  { id: "completed", label: "Completed" },
  { id: "returned", label: "Returned" },
];

const getStageLabel = (stage) =>
  STAGE_LABELS[stage] || (stage ? stage.replace(/_/g, " ") : "—");

const AdminActivityProposals = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [enrichedProposals, setEnrichedProposals] = useState([]);
  const [filteredProposals, setFilteredProposals] = useState([]);
  const [activeTab, setActiveTab] = useState("sas_review");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState("all");
  const [orgNameFilter, setOrgNameFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [organizations, setOrganizations] = useState([]);

  // Office profiles
  const [vpaaProfile, setVpaaProfile] = useState(null);
  const [opProfile, setOpProfile] = useState(null);
  const [fmsProfile, setFmsProfile] = useState(null);
  const [procurementProfile, setProcurementProfile] = useState(null);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedProposalHistory, setSelectedProposalHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [commentSummary, setCommentSummary] = useState({ unresolvedReviewerTotal: 0, byRequirement: {} });
  const unresolvedReviewerCount = commentSummary.unresolvedReviewerTotal;

  useEffect(() => {
    if (!selectedProposal?.documentId) {
      setCommentSummary({ unresolvedReviewerTotal: 0, byRequirement: {} });
      return;
    }
    const unsub = subscribeToCommentSummary(selectedProposal.documentId, setCommentSummary);
    return () => unsub?.();
  }, [selectedProposal?.documentId]);

  // Forward to VPAA modal
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [endorsementFile, setEndorsementFile] = useState(null);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardError, setForwardError] = useState("");

  // Return to org modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState("");

  // Release to ISG (sas_release stage)
  const [releaseLoading, setReleaseLoading] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const [userDoc, orgs, officeProfiles] = await Promise.all([
          getUserById(user.uid),
          getAllOrganizationsForAdmin(),
          getAllOfficeProfiles(),
        ]);
        setUserData(userDoc);
        setOrganizations(orgs);
        const vpaa = officeProfiles.find(
          (p) => p.officeId === "vpaa" || p.type === "vpaa"
        );
        const op = officeProfiles.find(
          (p) => p.officeId === "op" || p.type === "op"
        );
        const fms = officeProfiles.find(
          (p) => p.officeId === "fms" || p.type === "fms"
        );
        const procurement = officeProfiles.find(
          (p) => p.officeId === "procurement" || p.type === "procurement"
        );
        setVpaaProfile(vpaa || null);
        setOpProfile(op || null);
        setFmsProfile(fms || null);
        setProcurementProfile(procurement || null);
        await loadProposals();
      } catch (err) {
        console.error("Error initializing:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedProposals, activeTab, searchQuery, orgTypeFilter, orgNameFilter, dateFrom, dateTo]);

  const loadProposals = async () => {
    try {
      const docs = await searchDocuments({ documentType: "activity_proposal" });
      // SAS only sees proposals that have passed ISG assessment
      const visible = docs.filter(
        (d) => d.pipeline?.currentStage !== "isg_endorsement"
      );
      const enriched = await enrichProposalsWithDetails(visible);
      setEnrichedProposals(enriched);
    } catch (err) {
      console.error("Error loading proposals:", err);
      setError("Failed to load proposals");
    }
  };

  const applyFilters = () => {
    let filtered = [...enrichedProposals];

    if (activeTab !== "all") {
      if (activeTab === "completed") {
        filtered = filtered.filter(
          (p) => p.status === "approved" && !p.pipeline?.currentStage
        );
      } else if (activeTab === "returned") {
        filtered = filtered.filter((p) => p.status === "returned");
      } else {
        filtered = filtered.filter(
          (p) => p.pipeline?.currentStage === activeTab
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.submitterName || "").toLowerCase().includes(q)
      );
    }

    if (orgTypeFilter !== "all") {
      filtered = filtered.filter((p) => p.organizationType === orgTypeFilter);
    }

    if (orgNameFilter !== "all") {
      filtered = filtered.filter((p) => p.organizationId === orgNameFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((p) => {
        const d = p.dateSubmitted?.toDate
          ? p.dateSubmitted.toDate()
          : new Date(p.dateSubmitted);
        return d >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => {
        const d = p.dateSubmitted?.toDate
          ? p.dateSubmitted.toDate()
          : new Date(p.dateSubmitted);
        return d <= to;
      });
    }

    setFilteredProposals(filtered);
  };

  const enrichProposalsWithDetails = async (proposals) =>
    Promise.all(
      proposals.map(async (proposal) => {
        const enriched = { ...proposal };
        if (proposal.organizationId) {
          try {
            const org = await getOrganizationById(proposal.organizationId);
            enriched.organizationName = org?.name || proposal.organizationId;
            enriched.organizationType = org?.type || null;
          } catch {
            enriched.organizationName = proposal.organizationId;
          }
        }
        if (proposal.submittedBy) {
          try {
            const user = await getUserById(proposal.submittedBy);
            enriched.submitterName =
              user?.fullName || user?.email || "Unknown";
          } catch {
            enriched.submitterName = "Unknown";
          }
        }
        return enriched;
      })
    );

  const resolveOfficeName = (changedBy, stages) => {
    if (!changedBy) return null;
    let stage = null;
    if (
      changedBy === "vpaa_review" ||
      changedBy === "op_approval" ||
      changedBy === "fms_review" ||
      changedBy === "procurement_review"
    ) {
      stage = changedBy;
    } else if (changedBy.startsWith("token:")) {
      const tokenId = changedBy.slice("token:".length);
      const stageEntry = stages?.find((s) => s.token === tokenId);
      stage = stageEntry?.stage || null;
    }
    if (stage === "vpaa_review")
      return vpaaProfile?.email || vpaaProfile?.name || "VPAA";
    if (stage === "op_approval")
      return opProfile?.email || opProfile?.name || "Office of the President";
    if (stage === "fms_review")
      return fmsProfile?.email || fmsProfile?.name || "FMS";
    if (stage === "procurement_review")
      return procurementProfile?.email || procurementProfile?.name || "Procurement";
    return null;
  };

  const handleViewDetails = async (proposal) => {
    setSelectedProposal(proposal);
    setShowDetailModal(true);
    setShowForwardModal(false);
    setShowReturnModal(false);
    setLoadingDetail(true);
    try {
      const history = await getDocumentStatusHistory(proposal.documentId);
      const stages = proposal.pipeline?.stages || [];
      const enrichedHistory = await Promise.all(
        history.map(async (entry) => {
          if (entry.changedBy) {
            const officeName = resolveOfficeName(entry.changedBy, stages);
            if (officeName) {
              return { ...entry, changedByName: officeName };
            }
            try {
              const user = await getUserById(entry.changedBy);
              return {
                ...entry,
                changedByName: user?.fullName || user?.email || "Unknown",
              };
            } catch {
              return { ...entry, changedByName: "Unknown" };
            }
          }
          return { ...entry, changedByName: "Unknown" };
        })
      );
      setSelectedProposalHistory(enrichedHistory);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeAll = () => {
    setShowDetailModal(false);
    setShowForwardModal(false);
    setShowReturnModal(false);
    setSelectedProposal(null);
    setSelectedProposalHistory([]);
    setEndorsementFile(null);
    setForwardError("");
    setReturnRemarks("");
    setReturnError("");
  };

  const handleForwardToVPAA = async () => {
    if (!endorsementFile) {
      setForwardError("Please upload the endorsement letter before forwarding.");
      return;
    }
    const isPdf =
      endorsementFile.type === "application/pdf" ||
      endorsementFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setForwardError(
        "Only PDF files are accepted. Please export to PDF and re-upload."
      );
      return;
    }
    setForwardLoading(true);
    setForwardError("");
    try {
      const { tokenId } = await completeSASReview(
        selectedProposal.documentId,
        auth.currentUser.uid,
        endorsementFile
      );
      const reviewUrl = `${window.location.origin}/review?token=${tokenId}`;
      if (vpaaProfile?.email) {
        await sendReviewLinkEmail(
          vpaaProfile.email,
          selectedProposal.title,
          reviewUrl,
          vpaaProfile.name || "Vice President for Academic Affairs"
        );
      }
      setSuccess(
        vpaaProfile?.email
          ? "Forwarded to VPAA — review link sent to " + vpaaProfile.email
          : "Forwarded to VPAA — no VPAA email configured, link not sent"
      );
      closeAll();
      await loadProposals();
    } catch (err) {
      setForwardError(err.message || "Failed to forward to VPAA.");
    } finally {
      setForwardLoading(false);
    }
  };

  const handleReleaseToISG = async () => {
    if (!selectedProposal) return;
    setReleaseLoading(true);
    setError("");
    try {
      await releaseFromSASToISG(
        selectedProposal.documentId,
        auth.currentUser.uid
      );
      setSuccess(
        selectedProposal.submitterRole === "ISG"
          ? "ISG-submitted proposal approved."
          : "Proposal released — forwarded to ISG for distribution."
      );
      closeAll();
      await loadProposals();
    } catch (err) {
      setError(err.message || "Failed to release proposal to ISG.");
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleReturnToOrg = async () => {
    if (!returnRemarks.trim()) {
      setReturnError("Please provide a reason for returning the proposal.");
      return;
    }
    setReturnLoading(true);
    setReturnError("");
    try {
      await returnFromSAS(
        selectedProposal.documentId,
        auth.currentUser.uid,
        returnRemarks.trim()
      );
      setSuccess("Proposal returned to organization.");
      closeAll();
      await loadProposals();
    } catch (err) {
      setReturnError(err.message || "Failed to return proposal.");
    } finally {
      setReturnLoading(false);
    }
  };

  const orgTypes = [
    "all",
    ...new Set(organizations.map((o) => o.type).filter(Boolean)),
  ];
  const filteredOrgsForDropdown =
    orgTypeFilter === "all"
      ? organizations
      : organizations.filter((o) => o.type === orgTypeFilter);

  return (
    <AdminLayout userData={userData} currentPage="activity-proposals">
      {loading ? (
        <LoadingScreen compact />
      ) : (
        <div className="admin-activity-proposals">
          <div className="admin-proposals-header">
            <h1 className="admin-proposals-title">
              Activity Proposal Management
            </h1>
          </div>

          {/* Filters */}
          <div className="admin-proposals-filters">
            <div className="filters-row">
              <div className="filter-group">
                <label className="filter-label">Search</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search by title or proposer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-group filter-group-small">
                <label className="filter-label">Org. Type</label>
                <select
                  className="filter-select"
                  value={orgTypeFilter}
                  onChange={(e) => {
                    setOrgTypeFilter(e.target.value);
                    setOrgNameFilter("all");
                  }}
                >
                  <option value="all">All Types</option>
                  {orgTypes
                    .filter((t) => t !== "all")
                    .map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
              </div>
              <div className="filter-group filter-group-org-name">
                <label className="filter-label">Org. Name</label>
                <select
                  className="filter-select"
                  value={orgNameFilter}
                  onChange={(e) => setOrgNameFilter(e.target.value)}
                >
                  <option value="all">All Organizations</option>
                  {filteredOrgsForDropdown.map((o) => (
                    <option key={o.organizationId} value={o.organizationId}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group filter-group-date">
                <label className="filter-label">Date From</label>
                <input
                  type="date"
                  className="filter-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="filter-group filter-group-date">
                <label className="filter-label">Date To</label>
                <input
                  type="date"
                  className="filter-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="filters-actions">
              <button
                className="filter-clear-button"
                onClick={() => {
                  setSearchQuery("");
                  setOrgTypeFilter("all");
                  setOrgNameFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Pipeline Stage Tabs */}
          <div className="status-tabs">
            {STAGE_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`status-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="admin-proposals-alert admin-proposals-alert-error">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
          {success && (
            <div className="admin-proposals-alert admin-proposals-alert-success">
              {success}
              <button onClick={() => setSuccess("")}>×</button>
            </div>
          )}

          {/* Table */}
          <div className="admin-proposals-list">
            {filteredProposals.length === 0 ? (
              <div className="admin-proposals-empty">
                <p>No proposals found for this stage</p>
              </div>
            ) : (
              <table className="proposals-table">
                <thead>
                  <tr>
                    <th>Proposal Title</th>
                    <th>Organization</th>
                    <th>Submitted By</th>
                    <th>Date Submitted</th>
                    <th>Pipeline Stage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map((proposal) => {
                    const stage = proposal.pipeline?.currentStage;
                    return (
                      <tr key={proposal.documentId}>
                        <td className="table-title">{proposal.title}</td>
                        <td>
                          {proposal.organizationName || proposal.organizationId}
                        </td>
                        <td>{proposal.submitterName || "Unknown"}</td>
                        <td>{formatDate(proposal.dateSubmitted)}</td>
                        <td>
                          <span
                            className={`stage-badge stage-badge-${stage || (proposal.status === "approved" ? "completed" : proposal.status)}`}
                          >
                            {stage
                              ? getStageLabel(stage)
                              : proposal.status === "approved"
                              ? "Completed"
                              : getStatusLabel(proposal.status)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="action-button action-button-view"
                            onClick={() => handleViewDetails(proposal)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Detail Modal ── */}
          {showDetailModal &&
            selectedProposal &&
            !showForwardModal &&
            !showReturnModal && (
              <div className="modal-overlay" onClick={closeAll}>
                <div
                  className="modal-content modal-content-large"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h3>{selectedProposal.title}</h3>
                    <button className="modal-close" onClick={closeAll}>
                      ×
                    </button>
                  </div>
                  <div className="modal-body">
                    {loadingDetail ? (
                      <div className="loading-state">Loading...</div>
                    ) : (
                      <>
                        <div className="detail-info">
                          <div className="info-row">
                            <span className="info-label">Pipeline Stage:</span>
                            <span className="info-value">
                              {selectedProposal.pipeline?.currentStage
                                ? getStageLabel(
                                    selectedProposal.pipeline.currentStage
                                  )
                                : selectedProposal.status === "approved"
                                ? "Completed"
                                : getStatusLabel(selectedProposal.status)}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Organization:</span>
                            <span className="info-value">
                              {selectedProposal.organizationName ||
                                selectedProposal.organizationId}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Submitted By:</span>
                            <span className="info-value">
                              {selectedProposal.submitterName || "Unknown"}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Date Submitted:</span>
                            <span className="info-value">
                              {formatDate(selectedProposal.dateSubmitted)}
                            </span>
                          </div>
                          {selectedProposal.description && (
                            <div className="info-row-full">
                              <span className="info-label">Description:</span>
                              <p className="info-description">
                                {selectedProposal.description}
                              </p>
                            </div>
                          )}
                          {selectedProposal.files?.length > 0 && (
                            <div className="info-row-full">
                              <span className="info-label">
                                Documents:
                              </span>
                              <div className="files-list">
                                {selectedProposal.files.map((f, i) => {
                                  const counts = commentSummary.byRequirement[f.requirementKey];
                                  const resolvedCount = counts ? counts.total - counts.unresolved : 0;
                                  return (
                                    <div key={i} className="file-list-item">
                                      <button
                                        type="button"
                                        className="file-download-link file-preview-btn"
                                        onClick={() => {
                                          const stage = selectedProposal.pipeline?.currentStage;
                                          const uid = auth.currentUser?.uid;
                                          if (
                                            uid &&
                                            (stage === "sas_review" || stage === "sas_release")
                                          ) {
                                            markProposalFileViewed(
                                              selectedProposal.documentId,
                                              uid,
                                              stage
                                            );
                                          }
                                          setPreviewFile({
                                            fileUrl: f.fileUrl,
                                            fileName: f.fileName,
                                            title: REQUIREMENT_LABELS[f.requirementKey] || f.fileName,
                                            documentId: selectedProposal.documentId,
                                            requirementKey: f.requirementKey,
                                            fileVersion: f.version || 1,
                                            previousVersion: f.previousVersion || null,
                                          });
                                        }}
                                      >
                                        📄{" "}
                                        {REQUIREMENT_LABELS[f.requirementKey] ||
                                          f.fileName}
                                      </button>
                                      {counts && counts.total > 0 && (
                                        <div className="file-comment-counts">
                                          {counts.unresolved > 0 && (
                                            <span className="file-comment-pending">
                                              💬 {counts.unresolved} unresolved
                                            </span>
                                          )}
                                          {resolvedCount > 0 && (
                                            <span className="file-comment-resolved">
                                              ✓ {resolvedCount} resolved
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {selectedProposal.remarks && (
                            <div className="info-row-full">
                              <span className="info-label">Remarks:</span>
                              <p className="info-remarks">
                                {selectedProposal.remarks}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* SAS Review Actions */}
                        {selectedProposal.pipeline?.currentStage ===
                          "sas_review" && (
                          <div className="sas-review-actions">
                            <h4 className="actions-section-title">
                              SAS Review Actions
                            </h4>
                            {unresolvedReviewerCount > 0 && (
                              <div className="comment-gate-banner">
                                ⚠ {unresolvedReviewerCount} unresolved reviewer comment{unresolvedReviewerCount === 1 ? "" : "s"}.
                                Forwarding is blocked until they're resolved.
                              </div>
                            )}
                            <div className="action-buttons-row">
                              <button
                                className="btn-forward"
                                onClick={() => setShowForwardModal(true)}
                                disabled={unresolvedReviewerCount > 0}
                                title={unresolvedReviewerCount > 0 ? "Resolve all reviewer comments first" : ""}
                              >
                                Forward to VPAA
                              </button>
                              <button
                                className="btn-return-sas"
                                onClick={() => setShowReturnModal(true)}
                              >
                                Return to Organization
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SAS Release Actions */}
                        {selectedProposal.pipeline?.currentStage ===
                          "sas_release" && (() => {
                          const isISG = selectedProposal.submitterRole === "ISG";
                          const releaseTitle = isISG
                            ? "Final Release (ISG-submitted)"
                            : "SAS Release";
                          const releaseInstruction = isISG
                            ? "VPAA, OP, FMS, and Procurement have all approved this ISG-submitted proposal. Releasing will mark it Approved."
                            : "VPAA and the Office of the President have approved this proposal. Releasing will hand it to ISG for distribution to the requesting organization.";
                          const releaseButtonLabel = isISG
                            ? releaseLoading
                              ? "Releasing..."
                              : "Release & Mark Approved"
                            : releaseLoading
                              ? "Releasing..."
                              : "Release to ISG";
                          return (
                            <div className="sas-review-actions">
                              <h4 className="actions-section-title">
                                {releaseTitle}
                              </h4>
                              <p className="forward-instruction">
                                {releaseInstruction}
                              </p>
                              {unresolvedReviewerCount > 0 && (
                                <div className="comment-gate-banner">
                                  ⚠ {unresolvedReviewerCount} unresolved reviewer comment{unresolvedReviewerCount === 1 ? "" : "s"}.
                                  Release is blocked until they're resolved.
                                </div>
                              )}
                              <div className="action-buttons-row">
                                <button
                                  className="btn-forward"
                                  onClick={handleReleaseToISG}
                                  disabled={releaseLoading || unresolvedReviewerCount > 0}
                                  title={unresolvedReviewerCount > 0 ? "Resolve all reviewer comments first" : ""}
                                >
                                  {releaseButtonLabel}
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Status History */}
                        {selectedProposalHistory.length > 0 && (
                          <div className="detail-history-section">
                            <h4 className="history-section-title">
                              Status History
                            </h4>
                            <div className="history-timeline">
                              {selectedProposalHistory.map((entry, i) => (
                                <div
                                  key={entry.historyId || i}
                                  className="history-item"
                                >
                                  <div className="history-item-dot" />
                                  <div className="history-item-content">
                                    <div className="history-item-header">
                                      <span
                                        className={`status-badge ${getStatusBadgeClass(entry.status)}`}
                                      >
                                        {getStatusLabel(entry.status)}
                                      </span>
                                      <span className="history-item-date">
                                        {formatDateTime(entry.timestamp)}
                                      </span>
                                    </div>
                                    <div className="history-item-meta">
                                      <span className="history-item-user">
                                        By: {entry.changedByName}
                                      </span>
                                    </div>
                                    {entry.remarks && (
                                      <p className="history-item-remarks">
                                        {entry.remarks}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* ── Forward to VPAA Modal ── */}
          {showForwardModal && selectedProposal && (
            <div
              className="modal-overlay"
              onClick={() => {
                setShowForwardModal(false);
                setEndorsementFile(null);
                setForwardError("");
              }}
            >
              <div
                className="modal-content modal-content-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>Forward to VPAA</h3>
                  <button
                    className="modal-close"
                    onClick={() => {
                      setShowForwardModal(false);
                      setEndorsementFile(null);
                      setForwardError("");
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  <p className="forward-instruction">
                    Upload the SAS Endorsement Letter for{" "}
                    <strong>{selectedProposal.title}</strong>. A tokenized
                    review link will be sent to the VPAA
                    {vpaaProfile?.email ? ` at ${vpaaProfile.email}` : ""}.
                  </p>
                  <div className="form-group">
                    <label className="form-label">
                      SAS Endorsement Letter * (PDF only)
                    </label>
                    <div
                      className={`file-upload-area ${endorsementFile ? "has-file" : ""}`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {endorsementFile ? (
                        <span className="file-name">
                          📄 {endorsementFile.name}
                        </span>
                      ) : (
                        <span className="file-placeholder">
                          Click to upload endorsement letter (PDF only)
                        </span>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const isPdf =
                          file.type === "application/pdf" ||
                          file.name.toLowerCase().endsWith(".pdf");
                        if (!isPdf) {
                          setForwardError(
                            "Only PDF files are accepted. Please export your Word document to PDF and re-upload."
                          );
                          e.target.value = "";
                          return;
                        }
                        setForwardError("");
                        setEndorsementFile(file);
                        e.target.value = "";
                      }}
                    />
                    <small style={{ display: "block", marginTop: 6, color: "#666" }}>
                      VPAA and OP signatures will be stamped onto this PDF when they
                      approve. Word (.docx) is not supported — export to PDF first.
                    </small>
                  </div>
                  {!vpaaProfile && (
                    <p className="form-warning">
                      No VPAA office profile configured — the review link will
                      NOT be emailed automatically. Please set up the VPAA
                      office profile in admin settings.
                    </p>
                  )}
                  {forwardError && (
                    <p className="form-error">{forwardError}</p>
                  )}
                  <div className="modal-actions">
                    <button
                      className="form-button form-button-secondary"
                      onClick={() => {
                        setShowForwardModal(false);
                        setEndorsementFile(null);
                        setForwardError("");
                      }}
                      disabled={forwardLoading}
                    >
                      Cancel
                    </button>
                    <button
                      className="form-button form-button-primary"
                      onClick={handleForwardToVPAA}
                      disabled={forwardLoading || !endorsementFile}
                    >
                      {forwardLoading ? "Forwarding..." : "Confirm Forward"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Return to Org Modal ── */}
          {showReturnModal && selectedProposal && (
            <div
              className="modal-overlay"
              onClick={() => {
                setShowReturnModal(false);
                setReturnRemarks("");
                setReturnError("");
              }}
            >
              <div
                className="modal-content modal-content-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>Return to Organization</h3>
                  <button
                    className="modal-close"
                    onClick={() => {
                      setShowReturnModal(false);
                      setReturnRemarks("");
                      setReturnError("");
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  <p className="return-instruction">
                    State the reason for returning{" "}
                    <strong>{selectedProposal.title}</strong> to the
                    organization.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Reason / Remarks *</label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="Describe what needs to be corrected or revised..."
                      value={returnRemarks}
                      onChange={(e) => setReturnRemarks(e.target.value)}
                    />
                  </div>
                  {returnError && (
                    <p className="form-error">{returnError}</p>
                  )}
                  <div className="modal-actions">
                    <button
                      className="form-button form-button-secondary"
                      onClick={() => {
                        setShowReturnModal(false);
                        setReturnRemarks("");
                        setReturnError("");
                      }}
                      disabled={returnLoading}
                    >
                      Cancel
                    </button>
                    <button
                      className="form-button form-button-danger"
                      onClick={handleReturnToOrg}
                      disabled={returnLoading || !returnRemarks.trim()}
                    >
                      {returnLoading ? "Returning..." : "Return Proposal"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {previewFile && (
        <DocumentPreviewModal
          key={previewFile.fileUrl}
          fileUrl={previewFile.fileUrl}
          fileName={previewFile.fileName}
          title={previewFile.title}
          documentId={previewFile.documentId}
          requirementKey={previewFile.requirementKey}
          fileVersion={previewFile.fileVersion}
          previousVersion={previewFile.previousVersion}
          currentUser={userData ? {
            uid: auth.currentUser?.uid,
            name: userData.name,
            role: userData.role,
          } : null}
          viewerRole="reviewer"
          onClose={() => setPreviewFile(null)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminActivityProposals;
