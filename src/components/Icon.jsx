import React from "react";

// Import all icons statically
import dashboardIcon from "../assets/images/icons/dashboard.svg";
import activityProposalsIcon from "../assets/images/icons/activity-proposals.svg";
import reportsIcon from "../assets/images/icons/reports.svg";
import documentsIcon from "../assets/images/icons/documents.svg";
import equipmentIcon from "../assets/images/icons/equipment.svg";
import bellIcon from "../assets/images/icons/bell.svg";
import bellActiveIcon from "../assets/images/icons/bell active.svg";
import referencesIcon from "../assets/images/icons/references.svg";
import profileIcon from "../assets/images/icons/profile.svg";
import chevronDownIcon from "../assets/images/icons/chevron-down.svg";
import chevronUpIcon from "../assets/images/icons/chevron-up.svg";
import chevronLeftIcon from "../assets/images/icons/chevron-left.svg";
import chevronRightIcon from "../assets/images/icons/chevron-right.svg";
import menuOpenIcon from "../assets/images/icons/menu-open.svg";
import menuCloseIcon from "../assets/images/icons/menu-close.svg";
import searchIcon from "../assets/images/icons/search.svg";
import addIcon from "../assets/images/icons/add.svg";
import editIcon from "../assets/images/icons/edit.svg";
import deleteIcon from "../assets/images/icons/delete.svg";
import viewIcon from "../assets/images/icons/view.svg";
import downloadIcon from "../assets/images/icons/download.svg";
import uploadIcon from "../assets/images/icons/upload.svg";
import saveIcon from "../assets/images/icons/save.svg";
import cancelIcon from "../assets/images/icons/cancel.svg";
import settingsIcon from "../assets/images/icons/settings.svg";
import analyticsIcon from "../assets/images/icons/analytics.svg";
import buildingIcon from "../assets/images/icons/building.svg";
import equipmentManagementIcon from "../assets/images/icons/equipment-management.svg";
import outgoingIcon from "../assets/images/icons/outgoing.svg";
import incomingIcon from "../assets/images/icons/incoming.svg";
import chartBarIcon from "../assets/images/icons/chart-bar.svg";
import chartLineIcon from "../assets/images/icons/chart-line.svg";
import academicCapIcon from "../assets/images/icons/academic-cap.svg";
import lockIcon from "../assets/images/icons/lock.svg";
import attachmentIcon from "../assets/images/icons/attachment.svg";
import backIcon from "../assets/images/icons/back.svg";
import nextIcon from "../assets/images/icons/next.svg";

// Icon mapping
const iconMap = {
  "dashboard": dashboardIcon,
  "activity-proposals": activityProposalsIcon,
  "reports": reportsIcon,
  "documents": documentsIcon,
  "equipment": equipmentIcon,
  "notifications": bellIcon,
  "references": referencesIcon,
  "profile": profileIcon,
  "bell": bellIcon,
  "bell active": bellActiveIcon,
  "chevron-down": chevronDownIcon,
  "chevron-up": chevronUpIcon,
  "chevron-left": chevronLeftIcon,
  "chevron-right": chevronRightIcon,
  "menu-open": menuOpenIcon,
  "menu-close": menuCloseIcon,
  "search": searchIcon,
  "add": addIcon,
  "edit": editIcon,
  "delete": deleteIcon,
  "view": viewIcon,
  "download": downloadIcon,
  "upload": uploadIcon,
  "save": saveIcon,
  "cancel": cancelIcon,
  "settings": settingsIcon,
  "analytics": analyticsIcon,
  "building": buildingIcon,
  "equipment-management": equipmentManagementIcon,
  "outgoing": outgoingIcon,
  "incoming": incomingIcon,
  "chart-bar": chartBarIcon,
  "chart-line": chartLineIcon,
  "academic-cap": academicCapIcon,
  "lock": lockIcon,
  "attachment": attachmentIcon,
  "back": backIcon,
  "next": nextIcon,
};

/**
 * Icon component for rendering SVG icons
 * @param {string} name - Name of the icon file (without .svg extension)
 * @param {string} className - Additional CSS classes
 * @param {number} size - Size of the icon in pixels (default: 24)
 * @param {string} color - Color of the icon (default: currentColor) - Note: SVG must support currentColor
 */
const Icon = ({ name, className = "", size = 24, color = "currentColor" }) => {
  const iconSrc = iconMap[name];
  
  if (!iconSrc) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return null;
  }

  return (
    <img
      src={iconSrc}
      alt={name}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-block",
        verticalAlign: "middle",
        color: color,
        filter: color !== "currentColor" ? `brightness(0) saturate(100%) ${color}` : "none",
      }}
    />
  );
};

export default Icon;

