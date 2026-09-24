/*!

=========================================================
* SancharNetra Portal v1.0.0
=========================================================

* Developed by: AlgoRhythm
* Copyright 2025 AlgoRhythm
* Licensed under MIT (https://github.com/creativetimofficial/black-dashboard-react/blob/master/LICENSE.md)

* Coded by AlgoRhythm

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import Dashboard from "views/Dashboard.js";
import Profiling from "views/Profiling.js";
import FileUpload from "views/FileUpload.js";
import Analytics from "views/Analytics.js";
import MovementMap from "components/CDR/MovementMap.jsx";
import CDRAnalysis from "components/CDR/CDRAnalysis.jsx";
import SIMSwapDetector from "components/CDR/SIMSwapDetector.jsx";
import CallPatternAnalyzer from "components/CDR/CallPatternAnalyzer.jsx";
import CalendarView from "components/CDR/CalendarView.jsx";
import CommonNumberFinder from "components/CDR/CommonNumberFinder.jsx";
import TimelineView from "components/CDR/TimelineView.jsx";
import DwellTimeAnalysis from "components/CDR/DwellTimeAnalysis.jsx";
import PortIntelligence from "components/IPDR/PortIntelligence.jsx";
import IPQualityChecker from "components/IPDR/IPQualityChecker.jsx";
import VoIPDetector from "components/IPDR/VoIPDetector.jsx";
import IPDRAnalysis from "components/IPDR/IPDRAnalysis.jsx";
import IPDRCorrelation from "components/IPDR/IPDRCorrelation.jsx";
import CaseManagement from "components/Case/CaseManagement.jsx";
import CrossCaseAnalysis from "components/Case/CrossCaseAnalysis.jsx";

var routes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "tim-icons icon-chart-pie-36",
    component: Dashboard,
    layout: "/admin"
  },
  {
    path: "/case-management",
    name: "Case Management",
    icon: "tim-icons icon-badge",
    component: CaseManagement,
    layout: "/admin"
  },
  {
    path: "/cross-case-analysis",
    name: "Cross-Case Analysis",
    icon: "tim-icons icon-zoom-split",
    component: CrossCaseAnalysis,
    layout: "/admin"
  },
  {
    path: "/profiling",
    name: "Phone & Email Profiling",
    icon: "tim-icons icon-badge",
    component: Profiling,
    layout: "/admin"
  },
  {
    path: "/file-upload",
    name: "Data Upload",
    icon: "tim-icons icon-cloud-upload-94",
    component: FileUpload,
    layout: "/admin"
  },
  {
    path: "/cdr-analysis",
    name: "CDR Analysis",
    icon: "tim-icons icon-zoom-split",
    component: CDRAnalysis,
    layout: "/admin"
  },
  {
    path: "/ipdr-analysis",
    name: "IPDR Analysis",
    icon: "tim-icons icon-wifi",
    component: IPDRAnalysis,
    layout: "/admin"
  },
  {
    path: "/ipdr-correlation",
    name: "IPDR Correlation",
    icon: "tim-icons icon-link-72",
    component: IPDRCorrelation,
    layout: "/admin"
  },
  {
    path: "/movement-reconstruction",
    name: "Movement Reconstruction",
    icon: "tim-icons icon-world",
    component: MovementMap,
    layout: "/admin"
  },
  {
    path: "/calendar-view",
    name: "Calendar View",
    icon: "tim-icons icon-calendar-60",
    component: CalendarView,
    layout: "/admin"
  },
  {
    path: "/common-numbers",
    name: "Common Number Finder",
    icon: "tim-icons icon-zoom-split",
    component: CommonNumberFinder,
    layout: "/admin"
  },
  {
    path: "/timeline-view",
    name: "Activity Timeline",
    icon: "tim-icons icon-time-alarm",
    component: TimelineView,
    layout: "/admin"
  },
  {
    path: "/dwell-time-analysis",
    name: "Dwell Time Analysis",
    icon: "tim-icons icon-square-pin",
    component: DwellTimeAnalysis,
    layout: "/admin"
  }
];
export default routes;
