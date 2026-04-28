import { useState, useEffect } from "react";
import {
  FileText, Download, Loader2, Search,
  FileCheck, Clock, ArrowRightCircle, Sparkles, GraduationCap, ShieldCheck, CheckCircle2
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { scopedQuery } from "../lib/scopedQuery";
import { where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { useIsMobile } from "@/hooks/use-mobile";

// ═══════════════════════════════════════════════════════════════════════
// MOCK DATA — flip USE_MOCK_DATA to false to restore live Firestore data
// ═══════════════════════════════════════════════════════════════════════
const USE_MOCK_DATA = true;

const MOCK_STUDENT_DATA: any = {
  id: "mock-student-001",
  name: "Aarav Sharma",
  grade: "8B",
  className: "Grade 8B",
  rollNo: "23",
  schoolId: "mock-school-001",
  classId: "mock-class-001",
  email: "aarav.sharma@example.com",
  status: "Active",
};

// Firestore-Timestamp-shaped helper (page reads .toMillis() and .toDate())
const _rpTs = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};

// Class-wide roster used by class reports (used for Excel export)
const _MOCK_CLASS_ROSTER = [
  { name: "Aarav Sharma",    rollNo: "23", score: 84, attendance: 92, standing: "Strong" },
  { name: "Ananya Iyer",     rollNo: "07", score: 91, attendance: 96, standing: "Outstanding" },
  { name: "Devansh Kapoor",  rollNo: "12", score: 76, attendance: 88, standing: "Good" },
  { name: "Diya Menon",      rollNo: "08", score: 88, attendance: 94, standing: "Excellent" },
  { name: "Ishaan Khanna",   rollNo: "14", score: 72, attendance: 85, standing: "Improving" },
  { name: "Kabir Verma",     rollNo: "15", score: 80, attendance: 90, standing: "Good" },
  { name: "Meera Reddy",     rollNo: "18", score: 86, attendance: 93, standing: "Excellent" },
  { name: "Nikhil Joshi",    rollNo: "20", score: 68, attendance: 82, standing: "Needs Attention" },
  { name: "Rhea Patel",      rollNo: "26", score: 89, attendance: 95, standing: "Excellent" },
  { name: "Riaan Singh",     rollNo: "27", score: 78, attendance: 89, standing: "Good" },
  { name: "Saanvi Gupta",    rollNo: "28", score: 93, attendance: 97, standing: "Outstanding" },
  { name: "Vihaan Mehta",    rollNo: "32", score: 81, attendance: 91, standing: "Good" },
];

// 9 published reports — mix of personal (studentId = student) and class-wide
// (studentId = "all" + grade = "8B"). Mix of PDF + Excel formats.
const MOCK_REPORTS: any[] = [
  {
    id: "rep1", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Term 2 — Mid-Term Performance Report",
    teacherName: "Mrs. Priya Mehta",
    format: "pdf",
    status: "Sent & Reported", publishedToParent: true,
    createdAt: _rpTs(2),
    data: {
      student_name: "Aarav Sharma",
      score: "84%",
      atnd: 92,
      ai_remark: "Aarav is performing consistently well this term with a 84% mid-term average. Mathematics and Hindi remain his strongest subjects. English reading comprehension is the main growth area. Recommended focus: 15 min daily reading + weekly vocabulary practice.",
    },
  },
  {
    id: "rep2", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Weekly Progress Digest — Week 16",
    teacherName: "Edullent AI Engine",
    format: "pdf",
    status: "Sent", publishedToParent: true,
    createdAt: _rpTs(4),
    data: {
      student_name: "Aarav Sharma",
      score: "86%",
      atnd: 94,
      ai_remark: "Strong week — submitted 4 of 7 assignments on time and scored 92% in the Algebra class test. Talkativeness in CS Lab was flagged once; otherwise excellent classroom engagement.",
    },
  },
  {
    id: "rep3", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Subject-wise Performance Breakdown",
    teacherName: "Mrs. Priya Mehta",
    format: "excel",
    status: "Sent", publishedToParent: true,
    createdAt: _rpTs(7),
    data: {
      isClassReport: false,
      student_name: "Aarav Sharma",
      score: "84%",
      atnd: 92,
      ai_remark: "Math 90, Hindi 88, Science 85, CS 85, Social 80, English 78. Overall trending upward (+6% vs last term).",
    },
  },
  {
    id: "rep4", studentId: "all", schoolId: "mock-school-001", grade: "8B",
    title: "Class 8B — Term 2 Progress Snapshot",
    teacherName: "Mrs. Priya Mehta",
    format: "excel",
    status: "Sent", publishedToParent: true,
    createdAt: _rpTs(10),
    data: {
      isClassReport: true,
      fullList: _MOCK_CLASS_ROSTER,
      ai_remark: "Class average 82.2% — improvement of 3.4% over Term 1. 4 students at 'Outstanding' tier. Aarav Sharma ranks 7/12.",
    },
  },
  {
    id: "rep5", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Attendance Summary — Last 60 Days",
    teacherName: "Front Office",
    format: "pdf",
    status: "Sent", publishedToParent: true,
    createdAt: _rpTs(14),
    data: {
      student_name: "Aarav Sharma",
      score: "—",
      atnd: 92,
      ai_remark: "Attendance rate 92% over 60 school days. 3 absences (medical), 4 late arrivals. Above the school's 85% threshold.",
    },
  },
  {
    id: "rep6", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Parent–Teacher Meeting Minutes — March 2026",
    teacherName: "Mrs. Priya Mehta",
    format: "pdf",
    status: "Sent & Reported", publishedToParent: true,
    createdAt: _rpTs(28),
    data: {
      student_name: "Aarav Sharma",
      score: "—",
      atnd: "—",
      ai_remark: "Discussed Aarav's progress in Math and Hindi (strong). Identified English reading speed as focus area. Parents agreed to support 15 min daily reading at home. Next review scheduled for Term 3 mid-point.",
    },
  },
  {
    id: "rep7", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Behaviour & Conduct Report — Term 2",
    teacherName: "Mrs. Priya Mehta",
    format: "pdf",
    status: "Sent", publishedToParent: true,
    createdAt: _rpTs(35),
    data: {
      student_name: "Aarav Sharma",
      score: "4.5 / 5",
      atnd: 92,
      ai_remark: "12 positive teacher notes vs 4 improvement notes this term. Recognised for leadership during photosynthesis lab and class monitor duty. Two reminders about focus during CS Lab.",
    },
  },
  {
    id: "rep8", studentId: "all", schoolId: "mock-school-001", grade: "8B",
    title: "Class 8B — Subject Average Comparison",
    teacherName: "Academic Coordinator",
    format: "excel",
    status: "Sent", publishedToParent: true,
    createdAt: _rpTs(42),
    data: {
      isClassReport: true,
      fullList: _MOCK_CLASS_ROSTER.map(s => ({ ...s, score: Math.max(60, s.score - 4 + Math.round(Math.random() * 0)) })),
      ai_remark: "Subject-wise class averages — Math 86%, Science 83%, Hindi 84%, English 76%, Social 80%, CS 87%. English remains the lowest-scoring subject across the cohort.",
    },
  },
  {
    id: "rep9", studentId: "mock-student-001", schoolId: "mock-school-001", grade: "8B",
    title: "Term 1 Final Report Card",
    teacherName: "Principal Office",
    format: "pdf",
    status: "Sent & Reported", publishedToParent: true,
    createdAt: _rpTs(120),
    data: {
      student_name: "Aarav Sharma",
      score: "78%",
      atnd: 90,
      ai_remark: "Solid Term 1 performance. Promoted to Term 2 with strong foundations in Mathematics and Hindi. Recommended focus areas for Term 2: English vocabulary and Science chemistry concepts.",
    },
  },
];

const ReportsPage = () => {
  const { studentData: _liveStudentData } = useAuth();
  const studentData = USE_MOCK_DATA ? MOCK_STUDENT_DATA : _liveStudentData;
  const isMobile = useIsMobile();
  const [reports, setReports] = useState<any[]>(USE_MOCK_DATA ? MOCK_REPORTS : []);
  const [loading, setLoading] = useState(USE_MOCK_DATA ? false : true);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | "pdf" | "excel" | "verified">("all");

  useEffect(() => {
    if (USE_MOCK_DATA) return; // Mock mode: reports pre-seeded above
    if (!studentData?.id) return;
    setLoading(true);
    const schoolId = studentData.schoolId;

    // Single scoped query — "all" grade-level reports + personal reports
    const reportsQ = scopedQuery("reports", schoolId, where("studentId", "in", [studentData.id, "all"]));

    const unsub = onSnapshot(reportsQ, (snap) => {
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(r => (r.grade === studentData.grade || r.studentId === studentData.id || r.studentId === "all") &&
                     (r.status === "Sent" || r.status === "Sent & Reported" || r.publishedToParent === true))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReports(filtered);
      setLoading(false);
    });

    return () => unsub();
  }, [studentData?.id, studentData?.schoolId]);

  const filteredReports = reports.filter(r => 
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.teacherName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (r: any) => {
    if (r.format === 'excel') {
      let dataToExport: any[] = [];
      
      const reportData = r.data || {};
      
      if (reportData.isClassReport) {
        dataToExport = (reportData.fullList || []).map((s: any) => ({ 
          'Student Name': s.name, 
          'Roll Number': s.rollNo, 
          'Academic Score (%)': s.score || 'N/A', 
          'Attendance Rate (%)': s.attendance, 
          'Academic Standing': s.standing 
        }));
      } else {
        dataToExport = [{ 
          'Student Name': reportData.student_name || r.studentName, 
          'Academic Score': reportData.score || 'N/A', 
          'Attendance (%)': reportData.atnd || reportData.attendance, 
          'AI Summary': reportData.ai_remark || reportData.aiRemarks 
        }];
      }
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Institutional Intelligence");
      XLSX.writeFile(wb, `${r.title}_Report_${new Date().getTime()}.xlsx`);
      toast.success("Excel Spreadsheet successfully generated!");
    } else {
      window.print();
      toast.success("Opening Institutional Print View...");
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0A84FF", B2 = "#3395FF", B3 = "#5BA9FF";
    const BG = "#F5F5F7";
    const T1 = "#1D1D1F", T2 = "#3A3A3C", T3 = "#6E6E73", T4 = "#A1A1A6";
    const SH = "0 0 0 0.5px rgba(10,132,255,0.08), 0 2px 8px rgba(10,132,255,0.08), 0 10px 28px rgba(10,132,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(10,132,255,0.10), 0 4px 16px rgba(10,132,255,0.11), 0 20px 48px rgba(10,132,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(10,132,255,0.42), 0 2px 6px rgba(10,132,255,0.22)";
    const SH_DARK = "0 6px 24px rgba(0,8,40,0.30), 0 2px 6px rgba(0,8,40,0.18)";

    const detectFormat = (r: any): "pdf" | "excel" | "other" => {
      const f = (r.format || "").toString().toLowerCase();
      if (f.includes("excel") || f === "xlsx" || f === "xls" || f === "csv") return "excel";
      if (f.includes("pdf")) return "pdf";
      return "other";
    };

    const formatTheme = (t: string) => {
      if (t === "excel") return {
        icoBg: "linear-gradient(135deg, #248A3D, #34C759)",
        icoShadow: "0 4px 14px rgba(0,120,48,0.26)",
        ext: "XLSX",
      };
      return {
        icoBg: `linear-gradient(135deg, ${B1}, ${B3})`,
        icoShadow: "0 4px 14px rgba(10,132,255,0.28)",
        ext: "PDF",
      };
    };

    const pdfCount = reports.filter(r => detectFormat(r) === "pdf").length;
    const excelCount = reports.filter(r => detectFormat(r) === "excel").length;
    const verifiedCount = reports.length; // All shown reports are server-side verified (publishedToParent)

    let filteredMobile = filteredReports;
    if (formatFilter === "pdf") filteredMobile = filteredReports.filter(r => detectFormat(r) === "pdf");
    else if (formatFilter === "excel") filteredMobile = filteredReports.filter(r => detectFormat(r) === "excel");

    const formatDate = (createdAt: any) => {
      try {
        const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
        if (!d || isNaN(d.getTime())) return "Recent";
        return d.toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      } catch { return "Recent"; }
    };

    const FILTERS: { key: typeof formatFilter; label: string; count: number }[] = [
      { key: "all", label: "All Reports", count: reports.length },
      { key: "pdf", label: "PDF", count: pdfCount },
      { key: "excel", label: "Excel", count: excelCount },
      { key: "verified", label: "Verified", count: verifiedCount },
    ];

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Page Head ── */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-[12px] mb-[4px]">
            <div className="text-[28px] font-normal" style={{ color: T1, letterSpacing: "-0.7px" }}>Academic Reports</div>
            <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center ml-auto"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(10,132,255,0.28)" }}>
              <FileText className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div className="inline-flex items-center gap-[8px] px-3 py-[8px] rounded-full text-[12px] font-normal uppercase tracking-[0.10em]"
            style={{ background: "rgba(10,132,255,0.08)", border: "0.5px solid rgba(10,132,255,0.16)", color: B1 }}>
            <ShieldCheck className="w-[9px] h-[9px]" strokeWidth={2.5} />
            Authorized Academic Intelligence &amp; Documentation Pipeline
          </div>
        </div>

        {/* ── Search ── */}
        <div className="mx-5 mt-[16px] relative">
          <div className="absolute left-[16px] top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="w-[15px] h-[15px]" style={{ color: "rgba(10,132,255,0.40)" }} strokeWidth={2.2} />
          </div>
          <input
            type="text"
            placeholder="Search Documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full py-[12px] pr-4 pl-[42px] rounded-[16px] text-[13px] font-normal outline-none bg-white"
            style={{
              border: "0.5px solid rgba(10,132,255,0.12)",
              color: T1,
              letterSpacing: "-0.1px",
              boxShadow: SH,
              fontFamily: "inherit",
              textTransform: "uppercase",
            }}
          />
        </div>

        {/* ── Filter chips ── */}
        <div className="flex gap-2 px-5 pt-[16px] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(f => {
            const isAct = formatFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFormatFilter(f.key)}
                className="flex items-center gap-[8px] px-[16px] py-2 rounded-full flex-shrink-0 transition-transform active:scale-[0.94]"
                style={{
                  background: isAct ? `linear-gradient(135deg, ${B1}, ${B2})` : "#FFFFFF",
                  border: isAct ? "0.5px solid transparent" : "0.5px solid rgba(10,132,255,0.12)",
                  boxShadow: isAct ? SH_BTN : SH,
                  transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                <span className="text-[12px] font-normal tracking-[0.02em]" style={{ color: isAct ? "#fff" : T3 }}>{f.label}</span>
                <span className="text-[12px] font-normal rounded-full px-[8px] py-[1px]"
                  style={{
                    background: isAct ? "rgba(255,255,255,0.22)" : "rgba(10,132,255,0.10)",
                    color: isAct ? "#fff" : B1,
                  }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="mx-5 mt-[16px] bg-white rounded-[26px] py-10 flex flex-col items-center gap-3"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: B1 }} />
            <p className="text-[12px] font-normal uppercase tracking-widest" style={{ color: T4 }}>Accessing Document Repository…</p>
          </div>
        ) : filteredMobile.length === 0 ? (
          <div className="mx-5 mt-[16px] bg-white rounded-[26px] px-6 py-10 flex flex-col items-center text-center relative overflow-hidden"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
            <div className="absolute -top-[50px] -right-[40px] w-[180px] h-[180px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(10,132,255,0.05) 0%, transparent 70%)" }} />
            <div className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center mb-4 relative z-10"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN}, 0 0 0 10px rgba(10,132,255,0.08)` }}>
              <FileCheck className="w-8 h-8 text-white" strokeWidth={2.1} />
            </div>
            <div className="text-[18px] font-normal mb-[8px] relative z-10" style={{ color: T1, letterSpacing: "-0.4px" }}>
              {searchQuery || formatFilter !== "all" ? "No Matches Found" : "Repository Empty"}
            </div>
            <div className="text-[13px] leading-[1.6] max-w-[240px] font-normal italic relative z-10" style={{ color: T3 }}>
              {searchQuery
                ? "Try a different search term."
                : formatFilter !== "all"
                  ? `No ${formatFilter.toUpperCase()} reports available yet.`
                  : "Official academic reports for the current term have not been published by the faculty team yet."}
            </div>
          </div>
        ) : (
          filteredMobile.map((r: any) => {
            const type = detectFormat(r);
            const theme = formatTheme(type);
            return (
              <div key={r.id}
                role="button"
                tabIndex={0}
                aria-label={`Download ${r.title || "report"}`}
                className="mx-5 mt-[16px] bg-white rounded-[26px] px-5 pt-[24px] pb-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40"
                style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}
                onClick={() => handleDownload(r)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDownload(r); } }}>
                <div className="absolute -top-[40px] -right-[24px] w-[150px] h-[150px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(10,132,255,0.05) 0%, transparent 70%)" }} />
                <div className="absolute bottom-3 right-4 opacity-[0.04] pointer-events-none">
                  <FileText size={120} color={B1} strokeWidth={0.6} />
                </div>

                {/* Top */}
                <div className="flex items-start gap-[16px] mb-[16px] relative z-10">
                  <div className="w-[52px] h-[52px] rounded-[17px] flex items-center justify-center shrink-0"
                    style={{ background: theme.icoBg, boxShadow: theme.icoShadow }}>
                    {type === "excel"
                      ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
                          <line x1="12" y1="9" x2="12" y2="21" />
                        </svg>
                      : <FileText className="w-6 h-6 text-white" strokeWidth={2.2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-normal uppercase mb-[8px] leading-[1.25]" style={{ color: T1, letterSpacing: "-0.3px" }}>
                      {r.title || "Academic Report"}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[12px] font-normal uppercase tracking-[0.04em]" style={{ color: T3 }}>
                        <GraduationCap className="w-[11px] h-[11px]" strokeWidth={2.5} />
                        {r.teacherName || "Faculty"}
                      </div>
                      <div className="w-[3px] h-[3px] rounded-full" style={{ background: T4 }} />
                      <div className="flex items-center gap-1 text-[12px] font-normal uppercase tracking-[0.04em]" style={{ color: T3 }}>
                        <Clock className="w-[11px] h-[11px]" strokeWidth={2.5} />
                        {formatDate(r.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <div className="rounded-r-[12px] px-[16px] py-3 mb-4 relative z-10"
                  style={{
                    background: "rgba(10,132,255,0.04)",
                    borderLeft: `3px solid ${B1}`,
                  }}>
                  <p className="text-[12px] italic leading-[1.72] font-normal" style={{ color: T2, letterSpacing: "-0.1px" }}>
                    "{r.data?.ai_remark || r.data?.aiRemarks || "Institutional assessment data compiled by the academic department. This document contains verified academic standing and behavioral metrics."}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-[12px] relative z-10">
                  <div className="flex items-center gap-[4px] px-[12px] py-[8px] rounded-full text-[12px] font-normal uppercase tracking-[0.06em] text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(10,132,255,0.28)" }}>
                    <CheckCircle2 className="w-[10px] h-[10px]" strokeWidth={2.5} />
                    Verified
                  </div>
                  <div className="shrink-0">
                    <div className="text-[12px] font-normal uppercase tracking-[0.10em]" style={{ color: T4 }}>Format</div>
                    <div className="text-[12px] font-normal uppercase tracking-[0.04em]" style={{ color: T2 }}>{theme.ext}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDownload(r); }}
                    className="flex-1 h-[46px] rounded-[15px] flex items-center justify-center gap-2 text-[12px] font-normal text-white uppercase tracking-[0.06em] relative overflow-hidden active:scale-[0.96] transition-transform"
                    style={{
                      background: "linear-gradient(135deg, #1D1D1F, #0A84FF)",
                      boxShadow: SH_DARK,
                      transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)"
                    }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 52%)" }} />
                    <Download className="w-[14px] h-[14px]" strokeWidth={2.3} />
                    <span className="relative z-10">Download Report</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* ── Policy Card ── */}
        {!loading && (
          <div className="mx-5 mt-[16px] rounded-[26px] px-6 py-[24px] relative overflow-hidden transition-transform active:scale-[0.98]"
            style={{
              background: "linear-gradient(140deg, #0A84FF 0%, #0A84FF 45%, #5BA9FF 80%, #7CBBFF 100%)",
              boxShadow: `${SH_BTN}, 0 0 0 0.5px rgba(255,255,255,0.14)`,
            }}>
            <div className="absolute -top-[44px] -right-[32px] w-[200px] h-[200px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
              backgroundSize: "24px 24px"
            }} />

            <div className="inline-flex items-center gap-[4px] px-3 py-[4px] rounded-full text-[12px] font-normal uppercase tracking-[0.10em] mb-[16px] relative z-10"
              style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.75)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>
              <ShieldCheck className="w-[10px] h-[10px]" strokeWidth={2.5} />
              Infrastructure Policy
            </div>

            <div className="text-[22px] font-normal uppercase text-white leading-[1.15] mb-3 relative z-10" style={{ letterSpacing: "-0.6px" }}>
              Document Infrastructure Policy
            </div>
            <div className="text-[13px] leading-[1.75] font-normal relative z-10" style={{ color: "rgba(255,255,255,0.75)" }}>
              Academic reports are generated by the <strong style={{ color: "#fff", fontWeight: 400 }}>instructional faculty</strong> and mirrored to the parent portal for peak accessibility. All documents are <strong style={{ color: "#fff", fontWeight: 400 }}>encrypted</strong>, verified, and digitally timestamped.
            </div>

            <div className="h-[0.5px] my-4 relative z-10" style={{ background: "rgba(255,255,255,0.16)" }} />

            <div className="flex flex-col gap-[12px] relative z-10">
              {[
                { icon: ShieldCheck, text: "End-to-end encrypted storage" },
                { icon: Clock,       text: "Real-time faculty synchronization" },
                { icon: CheckCircle2, text: "All reports faculty-verified" },
                { icon: ArrowRightCircle, text: "Retention: 30 days · direct sync active" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-[12px]">
                  <div className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)" }}>
                    <Icon className="w-[13px] h-[13px]" style={{ color: "rgba(255,255,255,0.85)" }} strokeWidth={2.3} />
                  </div>
                  <span className="text-[12px] font-normal" style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "-0.1px" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Bright Blue Apple UI + 3D hover cards
     ═══════════════════════════════════════════════════════════════ */
  const B1 = "#0A84FF", B2 = "#3395FF", B3 = "#5BA9FF";
  const BG_D = "#F5F5F7";
  const T1 = "#1D1D1F", T2 = "#3A3A3C", T3 = "#6E6E73", T4 = "#A1A1A6";
  const GREEN = "#34C759", ORANGE = "#FF9500";
  const BLUE_BDR = "rgba(10,132,255,0.12)";
  const SH_D = "0 0 0 0.5px rgba(10,132,255,0.08), 0 2px 8px rgba(10,132,255,0.09), 0 10px 28px rgba(10,132,255,0.11)";
  const SH_LG_D = "0 0 0 0.5px rgba(10,132,255,0.10), 0 4px 16px rgba(10,132,255,0.12), 0 18px 44px rgba(10,132,255,0.14)";
  const SH_BTN_D = "0 6px 22px rgba(10,132,255,0.42), 0 2px 6px rgba(10,132,255,0.22)";

  const detectFormatD = (r: any): "pdf" | "excel" | "other" => {
    const f = (r.format || "").toString().toLowerCase();
    if (f.includes("excel") || f === "xlsx" || f === "xls" || f === "csv") return "excel";
    if (f.includes("pdf")) return "pdf";
    return "other";
  };

  const pdfCountD = reports.filter(r => detectFormatD(r) === "pdf").length;
  const excelCountD = reports.filter(r => detectFormatD(r) === "excel").length;
  const verifiedCountD = reports.length;

  let filteredDesktop = filteredReports;
  if (formatFilter === "pdf") filteredDesktop = filteredReports.filter(r => detectFormatD(r) === "pdf");
  else if (formatFilter === "excel") filteredDesktop = filteredReports.filter(r => detectFormatD(r) === "excel");

  const FILTERS_D: { key: typeof formatFilter; label: string; count: number }[] = [
    { key: "all", label: "All Reports", count: reports.length },
    { key: "pdf", label: "PDF", count: pdfCountD },
    { key: "excel", label: "Excel", count: excelCountD },
    { key: "verified", label: "Verified", count: verifiedCountD },
  ];

  const formatDateD = (createdAt: any) => {
    try {
      const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
      if (!d || isNaN(d.getTime())) return "Recent";
      return d.toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return "Recent"; }
  };

  // 3D tilt handlers — track mouse inside card.
  // Type the element union so these can attach to either <div> or <button>
  // (both used on this page). The previous HTMLDivElement-only type caused
  // three TS2322 errors where the stat cards (buttons) wired in the handlers.
  type TiltEl = HTMLDivElement | HTMLButtonElement;
  const handle3DEnter = (e: React.MouseEvent<TiltEl>) => {
    const el = e.currentTarget;
    el.style.transition = "transform 0.06s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.2s ease";
  };
  const handle3DMove = (e: React.MouseEvent<TiltEl>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotX = (((y / rect.height) - 0.5) * -8).toFixed(2);
    const rotY = (((x / rect.width) - 0.5) * 8).toFixed(2);
    el.style.transform = `perspective(1100px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-5px) scale(1.012)`;
    const glow = el.querySelector<HTMLDivElement>('[data-glow]');
    if (glow) {
      glow.style.opacity = "1";
      glow.style.background = `radial-gradient(420px circle at ${x}px ${y}px, rgba(10,132,255,0.15), transparent 45%)`;
    }
  };
  const handle3DLeave = (e: React.MouseEvent<TiltEl>) => {
    const el = e.currentTarget;
    el.style.transition = "transform 0.5s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s ease";
    el.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
    const glow = el.querySelector<HTMLDivElement>('[data-glow]');
    if (glow) glow.style.opacity = "0";
  };

  return (
    <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif", background: BG_D }}>
      <div className="w-full px-6 pt-8 pb-10">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="text-[12px] font-normal uppercase tracking-[0.12em] mb-1 flex items-center gap-[8px]" style={{ color: T4 }}>
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: B1, boxShadow: "0 0 0 3px rgba(10,132,255,0.18)" }} />
              Parent Dashboard · Reports
            </div>
            <h1 className="text-[28px] font-normal leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Academic Reports</h1>
            <div className="text-[13px] font-normal mt-[8px] flex items-center gap-[8px]" style={{ color: T3 }}>
              <ShieldCheck className="w-[13px] h-[13px]" style={{ color: B1 }} strokeWidth={2.3} />
              Authorized academic intelligence &amp; documentation pipeline
            </div>
          </div>
          <div className="flex items-center gap-[12px]">
            <div className="relative">
              <Search className="absolute left-[16px] top-1/2 -translate-y-1/2 w-[15px] h-[15px]" style={{ color: "rgba(10,132,255,0.40)" }} strokeWidth={2.3} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-10 pr-5 py-[12px] rounded-[14px] text-[13px] outline-none w-[260px]"
                style={{ background: "#fff", border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D, color: T1, letterSpacing: "-0.1px" }} />
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-normal text-white"
              style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(10,132,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
              {(studentData?.name?.[0] || "S").toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Stat Cards (dashboard 4-stat-card vibe) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            { label: "All Reports", val: reports.length, color: B1,        icon: FileText,    cardBg: "linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(10,132,255,0.03) 100%)",   cardBdr: "rgba(10,132,255,0.20)",  iconBoxBg: "rgba(10,132,255,0.14)",  iconBoxBdr: "rgba(10,132,255,0.28)",  key: "all" as const },
            { label: "PDF Files",   val: pdfCountD,      color: ORANGE,    icon: FileText,    cardBg: "linear-gradient(135deg, rgba(255,149,0,0.13) 0%, rgba(255,149,0,0.04) 100%)", cardBdr: "rgba(255,149,0,0.22)", iconBoxBg: "rgba(255,149,0,0.18)", iconBoxBdr: "rgba(255,149,0,0.32)", key: "pdf" as const },
            { label: "Excel",       val: excelCountD,    color: GREEN,     icon: FileCheck,   cardBg: "linear-gradient(135deg, rgba(52,199,89,0.13) 0%, rgba(52,199,89,0.04) 100%)",   cardBdr: "rgba(52,199,89,0.20)",  iconBoxBg: "rgba(52,199,89,0.18)",  iconBoxBdr: "rgba(52,199,89,0.30)",  key: "excel" as const },
            { label: "Verified",    val: verifiedCountD, color: "#AF52DE", icon: ShieldCheck, cardBg: "linear-gradient(135deg, rgba(175,82,222,0.10) 0%, rgba(175,82,222,0.03) 100%)", cardBdr: "rgba(175,82,222,0.22)", iconBoxBg: "rgba(175,82,222,0.14)", iconBoxBdr: "rgba(175,82,222,0.30)", key: "verified" as const },
          ].map(({ label, val, color, icon: Icon, cardBg, cardBdr, iconBoxBg, iconBoxBdr, key }) => {
            const isAct = formatFilter === key;
            return (
              <button key={label}
                onClick={() => setFormatFilter(key)}
                className="rounded-[22px] px-5 pt-[16px] pb-[16px] relative overflow-hidden text-left cursor-pointer transition-transform hover:-translate-y-0.5"
                style={{
                  background: cardBg,
                  boxShadow: isAct ? `${SH_LG_D}, 0 0 0 2px ${color}` : SH_D,
                  border: `0.5px solid ${cardBdr}`,
                }}>
                <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center mb-[16px] relative"
                  style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                  <Icon className="w-[17px] h-[17px]" style={{ color }} strokeWidth={2.3} />
                </div>
                <div className="text-[12px] font-normal uppercase tracking-[0.10em] relative" style={{ color: T4 }}>{label}</div>
                <div className="text-[28px] font-normal mt-1 leading-none relative" style={{ color, letterSpacing: "-1px" }}>{val}</div>
                {isAct && (
                  <div className="text-[12px] font-normal uppercase tracking-[0.10em] mt-[8px] flex items-center gap-[4px] relative" style={{ color }}>
                    <CheckCircle2 className="w-[11px] h-[11px]" strokeWidth={2.5} /> Active
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Filter chips ── */}
        <div className="flex gap-2 flex-wrap mb-5">
          {FILTERS_D.map(f => {
            const isAct = formatFilter === f.key;
            return (
              <button key={f.key} onClick={() => setFormatFilter(f.key)}
                className="flex items-center gap-2 px-4 py-[8px] rounded-[14px] text-[12px] font-normal transition-transform hover:scale-[1.02]"
                style={isAct ? {
                  background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff",
                  boxShadow: SH_BTN_D, letterSpacing: "-0.1px",
                } : {
                  background: "#fff", color: T3,
                  border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D, letterSpacing: "-0.1px",
                }}>
                {f.label}
                <span className="min-w-[20px] h-[20px] rounded-[6px] flex items-center justify-center text-[12px] font-normal px-[4px]"
                  style={{ background: isAct ? "rgba(255,255,255,0.22)" : "rgba(10,132,255,0.08)", color: isAct ? "#fff" : B1 }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Main Row: Reports grid + Policy dark card ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Reports grid — spans 2 cols */}
          <div className="xl:col-span-2">
            {loading ? (
              <div className="bg-white rounded-[22px] py-10 flex flex-col items-center"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <Loader2 className="w-12 h-12 animate-spin" style={{ color: B1 }} />
                <p className="text-[13px] font-normal mt-3" style={{ color: T4 }}>Accessing Document Repository…</p>
              </div>
            ) : filteredDesktop.length === 0 ? (
              <div className="bg-white rounded-[22px] py-10 px-8 flex flex-col items-center text-center relative overflow-hidden"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="absolute -top-[60px] -right-[40px] w-[240px] h-[240px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(10,132,255,0.05) 0%, transparent 70%)" }} />
                <div className="w-[88px] h-[88px] rounded-[28px] flex items-center justify-center mb-5 relative z-10"
                  style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN_D}, 0 0 0 10px rgba(10,132,255,0.08)` }}>
                  <FileCheck className="w-10 h-10 text-white" strokeWidth={2} />
                </div>
                <div className="text-[22px] font-normal mb-2 relative z-10" style={{ color: T1, letterSpacing: "-0.5px" }}>
                  {searchQuery || formatFilter !== "all" ? "No matches found" : "Repository empty"}
                </div>
                <div className="text-[13px] leading-[1.6] max-w-[400px] relative z-10" style={{ color: T3 }}>
                  {searchQuery
                    ? "Try a different search term."
                    : formatFilter !== "all"
                      ? `No ${formatFilter.toUpperCase()} reports available yet.`
                      : "Official academic reports have not been published by the faculty team yet."}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ perspective: "1200px" }}>
                {filteredDesktop.map((r: any) => {
                  const type = detectFormatD(r);
                  const grad = type === "excel" ? "linear-gradient(135deg, #248A3D, #34C759)" : `linear-gradient(135deg, ${B1}, ${B3})`;
                  const icoSh = type === "excel" ? "0 4px 14px rgba(0,120,48,0.28)" : "0 4px 14px rgba(10,132,255,0.28)";
                  return (
                    <div key={r.id}
                      onMouseEnter={handle3DEnter}
                      onMouseMove={handle3DMove}
                      onMouseLeave={handle3DLeave}
                      onClick={() => handleDownload(r)}
                      className="bg-white rounded-[22px] p-6 relative overflow-hidden cursor-pointer flex flex-col"
                      style={{
                        boxShadow: SH_LG_D,
                        border: "0.5px solid rgba(10,132,255,0.10)",
                        transformStyle: "preserve-3d",
                        willChange: "transform",
                      }}>
                      <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                        style={{ opacity: 0 }} />
                      <div className="absolute -top-[40px] -right-[24px] w-[160px] h-[160px] rounded-full pointer-events-none"
                        style={{ background: "radial-gradient(circle, rgba(10,132,255,0.05) 0%, transparent 70%)" }} />
                      <div className="absolute bottom-4 right-5 opacity-[0.04] pointer-events-none">
                        <FileText size={130} color={B1} strokeWidth={0.6} />
                      </div>

                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4 relative z-10">
                        <div className="w-14 h-14 rounded-[16px] flex items-center justify-center shrink-0"
                          style={{ background: grad, boxShadow: icoSh, transform: "translateZ(22px)" }}>
                          {type === "excel" ? (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
                              <line x1="12" y1="9" x2="12" y2="21" />
                            </svg>
                          ) : <FileText className="w-[26px] h-[26px] text-white" strokeWidth={2.2} />}
                        </div>
                        <div className="flex-1 min-w-0" style={{ transform: "translateZ(12px)" }}>
                          <div className="text-[18px] font-normal mb-[4px] leading-[1.3]" style={{ color: T1, letterSpacing: "-0.3px" }}>
                            {r.title || "Academic Report"}
                          </div>
                          <div className="flex items-center gap-[8px] flex-wrap">
                            <div className="flex items-center gap-[4px] text-[12px] font-normal" style={{ color: T3 }}>
                              <GraduationCap className="w-[12px] h-[12px]" strokeWidth={2.3} />
                              {r.teacherName || "Faculty"}
                            </div>
                            <span className="w-[3px] h-[3px] rounded-full" style={{ background: T4 }} />
                            <div className="flex items-center gap-[4px] text-[12px] font-normal" style={{ color: T3 }}>
                              <Clock className="w-[12px] h-[12px]" strokeWidth={2.3} />
                              {formatDateD(r.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quote */}
                      <div className="rounded-[14px] px-4 py-[16px] mb-5 flex-1 relative z-10"
                        style={{ background: "rgba(10,132,255,0.04)", borderLeft: `3px solid ${B1}`, transform: "translateZ(6px)" }}>
                        <p className="text-[12.5px] italic leading-[1.7]" style={{ color: T2, letterSpacing: "-0.1px" }}>
                          "{r.data?.ai_remark || r.data?.aiRemarks || "Institutional assessment data compiled by the academic department. This document contains verified academic standing and behavioral metrics."}"
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between relative z-10" style={{ transform: "translateZ(14px)" }}>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-[4px] px-[12px] py-[4px] rounded-full text-[12px] font-normal text-white"
                            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 2px 8px rgba(10,132,255,0.30)" }}>
                            <CheckCircle2 className="w-[11px] h-[11px]" strokeWidth={2.5} /> Verified
                          </div>
                          <div className="px-[12px] py-[4px] rounded-full text-[12px] font-normal"
                            style={{ background: type === "excel" ? "rgba(52,199,89,0.10)" : "rgba(10,132,255,0.10)", color: type === "excel" ? "#248A3D" : B1, border: `0.5px solid ${type === "excel" ? "rgba(52,199,89,0.22)" : BLUE_BDR}` }}>
                            {(r.format || type).toUpperCase()}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDownload(r); }}
                          className="h-10 px-5 rounded-[12px] flex items-center gap-2 text-[12px] font-normal text-white transition-transform hover:scale-[1.03]"
                          style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }}>
                          <Download className="w-4 h-4" strokeWidth={2.3} /> Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Policy + Summary sidebar */}
          <div className="space-y-4">
            {/* Policy dark card with 3D hover */}
            <div
              onMouseEnter={handle3DEnter}
              onMouseMove={handle3DMove}
              onMouseLeave={handle3DLeave}
              className="rounded-[22px] p-8 relative overflow-hidden text-white"
              style={{
                background: "linear-gradient(140deg, #0A84FF 0%, #0A84FF 48%, #0A84FF 100%)",
                boxShadow: "0 8px 30px rgba(0,51,204,0.34), 0 0 0 0.5px rgba(255,255,255,0.14)",
                transformStyle: "preserve-3d",
                willChange: "transform",
              }}>
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{ opacity: 0 }} />
              <div className="absolute -top-[50px] -right-[32px] w-[220px] h-[220px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }} />
              <div className="relative z-10" style={{ transform: "translateZ(14px)" }}>
                <div className="inline-flex items-center gap-[4px] px-3 py-[4px] rounded-full mb-4 text-[12px] font-normal uppercase tracking-[0.12em]"
                  style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.80)", backdropFilter: "blur(8px)" }}>
                  <ShieldCheck className="w-[11px] h-[11px]" strokeWidth={2.5} />
                  Infrastructure Policy
                </div>
                <div className="text-[22px] font-normal leading-[1.2] mb-3" style={{ letterSpacing: "-0.5px" }}>
                  Document Infrastructure
                </div>
                <p className="text-[13px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Academic reports are generated by the <strong style={{ color: "#fff", fontWeight: 400 }}>instructional faculty</strong> and mirrored to the parent portal. All documents are encrypted, verified, and timestamped.
                </p>
                <div className="h-[0.5px] my-4" style={{ background: "rgba(255,255,255,0.16)" }} />
                <div className="space-y-3">
                  {[
                    { icon: ShieldCheck, text: "End-to-end encrypted storage" },
                    { icon: Clock, text: "Real-time faculty synchronization" },
                    { icon: CheckCircle2, text: "All reports faculty-verified" },
                    { icon: ArrowRightCircle, text: "30-day retention · direct sync" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)" }}>
                        <Icon className="w-[14px] h-[14px]" style={{ color: "rgba(255,255,255,0.85)" }} strokeWidth={2.3} />
                      </div>
                      <span className="text-[12px] font-normal" style={{ color: "rgba(255,255,255,0.80)", letterSpacing: "-0.1px" }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Insight card */}
            <div
              onMouseEnter={handle3DEnter}
              onMouseMove={handle3DMove}
              onMouseLeave={handle3DLeave}
              className="bg-white rounded-[22px] p-5 relative overflow-hidden"
              style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)", transformStyle: "preserve-3d", willChange: "transform" }}>
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
              <div className="absolute -top-[20px] -right-[20px] w-[120px] h-[120px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(175,82,222,0.08) 0%, transparent 70%)" }} />
              <div className="flex items-center gap-3 mb-3 relative z-10" style={{ transform: "translateZ(12px)" }}>
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #AF52DE, #AF52DE)", boxShadow: "0 3px 12px rgba(175,82,222,0.28)" }}>
                  <Sparkles className="w-5 h-5 text-white" strokeWidth={2.3} />
                </div>
                <div>
                  <div className="text-[15px] font-normal" style={{ color: T1, letterSpacing: "-0.2px" }}>AI Quick Insights</div>
                  <div className="text-[12px] font-normal" style={{ color: T3 }}>Auto-generated this term</div>
                </div>
              </div>
              <div className="space-y-2 relative z-10" style={{ transform: "translateZ(6px)" }}>
                {[
                  { label: "Total published", val: reports.length },
                  { label: "This month", val: reports.filter((r: any) => {
                    const d = r.createdAt?.toDate?.();
                    return d && d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
                  }).length },
                  { label: "PDF / Excel", val: `${pdfCountD} / ${excelCountD}` },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between py-[8px]" style={{ borderBottom: `0.5px solid ${BLUE_BDR}` }}>
                    <span className="text-[12px] font-normal uppercase tracking-[0.08em]" style={{ color: T4 }}>{label}</span>
                    <span className="text-[15px] font-normal" style={{ color: B1, letterSpacing: "-0.3px" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
