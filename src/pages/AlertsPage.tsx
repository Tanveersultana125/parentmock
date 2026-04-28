import { useState, useEffect } from "react";
import {
  AlertCircle, Clock, Trophy, Calendar, User,
  Loader2, BellRing, CheckCircle, BookOpen, ShieldAlert, Sparkles,
  MessageSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { db } from "@/lib/firebase";
import { scopedQuery } from "@/lib/scopedQuery";
import { subscribeEnrollments } from "@/lib/enrollmentQuery";
import {
  where, onSnapshot,
  doc, updateDoc
} from "firebase/firestore";
import { toast } from "sonner";

const filterTabs = ["All", "Academic", "Attendance", "General"];

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

// Firestore-Timestamp-shaped helper
const _alTs = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};
const _alDateStr = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// 2 teacher-flagged risk items (one Critical academic, one Medium attendance)
const MOCK_RISKS: any[] = [
  { id: "risk1", type: "Grades",      severity: "Critical",        issue: "Below-passing score in Probability assessment", details: ["Scored 55% in Probability Drill", "Subject average dropped 12% over last 3 weeks"], teacherName: "Mrs. Priya Mehta", createdAt: _alTs(2),  resolved: false, studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "risk2", type: "Behavior",    severity: "Medium Priority", issue: "Talkativeness in CS Lab",                       details: ["Two reminders during the last two CS Lab sessions", "Project quality remains excellent"],     teacherName: "Ms. Neha Iyer",    createdAt: _alTs(5),  resolved: false, studentId: "mock-student-001", schoolId: "mock-school-001" },
];

// Focused 30-day attendance window — 2 absences + 1 late = 3 attendance alerts
const MOCK_ATTENDANCE: any[] = [
  { id: "att-a1", date: _alDateStr(4),  status: "absent",  teacherName: "Mrs. Priya Mehta", createdAt: _alTs(4),  studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "att-a2", date: _alDateStr(11), status: "absent",  teacherName: "Mrs. Priya Mehta", createdAt: _alTs(11), studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "att-l1", date: _alDateStr(7),  status: "late",    arrivalTime: "08:42 AM", teacherName: "Mrs. Priya Mehta", createdAt: _alTs(7),  studentId: "mock-student-001", schoolId: "mock-school-001" },
  // Background present-records so attendance % displays correctly
  ...Array.from({ length: 22 }, (_, i) => ({
    id: `att-p${i}`, date: _alDateStr(i + 1), status: "present", teacherName: "Mrs. Priya Mehta", createdAt: _alTs(i + 1), studentId: "mock-student-001", schoolId: "mock-school-001",
  })).filter(r => !["att-a1", "att-a2", "att-l1"].includes(r.id) && ![4, 11, 7].includes(parseInt(r.date.split("-")[2]))),
];

// 5 test scores → 3 Good News + 1 Below Passing = 4 score-driven alerts
const MOCK_SCORES: any[] = [
  { id: "sc1", testName: "Algebra Class Test",     subject: "Mathematics",  score: 46, maxScore: 50,  percentage: 92, timestamp: _alTs(3),  teacherName: "Mrs. Priya Mehta", studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "sc2", testName: "Vyakaran Test",          subject: "Hindi",        score: 44, maxScore: 50,  percentage: 88, timestamp: _alTs(12), teacherName: "Mrs. Sunita Verma", studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "sc3", testName: "HTML Basics Test",       subject: "Computer Science", score: 19, maxScore: 20, percentage: 95, timestamp: _alTs(28), teacherName: "Ms. Neha Iyer", studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "sc4", testName: "Probability Drill",      subject: "Mathematics",  score: 11, maxScore: 20,  percentage: 55, timestamp: _alTs(2),  teacherName: "Mrs. Priya Mehta", studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "sc5", testName: "Acids, Bases & Salts",   subject: "Science",      score: 13, maxScore: 20,  percentage: 65, timestamp: _alTs(54), teacherName: "Dr. Anil Reddy",   studentId: "mock-student-001", schoolId: "mock-school-001" },
];

// 7 assignments + 4 submissions → 2 overdue + 1 due-soon = 3 assignment alerts
const MOCK_ASSIGNMENTS: any[] = [
  { id: "as1", title: "Mathematics Chapter 5 Worksheet",        classId: "mock-class-001", subject: "Mathematics",      teacherName: "Mrs. Priya Mehta",  dueDate: _alTs(-2).toDate().toISOString() },
  { id: "as2", title: "Science Lab Report — Photosynthesis",    classId: "mock-class-001", subject: "Science",          teacherName: "Dr. Anil Reddy",    dueDate: _alTs(-3).toDate().toISOString() },
  { id: "as3", title: "English Essay — My Hero",                classId: "mock-class-001", subject: "English",          teacherName: "Mr. Kiran Patel",   dueDate: _alTs(-5).toDate().toISOString() },
  { id: "as4", title: "Hindi Vyakaran Exercise",                classId: "mock-class-001", subject: "Hindi",            teacherName: "Mrs. Sunita Verma", dueDate: _alTs(2).toDate().toISOString() },
  { id: "as5", title: "Social Studies Map Work",                classId: "mock-class-001", subject: "Social Studies",   teacherName: "Mr. Rahul Khanna",  dueDate: _alTs(-1).toDate().toISOString() },
  { id: "as6", title: "Computer Science Project — HTML Resume", classId: "mock-class-001", subject: "Computer Science", teacherName: "Ms. Neha Iyer",     dueDate: _alTs(7).toDate().toISOString() },
  { id: "as7", title: "Mathematics Practice Set — Mensuration", classId: "mock-class-001", subject: "Mathematics",      teacherName: "Mrs. Priya Mehta",  dueDate: _alTs(4).toDate().toISOString() },
];

const MOCK_SUBMISSIONS: any[] = [
  { id: "sub1", homeworkId: "as1", studentId: "mock-student-001", schoolId: "mock-school-001", timestamp: _alTs(1) },
  { id: "sub2", homeworkId: "as2", studentId: "mock-student-001", schoolId: "mock-school-001", timestamp: _alTs(2) },
  { id: "sub3", homeworkId: "as3", studentId: "mock-student-001", schoolId: "mock-school-001", timestamp: _alTs(3) },
  { id: "sub5", homeworkId: "as5", studentId: "mock-student-001", schoolId: "mock-school-001", timestamp: _alTs(0) },
];

// 3 parent_notes (focused — most actionable ones from BehaviourPage)
const MOCK_NOTES: any[] = [
  { id: "pn1", category: "positive",    teacherName: "Dr. Anil Reddy",    content: "Excellent teamwork during today's photosynthesis lab. Aarav led his group calmly and made sure everyone got a chance to handle the equipment.",      createdAt: _alTs(3),  studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "pn2", category: "improvement", teacherName: "Mr. Kiran Patel",   content: "Aarav forgot to bring his English reading log to class for the second time this week. Please help him build a routine of packing his bag the previous evening.", createdAt: _alTs(18), studentId: "mock-student-001", schoolId: "mock-school-001" },
  { id: "pn3", category: "positive",    teacherName: "Mrs. Priya Mehta",  content: "Volunteered to be the class monitor this week and managed responsibilities maturely. Distributed worksheets and reported absences accurately.",         createdAt: _alTs(15), studentId: "mock-student-001", schoolId: "mock-school-001" },
];

// 4 AI-generated smart alerts — proactive insights across categories
const MOCK_SMART_ALERTS: any[] = [
  {
    id: "sa1",
    title: "📚 Probability concept needs revision",
    description: "Aarav's Probability score (55%) is significantly below his class average (84%). Recommend 20 minutes of focused practice on probability tree problems daily this week, plus a brief 1-on-1 with Mrs. Mehta to clarify dependent vs independent events.",
    category: "Academic",
    priority: "High Priority",
    teacherName: "Edullent AI Engine",
    createdAt: _alTs(1),
    resolved: false,
    studentId: "mock-student-001",
    schoolId: "mock-school-001",
  },
  {
    id: "sa2",
    title: "🏆 Mathematics performance trending up",
    description: "Three consecutive A grades in Mathematics (92%, 90%, 86%). This is the strongest trajectory of all subjects. Consider enrolling Aarav in the upcoming Mathematics Olympiad to keep him challenged.",
    category: "Academic",
    priority: "Good News",
    teacherName: "Edullent AI Engine",
    createdAt: _alTs(2),
    resolved: false,
    studentId: "mock-student-001",
    schoolId: "mock-school-001",
  },
  {
    id: "sa3",
    title: "📅 Two upcoming tests within 7 days",
    description: "Mathematics test on Friday (Algebra & Linear Equations) and Science quiz on Monday (Force, Motion & Energy). Suggest 30 mins revision per subject across the next 4 evenings — start with the topics Aarav scored lowest on in the last assessment.",
    category: "Academic",
    priority: "Medium Priority",
    teacherName: "Edullent AI Engine",
    createdAt: _alTs(0),
    resolved: false,
    studentId: "mock-student-001",
    schoolId: "mock-school-001",
  },
  {
    id: "sa4",
    title: "🎯 Parent–Teacher Meeting reminder",
    description: "Term 2 PTM scheduled for 5th May at 10:00 AM. Discussion topics queued: English reading speed, probability concept clarity, Mathematics Olympiad enrolment. Please confirm attendance via the Teacher Notes page.",
    category: "General",
    priority: "Medium Priority",
    teacherName: "Principal Office",
    createdAt: _alTs(7),
    resolved: false,
    studentId: "mock-student-001",
    schoolId: "mock-school-001",
  },
];

interface ParsedAlert {
  id: string;
  title: string;
  description: string;
  category: "Academic" | "Attendance" | "General";
  priority: "High Priority" | "Medium Priority" | "Good News" | "General";
  createdAt: any;
  teacherName?: string;
  date?: string;
  arrivalTime?: string;
  source: string; // which collection it came from
  sourceId?: string; // for dismissing in Firestore
  dismissed?: boolean;
}

const AlertsPage = () => {
  const { studentData: _liveStudentData } = useAuth();
  const studentData = USE_MOCK_DATA ? MOCK_STUDENT_DATA : _liveStudentData;
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(USE_MOCK_DATA ? false : true);
  // Key scoped per user — prevents Parent A's dismissed list leaking to Parent B
  const dismissKey = `dismissed_alerts_${studentData?.id || "anon"}`;
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`dismissed_alerts_${studentData?.id || "anon"}`) || "[]")); }
    catch { return new Set(); }
  });

  // Raw data from Firebase (or pre-seeded mocks above)
  const [risks, setRisks] = useState<any[]>(USE_MOCK_DATA ? MOCK_RISKS : []);
  const [attendance, setAttendance] = useState<any[]>(USE_MOCK_DATA ? MOCK_ATTENDANCE : []);
  const [scores, setScores] = useState<any[]>(USE_MOCK_DATA ? MOCK_SCORES : []);
  const [notes, setNotes] = useState<any[]>(USE_MOCK_DATA ? MOCK_NOTES : []);
  const [assignments, setAssignments] = useState<any[]>(USE_MOCK_DATA ? MOCK_ASSIGNMENTS : []);
  const [submissions, setSubmissions] = useState<any[]>(USE_MOCK_DATA ? MOCK_SUBMISSIONS : []);
  const [smartAlerts, setSmartAlerts] = useState<any[]>(USE_MOCK_DATA ? MOCK_SMART_ALERTS : []);

  useEffect(() => {
    if (USE_MOCK_DATA) return; // Mock mode: all 7 raw datasets pre-seeded above
    if (!studentData?.id) return;
    setLoading(true);
    const sid = studentData.id;
    const schoolId = studentData.schoolId;

    const unsubs: (() => void)[] = [];
    let loaded = 0;
    const total = 6; // collections: risks, attendance, test_scores, notes, smartAlerts, submissions (enrollments→assignments handled separately)

    const done = () => { loaded++; if (loaded >= total) setLoading(false); };

    // Single scoped query helper — one listener per collection, filtered by schoolId when available.
    // `done()` runs on both success and error so the spinner is never stuck when one
    // source returns permission-denied (rule rejection does not progress the counter otherwise).
    const scopedSnap = (collName: string, setter: (docs: any[]) => void) => {
      const q = scopedQuery(collName, schoolId, where("studentId", "==", sid));
      const u = onSnapshot(
        q,
        snap => {
          setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          done();
        },
        (err) => {
          console.error(`[Alerts] ${collName} listener error:`, err);
          setter([]);
          done();
        },
      );
      unsubs.push(u);
    };

    // 1. risks
    scopedSnap("risks", setRisks);

    // 2. attendance
    scopedSnap("attendance", setAttendance);

    // 3. test_scores + gradebook_scores merged
    let tsSnap: any = null, gbSnap: any = null;
    const processScores = () => {
      const ts = (tsSnap?.docs || []).map((d: any) => ({ id: d.id, ...d.data() }));
      const gb = (gbSnap?.docs || []).map((d: any) => ({
        id: d.id, ...d.data(),
        testName: d.data().columnName || "Class Assessment",
        score: d.data().mark, maxScore: d.data().maxMarks || 100
      }));
      const all = new Map();
      [...ts, ...gb].forEach(d => { if (!all.has(d.id)) all.set(d.id, d); });
      setScores(Array.from(all.values()));
    };
    const tsQ = scopedQuery("test_scores", schoolId, where("studentId", "==", sid));
    const gbQ = scopedQuery("gradebook_scores", schoolId, where("studentId", "==", sid));
    unsubs.push(
      onSnapshot(tsQ, s => { tsSnap = s; processScores(); done(); }, (err) => {
        console.error("[Alerts] test_scores listener error:", err);
        done();
      }),
      onSnapshot(gbQ, s => { gbSnap = s; processScores(); }, (err) => {
        console.error("[Alerts] gradebook_scores listener error:", err);
      })
    );

    // 4. parent_notes
    scopedSnap("parent_notes", setNotes);

    // 5. student_smart_alerts
    scopedSnap("student_smart_alerts", setSmartAlerts);

    // 6. submissions
    scopedSnap("submissions", setSubmissions);

    // 7. enrollments → classIds → assignments
    // Uses chunked "in" queries to handle >10 classIds (Firestore limit)
    let enrollSnap: any = null;
    const assignUnsubs: (() => void)[] = [];
    const processEnrollments = () => {
      const classIds = [...new Set((enrollSnap?.docs || []).map((d: any) => d.data().classId).filter(Boolean))] as string[];
      assignUnsubs.forEach(u => u());
      assignUnsubs.length = 0;
      if (classIds.length === 0) return;

      const chunks: string[][] = [];
      for (let i = 0; i < classIds.length; i += 10) chunks.push(classIds.slice(i, i + 10));

      const allAssignments: Map<string, any> = new Map();
      chunks.forEach(chunk => {
        const q = scopedQuery("assignments", schoolId, where("classId", "in", chunk));
        const u = onSnapshot(q, snap => {
          snap.docs.forEach(d => allAssignments.set(d.id, { id: d.id, ...d.data() }));
          setAssignments(Array.from(allAssignments.values()));
        }, (err) => {
          console.error("[Alerts] assignments chunk listener error:", err);
        });
        assignUnsubs.push(u);
      });
    };
    // Dual-listener helper — also matches legacy enrollments where studentId
    // was stored as the email by older teacher/principal-dashboard writes.
    unsubs.push(subscribeEnrollments(studentData, (docs) => {
      enrollSnap = { docs };
      processEnrollments();
    }));

    return () => {
      unsubs.forEach(u => u());
      assignUnsubs.forEach(u => u());
    };
  }, [studentData?.id, studentData?.schoolId]);

  // Build parsed alerts from all sources
  const buildAlerts = (): ParsedAlert[] => {
    const result: ParsedAlert[] = [];
    const name = studentData?.name || "Student";
    const now = Date.now();

    // ── SOURCE 1: risks collection (teacher-created flags) ──
    risks
      .filter(r => !r.resolved)
      .forEach(r => {
        const catMap: Record<string, ParsedAlert["category"]> = {
          Attendance: "Attendance", Grades: "Academic",
          Submissions: "Academic", Behavior: "General"
        };
        const priMap: Record<string, ParsedAlert["priority"]> = {
          Critical: "High Priority", "High Priority": "High Priority",
          "Medium Priority": "Medium Priority"
        };
        result.push({
          id: `risk_${r.id}`,
          title: r.issue || "Risk Flag",
          description: Array.isArray(r.details) ? r.details.join(" · ") : (r.issue || ""),
          category: catMap[r.type] || "General",
          priority: priMap[r.severity] || "Medium Priority",
          createdAt: r.createdAt || null,
          teacherName: r.teacherName || "",
          source: "risks",
          sourceId: r.id
        });
      });

    // ── SOURCE 2: attendance (absent = High, late = Medium) ──
    // Pre-compute attendance context for storytelling
    const absentRecords = attendance.filter(a => a.status === "absent");
    const totalAbsences = absentRecords.length;
    const absentDayNums = absentRecords.map(a => {
      const parts = (a.date || "").split("-");
      return parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]).getDay() : -1;
    }).filter(d => d >= 0);
    const dayTally = absentDayNums.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {} as Record<number, number>);
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const topAbsentDays = Object.entries(dayTally).sort((a, b) => +b[1] - +a[1]).slice(0, 2).map(([d]) => DAYS[+d]);
    const dayPattern = topAbsentDays.length > 0 ? ` (mostly ${topAbsentDays.join(" and ")})` : "";
    const lowScoreSubjects = scores.filter(s => {
      const pct = s.percentage ?? (s.maxScore > 0 ? s.score / s.maxScore * 100 : 0);
      return pct < 60;
    });
    const academicImpact = lowScoreSubjects.length > 0
      ? ` This is directly affecting grades — ${lowScoreSubjects.length} subject${lowScoreSubjects.length > 1 ? "s are" : " is"} currently below the passing threshold.`
      : " Regular attendance is essential to stay on top of the curriculum.";
    const totalLates = attendance.filter(a => a.status === "late").length;

    attendance.forEach(a => {
      if (a.status === "absent") {
        const absenceStory = totalAbsences === 1
          ? `${name} was absent on ${fmtDateStr(a.date)}. This is their first recorded absence this term — please ensure it doesn't become a pattern.`
          : `${name} has been absent ${totalAbsences} time${totalAbsences > 1 ? "s" : ""} this term${dayPattern}.${academicImpact}`;
        result.push({
          id: `att_absent_${a.id}`,
          title: totalAbsences > 2 ? `Repeated Absences — ${totalAbsences} This Term` : "Absence Recorded",
          description: absenceStory,
          category: "Attendance",
          priority: "High Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          date: a.date,
          source: "attendance"
        });
      } else if (a.status === "late") {
        const lateStory = `${name} arrived late on ${fmtDateStr(a.date)}${a.arrivalTime || a.time ? ` at ${a.arrivalTime || a.time}` : ""}. This is their ${totalLates === 1 ? "first" : `${totalLates}th`} late arrival this term — arriving on time ensures ${name.split(" ")[0]} doesn't miss the start of lessons.`;
        result.push({
          id: `att_late_${a.id}`,
          title: "Late Arrival Recorded",
          description: lateStory,
          category: "Attendance",
          priority: "Medium Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          date: a.date,
          arrivalTime: a.arrivalTime || a.time || "",
          source: "attendance"
        });
      }
    });

    // ── SOURCE 3: test_scores / gradebook_scores ──
    // IMPORTANT: AssignmentsPage writes the submission as `homeworkId` (the
    // assignment doc id), not `assignmentId`. Earlier we only checked
    // `assignmentId`, so any already-submitted homework still fired an
    // "Overdue" alert — a straight-up false positive to the parent. Check
    // both field names to cover current writes and legacy records.
    const submittedIds = new Set(
      submissions.flatMap(s => [s.homeworkId, s.assignmentId].filter(Boolean)),
    );
    scores.forEach(s => {
      const pct = s.percentage ?? (s.maxScore > 0 ? (s.score / s.maxScore * 100) : 0);
      const sub = s.subject || "a subject";
      const testName = s.testName || "a test";

      if (pct >= 85) {
        // Find how many tests in this subject scored high
        const subjectHighScores = scores.filter(s2 => s2.subject === sub && (s2.percentage ?? (s2.maxScore > 0 ? s2.score/s2.maxScore*100 : 0)) >= 85).length;
        const story = subjectHighScores > 1
          ? `${name} scored ${Math.round(pct)}% in "${testName}" — their ${subjectHighScores === 2 ? "second" : `${subjectHighScores}th`} strong result in ${sub} this term. This consistent excellence is worth celebrating and encouraging at home!`
          : `${name} scored an impressive ${Math.round(pct)}% in "${testName}" (${sub}). Hard work is clearly paying off — keep encouraging this momentum!`;
        result.push({
          id: `score_good_${s.id}`,
          title: `Excellent in ${sub}! 🎉`,
          description: story,
          category: "Academic",
          priority: "Good News",
          createdAt: s.timestamp || s.createdAt || null,
          teacherName: s.teacherName || "",
          source: "test_scores"
        });
      } else if (pct < 60 && pct > 0) {
        // Calculate subject average and trend
        const subScores = scores.filter(s2 => s2.subject === sub).map(s2 => s2.percentage ?? (s2.maxScore > 0 ? s2.score/s2.maxScore*100 : 0));
        const subAvg = subScores.length > 0 ? Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length) : Math.round(pct);
        const isTrending = subScores.length > 1 && subScores[subScores.length - 1] < subScores[0];
        const trendNote = isTrending ? ` Performance in ${sub} has been declining — early intervention is key.` : ` Focused revision before the next assessment can make a significant difference.`;
        const story = `${name} scored ${Math.round(pct)}% in "${testName}" (${sub}). The current subject average is ${subAvg}%.${trendNote}`;
        result.push({
          id: `score_low_${s.id}`,
          title: `Below Passing — ${sub}`,
          description: story,
          category: "Academic",
          priority: "High Priority",
          createdAt: s.timestamp || s.createdAt || null,
          teacherName: s.teacherName || "",
          source: "test_scores"
        });
      }
    });

    // ── SOURCE 4: assignments (overdue + due soon) ──
    assignments.forEach(a => {
      if (!a.dueDate) return;
      const due = a.dueDate?.toMillis?.() || new Date(a.dueDate).getTime();
      if (!due) return;
      const alreadySubmitted = submittedIds.has(a.id);
      if (alreadySubmitted) return;

      const diffMs = due - now;
      const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));

      if (diffMs < 0) {
        const daysOverdue = Math.abs(Math.ceil(diffMs / (1000 * 3600 * 24)));
        const urgency = daysOverdue > 7 ? "This significantly impacts the term grade and requires immediate attention." : daysOverdue > 3 ? "Submitting it now — even late — is better than leaving it incomplete. Contact the teacher if an extension is needed." : "This was just missed — submitting it now with a brief apology note to the teacher may still earn partial credit.";
        result.push({
          id: `assign_overdue_${a.id}`,
          title: `Assignment Overdue — ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""}`,
          description: `"${a.title}" was due on ${fmtTs(a.dueDate)} and remains unsubmitted. ${urgency}`,
          category: "Academic",
          priority: "High Priority",
          createdAt: a.dueDate,
          teacherName: a.teacherName || "",
          source: "assignments"
        });
      } else if (diffDays <= 3) {
        const urgency = diffDays === 1 ? "Due TOMORROW — action needed today." : `Due in ${diffDays} days — plan time tonight to complete it.`;
        result.push({
          id: `assign_soon_${a.id}`,
          title: `Due ${diffDays === 1 ? "Tomorrow" : `in ${diffDays} Days`} — ${a.title}`,
          description: `"${a.title}" is due on ${fmtTs(a.dueDate)}. ${urgency} Submitting on time keeps ${name.split(" ")[0]}'s completion record strong.`,
          category: "Academic",
          priority: "Medium Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          source: "assignments"
        });
      }
    });

    // ── SOURCE 5: parent_notes (teacher notes to parent) ──
    notes.forEach(n => {
      const isPositive = (n.category || "").toLowerCase().includes("positive") || (n.category || "").toLowerCase().includes("praise");
      result.push({
        id: `note_${n.id}`,
        title: isPositive ? "Positive Note from Teacher" : "Teacher Note",
        description: n.content || "A note from your teacher.",
        category: "General",
        priority: isPositive ? "Good News" : "Medium Priority",
        createdAt: n.createdAt || null,
        teacherName: n.teacherName || "",
        source: "parent_notes"
      });
    });

    // ── SOURCE 6: student_smart_alerts (AI-generated) ──
    smartAlerts
      .filter(a => !a.resolved)
      .forEach(a => {
        const cat = a.category === "Behavior" ? "General" : (a.category || "General");
        result.push({
          id: `smart_${a.id}`,
          title: a.title || "Alert",
          description: a.description || "",
          category: cat as ParsedAlert["category"],
          priority: a.priority || "Medium Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          source: "student_smart_alerts",
          sourceId: a.id
        });
      });

    // Deduplicate by id, filter dismissed
    const seen = new Set<string>();
    return result
      .filter(a => !dismissed.has(a.id) && !seen.has(a.id) && seen.add(a.id))
      .sort((a, b) => {
        const order: Record<string, number> = { "High Priority": 0, "Medium Priority": 1, "Good News": 2, General: 3 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      });
  };

  const allAlerts = buildAlerts();

  const dismissAlert = async (alert: ParsedAlert) => {
    // Mark dismissed in local state + localStorage
    const next = new Set(dismissed);
    next.add(alert.id);
    setDismissed(next);
    localStorage.setItem(dismissKey, JSON.stringify([...next]));

    // If it came from a Firestore-writable source, persist it
    if (alert.source === "student_smart_alerts" && alert.sourceId) {
      try {
        await updateDoc(doc(db, "student_smart_alerts", alert.sourceId), { resolved: true });
      } catch { /* ignore */ }
    }
    if (alert.source === "risks" && alert.sourceId) {
      try {
        await updateDoc(doc(db, "risks", alert.sourceId), { resolved: true });
      } catch { /* ignore */ }
    }
    toast.success("Alert dismissed.");
  };

  const markAllRead = () => {
    const next = new Set(dismissed);
    allAlerts.forEach(a => next.add(a.id));
    setDismissed(next);
    localStorage.setItem(dismissKey, JSON.stringify([...next]));
    toast.success("All alerts dismissed.");
  };

  const filteredAlerts = allAlerts.filter(a => {
    const tab = filterTabs[activeTab];
    return tab === "All" || a.category === tab;
  });

  // ── Feature 16: AI Action Recommendations ────────────────────────────────
  type Action = { label: string; primary: boolean; color?: string; onClick: () => void };
  const getActions = (alert: ParsedAlert): Action[] => {
    const go = (path: string) => () => navigate(path);
    const dismiss = () => dismissAlert(alert);

    if (alert.category === "Attendance" && alert.priority === "High Priority")
      return [
        { label: "📞 Schedule Teacher Call", primary: true, color: "bg-rose-600 hover:bg-rose-700 text-white", onClick: go("/teacher-notes") },
        { label: "View Attendance Report", primary: false, onClick: go("/attendance") },
      ];

    if (alert.category === "Attendance")
      return [
        { label: "💬 Message Teacher", primary: true, color: "bg-blue-600 hover:bg-blue-700 text-white", onClick: go("/teacher-notes") },
        { label: "Acknowledge", primary: false, onClick: dismiss },
      ];

    if (alert.source === "test_scores" && alert.priority === "High Priority")
      return [
        { label: "📚 Request Extra Support", primary: true, color: "bg-indigo-600 hover:bg-indigo-700 text-white", onClick: go("/teacher-notes") },
        { label: "View Performance", primary: false, onClick: go("/performance") },
      ];

    if (alert.source === "assignments" && alert.priority === "High Priority")
      return [
        { label: "📤 Submit Now", primary: true, color: "bg-slate-900 hover:bg-slate-800 text-white", onClick: go("/assignments") },
        { label: "💬 Message Teacher", primary: false, onClick: go("/teacher-notes") },
      ];

    if (alert.source === "assignments" && alert.priority === "Medium Priority")
      return [
        { label: "⏰ Go to Assignments", primary: true, color: "bg-amber-500 hover:bg-amber-600 text-white", onClick: go("/assignments") },
        { label: "Dismiss", primary: false, onClick: dismiss },
      ];

    if (alert.priority === "Good News")
      return [
        { label: "🎉 View Full Performance", primary: true, color: "bg-emerald-600 hover:bg-emerald-700 text-white", onClick: go("/performance") },
        { label: "Acknowledge", primary: false, onClick: dismiss },
      ];

    if (alert.source === "parent_notes")
      return [
        { label: "💬 Reply to Teacher", primary: true, color: "bg-blue-600 hover:bg-blue-700 text-white", onClick: go("/teacher-notes") },
        { label: "Acknowledge", primary: false, onClick: dismiss },
      ];

    if (alert.source === "risks")
      return [
        { label: "📞 Contact Teacher Now", primary: true, color: "bg-rose-600 hover:bg-rose-700 text-white", onClick: go("/teacher-notes") },
        { label: "Dismiss", primary: false, onClick: dismiss },
      ];

    return [
      { label: "View Details", primary: true, color: "bg-indigo-600 hover:bg-indigo-700 text-white", onClick: go("/performance") },
      { label: "Dismiss", primary: false, onClick: dismiss },
    ];
  };

  const getTabCount = (tab: string) =>
    tab === "All" ? allAlerts.length : allAlerts.filter(a => a.category === tab).length;

  // ═══════════════════════════════════════════════════════════════
  // MOBILE — Blue Premium UI
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    const B1 = "#0A84FF", B2 = "#3395FF";
    const BG = "#F5F5F7", BG2 = "#EBEBF0", CARD = "#FFFFFF";
    const T1 = "#1D1D1F", T2 = "#3A3A3C", T3 = "#6E6E73", T4 = "#A1A1A6";
    const SH    = "0 0 0 0.5px rgba(10,132,255,0.08), 0 2px 8px rgba(10,132,255,0.08), 0 10px 28px rgba(10,132,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(10,132,255,0.10), 0 4px 16px rgba(10,132,255,0.11), 0 20px 48px rgba(10,132,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(10,132,255,0.40), 0 2px 5px rgba(10,132,255,0.20)";
    const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', sans-serif";

    const avatarChar = (studentData?.name?.[0] || "S").toUpperCase();

    const isRecent = (ts: any) => {
      const d = ts?.toDate?.() || null;
      if (!d) return false;
      return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
    };

    const fmtAlertDate = (ts: any) => {
      if (isRecent(ts)) return "Recent";
      const d = ts?.toDate?.();
      if (!d) return "—";
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    // Priority → visual theme
    type Theme = {
      stripe: string; iconGrad: string; iconShadow: string;
      badgeBg: string; badgeBdr: string; badgeText: string;
      emoji: string; label: string;
    };
    const themeFor = (p: ParsedAlert["priority"]): Theme => {
      if (p === "High Priority") return {
        stripe: "linear-gradient(180deg, #FF3B30, #FF5E55)",
        iconGrad: "linear-gradient(135deg, #FF3B30, #FF5E55)",
        iconShadow: "0 3px 12px rgba(255,59,48,0.28)",
        badgeBg: "rgba(255,59,48,0.09)", badgeBdr: "rgba(255,59,48,0.20)", badgeText: "#FF3B30",
        emoji: "🔴", label: "High Priority",
      };
      if (p === "Medium Priority") return {
        stripe: "linear-gradient(180deg, #FF9500, #FFCC00)",
        iconGrad: "linear-gradient(135deg, #FF9500, #FFCC00)",
        iconShadow: "0 3px 12px rgba(255,149,0,0.28)",
        badgeBg: "rgba(255,149,0,0.09)", badgeBdr: "rgba(255,149,0,0.20)", badgeText: "#86310C",
        emoji: "🟡", label: "Medium Priority",
      };
      if (p === "Good News") return {
        stripe: "linear-gradient(180deg, #34C759, #34C759)",
        iconGrad: "linear-gradient(135deg, #34C759, #34C759)",
        iconShadow: "0 3px 12px rgba(52,199,89,0.24)",
        badgeBg: "rgba(52,199,89,0.09)", badgeBdr: "rgba(52,199,89,0.20)", badgeText: "#248A3D",
        emoji: "🟢", label: "Great Work",
      };
      return {
        stripe: "linear-gradient(180deg, #0A84FF, #3395FF)",
        iconGrad: "linear-gradient(135deg, #0A84FF, #3395FF)",
        iconShadow: "0 3px 12px rgba(10,132,255,0.26)",
        badgeBg: "rgba(10,132,255,0.09)", badgeBdr: "rgba(10,132,255,0.20)", badgeText: "#0A84FF",
        emoji: "🔵", label: "General",
      };
    };

    const iconFor = (a: ParsedAlert) => {
      if (a.priority === "Good News") return CheckCircle;
      if (a.category === "Attendance" && a.priority === "High Priority") return AlertCircle;
      if (a.category === "Attendance") return Calendar;
      if (a.source === "parent_notes") return MessageSquare;
      if (a.source === "assignments" || a.category === "Academic") return BookOpen;
      if (a.source === "risks") return ShieldAlert;
      return AlertCircle;
    };

    const unreadCount = allAlerts.filter(a => isRecent(a.createdAt)).length;
    const highCount = allAlerts.filter(a => a.priority === "High Priority").length;

    if (loading) {
      return (
        <div className="-mx-3 -mt-3 flex items-center justify-center" style={{ background: BG, minHeight: "100vh", fontFamily: FONT }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: B1 }} />
        </div>
      );
    }

    return (
      <div className="-mx-3 -mt-3 md:mx-0 md:mt-0 animate-in fade-in duration-500"
        style={{ background: BG, minHeight: "100vh", fontFamily: FONT }}>

        {/* Header */}
        <div className="flex items-center justify-between px-[24px] pt-[16px]">
          <div className="flex items-center gap-[8px]">
            <div className="w-[7px] h-[7px] rounded-full animate-pulse" style={{ background: "#34C759", boxShadow: "0 0 0 2.5px rgba(0,204,85,0.2)" }} />
            <span className="text-[16px] font-semibold" style={{ color: B1 }}>EduIntellect</span>
          </div>
          <div className="flex items-center gap-[12px]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center relative"
              style={{ background: "rgba(255,255,255,0.88)", border: "0.5px solid rgba(10,132,255,0.16)", boxShadow: SH }}>
              <BellRing className="w-[17px] h-[17px]" style={{ color: "rgba(10,132,255,0.60)" }} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-[1px] right-[1px] w-2 h-2 rounded-full" style={{ background: "#FF3B30", border: "1.5px solid white" }} />
              )}
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold text-white"
              style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 4px 16px rgba(10,132,255,0.38), 0 0 0 2.5px rgba(255,255,255,0.85)" }}>
              {avatarChar}
            </div>
          </div>
        </div>

        {/* Page head */}
        <div className="pt-[16px] px-[24px]">
          <div className="flex items-center gap-[12px] mb-1 flex-wrap">
            <h1 className="text-[28px] font-semibold" style={{ color: T1, letterSpacing: "-0.7px" }}>Alerts &amp; Notifications</h1>
            {unreadCount > 0 && (
              <div className="px-3 py-[4px] rounded-full text-[12px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #FF3B30, #FF5E55)", boxShadow: "0 3px 10px rgba(255,59,48,0.30)", letterSpacing: "0.04em" }}>
                {unreadCount} NEW
              </div>
            )}
          </div>
          <p className="text-[12px] font-normal" style={{ color: T3 }}>Stay updated with your child's activities</p>
        </div>

        {/* Mark All Read */}
        {allAlerts.length > 0 && (
          <button onClick={markAllRead}
            className="mx-5 mt-4 w-[calc(100%-40px)] h-12 rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-semibold active:scale-[0.98] transition-transform"
            style={{ background: CARD, border: "0.5px solid rgba(10,132,255,0.16)", color: B1, boxShadow: SH, letterSpacing: "-0.1px" }}>
            <CheckCircle className="w-4 h-4" style={{ color: "rgba(10,132,255,0.7)" }} strokeWidth={2.2} />
            Mark All Read
          </button>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-[8px] px-5 pt-[16px] overflow-x-auto no-sb" style={{ scrollbarWidth: "none" }}>
          {filterTabs.map((tab, i) => {
            const active = activeTab === i;
            return (
              <button key={tab} onClick={() => setActiveTab(i)}
                className="shrink-0 px-4 py-[8px] rounded-[14px] text-[12px] font-semibold whitespace-nowrap active:scale-[0.94] transition-transform"
                style={active
                  ? { background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff", boxShadow: SH_BTN, letterSpacing: "0.02em" }
                  : { background: CARD, color: T3, border: "0.5px solid rgba(10,132,255,0.12)", boxShadow: SH, letterSpacing: "0.02em" }}>
                {tab} ({getTabCount(tab)})
              </button>
            );
          })}
        </div>

        {/* Alert cards OR empty state */}
        {filteredAlerts.length === 0 ? (
          <div className="mx-5 mt-4 rounded-[24px] px-5 py-10 flex flex-col items-center gap-[12px] relative overflow-hidden"
            style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
            <div className="absolute -top-10 -right-7 w-[150px] h-[150px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(10,132,255,0.05) 0%, transparent 70%)" }} />
            <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-[8px] relative z-10"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN}, 0 0 0 10px rgba(10,132,255,0.07)` }}>
              <BellRing className="w-[30px] h-[30px]" style={{ color: "rgba(255,255,255,0.95)" }} strokeWidth={2.1} />
            </div>
            <div className="text-[18px] font-semibold text-center relative z-10" style={{ color: T1, letterSpacing: "-0.3px" }}>You're all caught up!</div>
            <div className="text-[12px] text-center max-w-[230px] leading-[1.6] font-normal relative z-10" style={{ color: T3 }}>
              No {filterTabs[activeTab] !== "All" ? `${filterTabs[activeTab].toLowerCase()} ` : ""}alerts right now. Check back later.
            </div>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const theme = themeFor(alert.priority);
            const Icon = iconFor(alert);
            const actions = getActions(alert);
            const recent = isRecent(alert.createdAt);
            const primary = actions.find(a => a.primary);
            const secondary = actions.find(a => !a.primary);
            const primaryIsGood = alert.priority === "Good News";
            const primaryGrad = primaryIsGood
              ? "linear-gradient(135deg, #34C759, #34C759)"
              : `linear-gradient(135deg, ${B1}, ${B2})`;
            const primaryShadow = primaryIsGood
              ? "0 5px 16px rgba(52,199,89,0.30)"
              : SH_BTN;

            const runPrimary = () => { if (primary) primary.onClick(); };
            return (
              <div
                key={alert.id}
                role="button"
                tabIndex={0}
                aria-label={`${alert.title} — ${primary?.label || "view"}`}
                onClick={runPrimary}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); runPrimary(); } }}
                className="mx-5 mt-[16px] rounded-[24px] relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40"
                style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                {/* Left accent stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[2px]" style={{ background: theme.stripe }} />
                {/* Unread dot */}
                {recent && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full"
                    style={{ background: B1, boxShadow: "0 0 0 2.5px rgba(10,132,255,0.20)" }} />
                )}

                <div className="px-[16px] py-[16px] pl-[24px]">
                  {/* Top row */}
                  <div className="flex items-start gap-[12px] mb-3">
                    <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                      style={{ background: theme.iconGrad, boxShadow: theme.iconShadow }}>
                      <Icon className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="text-[15px] font-semibold leading-[1.3] mb-[4px]" style={{ color: T1, letterSpacing: "-0.3px" }}>
                        {alert.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-[8px]">
                        <div className="px-[12px] py-1 rounded-full text-[12px] font-semibold whitespace-nowrap"
                          style={{ background: theme.badgeBg, color: theme.badgeText, border: `0.5px solid ${theme.badgeBdr}`, letterSpacing: "0.02em" }}>
                          {theme.emoji} {theme.label}
                        </div>
                        <div className="px-[12px] py-1 rounded-full text-[12px] font-semibold whitespace-nowrap"
                          style={{
                            background: alert.category === "Academic" ? "rgba(10,132,255,0.10)" : alert.category === "Attendance" ? "rgba(52,199,89,0.09)" : "rgba(10,132,255,0.08)",
                            color: alert.category === "Academic" ? B1 : alert.category === "Attendance" ? "#248A3D" : T3,
                            border: `0.5px solid ${alert.category === "Academic" ? "rgba(10,132,255,0.20)" : alert.category === "Attendance" ? "rgba(52,199,89,0.20)" : "rgba(10,132,255,0.12)"}`,
                            letterSpacing: "0.02em",
                          }}>
                          {alert.category}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="text-[13px] leading-[1.72] font-normal mb-[12px]"
                    style={{ color: T2, letterSpacing: "-0.1px" }}>
                    {alert.description}
                  </div>

                  {/* Date row */}
                  <div className="flex items-center gap-[4px] text-[12px] font-semibold mb-[16px]" style={{ color: T4 }}>
                    <Calendar className="w-3 h-3" strokeWidth={2.3} />
                    {fmtAlertDate(alert.createdAt)}
                  </div>

                  {/* Divider */}
                  <div className="h-[0.5px] mb-[16px]" style={{ background: "rgba(10,132,255,0.07)" }} />

                  {/* Recommended Actions label */}
                  <div className="flex items-center gap-[8px] text-[12px] font-semibold uppercase tracking-[0.10em] mb-[12px]" style={{ color: T4 }}>
                    <Sparkles className="w-[11px] h-[11px]" strokeWidth={2.5} />
                    Recommended Actions
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {primary && (
                      <button onClick={(e) => { e.stopPropagation(); primary.onClick(); }}
                        className="flex-1 h-[42px] rounded-[13px] flex items-center justify-center gap-[8px] text-[12px] font-semibold text-white active:scale-[0.95] transition-transform relative overflow-hidden"
                        style={{ background: primaryGrad, boxShadow: primaryShadow, letterSpacing: "0.02em" }}>
                        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 52%)" }} />
                        <span className="relative z-10 px-1 text-center truncate">{primary.label}</span>
                      </button>
                    )}
                    {secondary && (
                      <button onClick={(e) => { e.stopPropagation(); secondary.onClick(); }}
                        className="flex-1 h-[42px] rounded-[13px] flex items-center justify-center gap-[8px] text-[12px] font-semibold active:scale-[0.95] transition-transform"
                        style={{ background: BG, border: "0.5px solid rgba(10,132,255,0.16)", color: T2, boxShadow: SH, letterSpacing: "0.02em" }}>
                        <span className="px-1 text-center truncate">{secondary.label}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Summary dark card */}
        {allAlerts.length > 0 && (
          <div className="mx-5 mt-[16px] rounded-[24px] px-[24px] py-5 relative overflow-hidden transition-transform active:scale-[0.98]"
            style={{
              background: "linear-gradient(140deg, #0A84FF 0%, #0A84FF 48%, #0A84FF 100%)",
              boxShadow: "0 8px 28px rgba(0,51,204,0.30), 0 0 0 0.5px rgba(255,255,255,0.14)",
            }}>
            <div className="absolute -top-10 -right-6 w-[160px] h-[160px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-[12px] relative z-10" style={{ color: "rgba(255,255,255,0.48)" }}>
              Notification Summary
            </div>
            <div className="grid grid-cols-3 gap-[1px] rounded-[16px] overflow-hidden relative z-10" style={{ background: "rgba(255,255,255,0.12)" }}>
              {[
                { val: unreadCount, label: "Unread" },
                { val: highCount, label: "High" },
                { val: allAlerts.length, label: "Total" },
              ].map(({ val, label }) => (
                <div key={label} className="py-[12px] px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[24px] font-semibold text-white leading-none mb-1" style={{ letterSpacing: "-0.7px" }}>{val}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-5" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Bright Blue Apple UI + 3D hover cards
     ═══════════════════════════════════════════════════════════════ */
  const B1 = "#0A84FF", B2 = "#3395FF";
  const BG_D = "#F5F5F7";
  const T1 = "#1D1D1F", T2 = "#3A3A3C", T3 = "#6E6E73", T4 = "#A1A1A6";
  const GREEN_D = "#34C759", RED_D = "#FF3B30", ORANGE_D = "#FF9500";
  const BLUE_BDR = "rgba(10,132,255,0.12)";
  const SH_D = "0 0 0 0.5px rgba(10,132,255,0.08), 0 2px 8px rgba(10,132,255,0.09), 0 10px 28px rgba(10,132,255,0.11)";
  const SH_LG_D = "0 0 0 0.5px rgba(10,132,255,0.10), 0 4px 16px rgba(10,132,255,0.12), 0 18px 44px rgba(10,132,255,0.14)";
  const SH_BTN_D = "0 6px 22px rgba(10,132,255,0.42), 0 2px 6px rgba(10,132,255,0.22)";

  const isRecentD = (ts: any) => {
    const d = ts?.toDate?.() || null;
    if (!d) return false;
    return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
  };
  const fmtAlertDateD = (ts: any) => {
    if (isRecentD(ts)) return "Recent";
    const d = ts?.toDate?.();
    if (!d) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const themeForD = (p: ParsedAlert["priority"]) => {
    if (p === "High Priority") return {
      stripe: "linear-gradient(180deg, #FF3B30, #FF5E55)",
      iconGrad: "linear-gradient(135deg, #FF3B30, #FF5E55)",
      iconShadow: "0 3px 12px rgba(255,59,48,0.28)",
      badgeBg: "rgba(255,59,48,0.10)", badgeBdr: "rgba(255,59,48,0.22)", badgeText: RED_D,
      emoji: "🔴", label: "High Priority",
    };
    if (p === "Medium Priority") return {
      stripe: "linear-gradient(180deg, #FF9500, #FFCC00)",
      iconGrad: "linear-gradient(135deg, #FF9500, #FFCC00)",
      iconShadow: "0 3px 12px rgba(255,149,0,0.28)",
      badgeBg: "rgba(255,149,0,0.10)", badgeBdr: "rgba(255,149,0,0.22)", badgeText: "#86310C",
      emoji: "🟡", label: "Medium",
    };
    if (p === "Good News") return {
      stripe: "linear-gradient(180deg, #34C759, #34C759)",
      iconGrad: "linear-gradient(135deg, #34C759, #34C759)",
      iconShadow: "0 3px 12px rgba(52,199,89,0.28)",
      badgeBg: "rgba(52,199,89,0.10)", badgeBdr: "rgba(52,199,89,0.22)", badgeText: "#248A3D",
      emoji: "🟢", label: "Great Work",
    };
    return {
      stripe: `linear-gradient(180deg, ${B1}, ${B2})`,
      iconGrad: `linear-gradient(135deg, ${B1}, ${B2})`,
      iconShadow: "0 3px 12px rgba(10,132,255,0.28)",
      badgeBg: "rgba(10,132,255,0.10)", badgeBdr: "rgba(10,132,255,0.20)", badgeText: B1,
      emoji: "🔵", label: "General",
    };
  };

  const iconForD = (a: ParsedAlert) => {
    if (a.priority === "Good News") return CheckCircle;
    if (a.category === "Attendance" && a.priority === "High Priority") return AlertCircle;
    if (a.category === "Attendance") return Calendar;
    if (a.source === "parent_notes") return MessageSquare;
    if (a.source === "assignments" || a.category === "Academic") return BookOpen;
    if (a.source === "risks") return ShieldAlert;
    return AlertCircle;
  };

  const unreadCountD = allAlerts.filter(a => isRecentD(a.createdAt)).length;
  const highCountD = allAlerts.filter(a => a.priority === "High Priority").length;
  const goodCountD = allAlerts.filter(a => a.priority === "Good News").length;

  // 3D tilt handlers
  const handle3DEnter = (e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transition = "transform 0.06s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.2s ease";
  };
  const handle3DMove = (e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotX = (((y / rect.height) - 0.5) * -6).toFixed(2);
    const rotY = (((x / rect.width) - 0.5) * 6).toFixed(2);
    el.style.transform = `perspective(1100px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-3px) scale(1.006)`;
    const glow = el.querySelector<HTMLDivElement>('[data-glow]');
    if (glow) {
      glow.style.opacity = "1";
      glow.style.background = `radial-gradient(420px circle at ${x}px ${y}px, rgba(10,132,255,0.12), transparent 45%)`;
    }
  };
  const handle3DLeave = (e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transition = "transform 0.5s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s ease";
    el.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
    const glow = el.querySelector<HTMLDivElement>('[data-glow]');
    if (glow) glow.style.opacity = "0";
  };

  return (
    <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', sans-serif", background: BG_D }}>
      <div className="w-full px-6 pt-8 pb-10">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-1 flex items-center gap-[8px]" style={{ color: T4 }}>
              <span className="w-[6px] h-[6px] rounded-full animate-pulse" style={{ background: RED_D, boxShadow: "0 0 0 3px rgba(255,59,48,0.18)" }} />
              Parent Dashboard · Alerts
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-semibold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Alerts &amp; Notifications</h1>
              {unreadCountD > 0 && (
                <div className="px-3 py-[8px] rounded-full text-[12px] font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${RED_D}, #FF5E55)`, boxShadow: "0 3px 10px rgba(255,59,48,0.30)", letterSpacing: "0.04em" }}>
                  {unreadCountD} NEW
                </div>
              )}
            </div>
            <div className="text-[13px] font-normal mt-[8px]" style={{ color: T3 }}>Stay updated with your child's activities</div>
          </div>
          <div className="flex items-center gap-[12px]">
            <button onClick={markAllRead}
              className="px-4 py-[12px] rounded-[14px] text-[13px] font-semibold flex items-center gap-2 transition-transform hover:scale-[1.02]"
              style={{ background: "#fff", color: T2, border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D, letterSpacing: "-0.1px" }}>
              <CheckCircle className="w-4 h-4" style={{ color: B1 }} strokeWidth={2.3} />
              Mark All Read
            </button>
            <div className="w-10 h-10 rounded-full flex items-center justify-center relative"
              style={{ background: "#fff", border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D }}>
              <BellRing className="w-4 h-4" style={{ color: "rgba(10,132,255,0.60)" }} strokeWidth={1.8} />
              {unreadCountD > 0 && <span className="absolute top-[1px] right-[1px] w-2 h-2 rounded-full" style={{ background: RED_D, border: "1.5px solid white" }} />}
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-white"
              style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(10,132,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
              {(studentData?.name?.[0] || "S").toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Stat cards (3D hover, functional filter tabs) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5" style={{ perspective: "1200px" }}>
          {[
            { label: "Total", val: allAlerts.length, color: B1, icon: BellRing, grad: `linear-gradient(135deg, ${B1}, ${B2})`, sh: "0 3px 10px rgba(10,132,255,0.28)", glow: "rgba(10,132,255,0.09)", tab: 0 },
            { label: "Unread", val: unreadCountD, color: ORANGE_D, icon: Calendar, grad: `linear-gradient(135deg, ${ORANGE_D}, #FF9500)`, sh: "0 3px 10px rgba(255,149,0,0.28)", glow: "rgba(255,149,0,0.09)", tab: 0 },
            { label: "High Priority", val: highCountD, color: RED_D, icon: AlertCircle, grad: `linear-gradient(135deg, ${RED_D}, #FF5E55)`, sh: "0 3px 10px rgba(255,59,48,0.28)", glow: "rgba(255,59,48,0.09)", tab: 0 },
            { label: "Good News", val: goodCountD, color: GREEN_D, icon: Trophy, grad: `linear-gradient(135deg, ${GREEN_D}, #34C759)`, sh: "0 3px 10px rgba(52,199,89,0.28)", glow: "rgba(52,199,89,0.09)", tab: 0 },
          ].map(({ label, val, color, icon: Icon, grad, sh, glow, tab }) => (
            <button key={label}
              onMouseEnter={handle3DEnter}
              onMouseMove={handle3DMove}
              onMouseLeave={handle3DLeave}
              onClick={() => setActiveTab(tab)}
              className="bg-white rounded-[22px] px-6 py-5 relative overflow-hidden text-left cursor-pointer"
              style={{
                boxShadow: SH_D,
                border: "0.5px solid rgba(10,132,255,0.10)",
                transformStyle: "preserve-3d",
                willChange: "transform",
              }}>
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
              <div className="absolute -top-[20px] -right-[20px] w-[100px] h-[100px] rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }} />
              <div className="flex items-center justify-between mb-3 relative">
                <span className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: T4 }}>{label}</span>
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{ background: grad, boxShadow: sh, transform: "translateZ(18px)" }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.3} />
                </div>
              </div>
              <div className="text-[28px] font-semibold leading-none relative" style={{ color, letterSpacing: "-1px", transform: "translateZ(10px)" }}>{val}</div>
            </button>
          ))}
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex gap-2 flex-wrap mb-5">
          {filterTabs.map((tab, i) => {
            const active = activeTab === i;
            return (
              <button key={tab} onClick={() => setActiveTab(i)}
                className="px-5 py-[12px] rounded-[14px] text-[12px] font-semibold flex items-center gap-2 transition-transform hover:scale-[1.02]"
                style={active
                  ? { background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff", boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }
                  : { background: "#fff", color: T3, border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D, letterSpacing: "-0.1px" }}>
                {tab}
                <span className="min-w-[20px] h-[20px] rounded-[6px] flex items-center justify-center text-[12px] font-semibold px-[4px]"
                  style={{ background: active ? "rgba(255,255,255,0.22)" : "rgba(10,132,255,0.08)", color: active ? "#fff" : B1 }}>
                  {getTabCount(tab)}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Main Row: Alerts (col-2) + Summary sidebar ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Alert list */}
          <div className="xl:col-span-2">
            {loading ? (
              <div className="bg-white rounded-[22px] py-10 flex flex-col items-center"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <Loader2 className="w-12 h-12 animate-spin" style={{ color: B1 }} />
                <p className="text-[13px] font-medium mt-3" style={{ color: T4 }}>Loading alerts…</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="bg-white rounded-[22px] py-10 flex flex-col items-center text-center relative overflow-hidden"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="absolute -top-[50px] -right-[40px] w-[220px] h-[220px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(10,132,255,0.05) 0%, transparent 70%)" }} />
                <div className="w-[84px] h-[84px] rounded-[24px] flex items-center justify-center mb-4 relative z-10"
                  style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN_D}, 0 0 0 10px rgba(10,132,255,0.07)` }}>
                  <BellRing className="w-10 h-10 text-white" strokeWidth={2.1} />
                </div>
                <div className="text-[20px] font-semibold mb-1 relative z-10" style={{ color: T1, letterSpacing: "-0.4px" }}>You're all caught up!</div>
                <div className="text-[13px] leading-[1.6] max-w-[400px] relative z-10" style={{ color: T3 }}>
                  No {filterTabs[activeTab] !== "All" ? `${filterTabs[activeTab].toLowerCase()} ` : ""}alerts right now. Check back later.
                </div>
              </div>
            ) : (
              <div className="space-y-3" style={{ perspective: "1200px" }}>
                {filteredAlerts.map(alert => {
                  const theme = themeForD(alert.priority);
                  const Icon = iconForD(alert);
                  const actions = getActions(alert);
                  const recent = isRecentD(alert.createdAt);
                  const primary = actions.find(a => a.primary);
                  const secondary = actions.find(a => !a.primary);
                  const primaryIsGood = alert.priority === "Good News";
                  const primaryGrad = primaryIsGood
                    ? `linear-gradient(135deg, ${GREEN_D}, #34C759)`
                    : `linear-gradient(135deg, ${B1}, ${B2})`;
                  const primaryShadow = primaryIsGood
                    ? "0 5px 16px rgba(52,199,89,0.32)"
                    : SH_BTN_D;

                  return (
                    <div key={alert.id}
                      onMouseEnter={handle3DEnter}
                      onMouseMove={handle3DMove}
                      onMouseLeave={handle3DLeave}
                      className="rounded-[22px] relative overflow-hidden bg-white"
                      style={{
                        boxShadow: SH_LG_D,
                        border: "0.5px solid rgba(10,132,255,0.10)",
                        transformStyle: "preserve-3d",
                        willChange: "transform",
                      }}>
                      <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
                      <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-[2px]" style={{ background: theme.stripe }} />
                      {recent && (
                        <div className="absolute top-5 right-5 w-[8px] h-[8px] rounded-full"
                          style={{ background: B1, boxShadow: "0 0 0 3px rgba(10,132,255,0.20)", animation: "pulse 2s infinite" }} />
                      )}

                      <div className="px-8 py-6" style={{ transform: "translateZ(8px)" }}>
                        {/* Top row */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center shrink-0"
                            style={{ background: theme.iconGrad, boxShadow: theme.iconShadow, transform: "translateZ(18px)" }}>
                            <Icon className="w-[24px] h-[24px] text-white" strokeWidth={2.2} />
                          </div>
                          <div className="flex-1 min-w-0 pr-8">
                            <div className="text-[18px] font-semibold leading-[1.3] mb-2" style={{ color: T1, letterSpacing: "-0.3px" }}>
                              {alert.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="px-[12px] py-[4px] rounded-full text-[12px] font-semibold whitespace-nowrap"
                                style={{ background: theme.badgeBg, color: theme.badgeText, border: `0.5px solid ${theme.badgeBdr}`, letterSpacing: "0.02em" }}>
                                {theme.emoji} {theme.label}
                              </div>
                              <div className="px-[12px] py-[4px] rounded-full text-[12px] font-semibold whitespace-nowrap"
                                style={{
                                  background: alert.category === "Academic" ? "rgba(10,132,255,0.10)" : alert.category === "Attendance" ? "rgba(52,199,89,0.10)" : "rgba(10,132,255,0.08)",
                                  color: alert.category === "Academic" ? B1 : alert.category === "Attendance" ? "#248A3D" : T3,
                                  border: `0.5px solid ${alert.category === "Academic" ? "rgba(10,132,255,0.20)" : alert.category === "Attendance" ? "rgba(52,199,89,0.22)" : BLUE_BDR}`,
                                }}>
                                {alert.category}
                              </div>
                              {alert.teacherName && (
                                <div className="flex items-center gap-[4px] text-[12px] font-medium" style={{ color: T3 }}>
                                  <User className="w-[11px] h-[11px]" strokeWidth={2.3} /> {alert.teacherName}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Message */}
                        <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: T2, letterSpacing: "-0.1px" }}>
                          {alert.description}
                        </p>

                        {/* Date + meta */}
                        <div className="flex items-center gap-4 text-[12px] font-semibold mb-5" style={{ color: T4 }}>
                          <span className="flex items-center gap-[4px]">
                            <Calendar className="w-3 h-3" strokeWidth={2.3} />
                            {alert.date ? fmtDateStr(alert.date) : fmtAlertDateD(alert.createdAt)}
                          </span>
                          {alert.arrivalTime && (
                            <span className="flex items-center gap-[4px]">
                              <Clock className="w-3 h-3" strokeWidth={2.3} />
                              Arrived at {alert.arrivalTime}
                            </span>
                          )}
                        </div>

                        {/* Divider */}
                        <div className="h-[0.5px] mb-4" style={{ background: "rgba(10,132,255,0.08)" }} />

                        {/* AI Actions label */}
                        <div className="flex items-center gap-[8px] text-[12px] font-semibold uppercase tracking-[0.10em] mb-3" style={{ color: B1 }}>
                          <Sparkles className="w-[12px] h-[12px]" strokeWidth={2.5} />
                          Recommended Actions
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2" style={{ transform: "translateZ(14px)" }}>
                          {primary && (
                            <button onClick={primary.onClick}
                              className="flex-1 h-11 rounded-[13px] flex items-center justify-center gap-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] relative overflow-hidden"
                              style={{ background: primaryGrad, boxShadow: primaryShadow, letterSpacing: "-0.1px" }}>
                              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 52%)" }} />
                              <span className="relative z-10 px-1 text-center truncate">{primary.label}</span>
                            </button>
                          )}
                          {secondary && (
                            <button onClick={secondary.onClick}
                              className="flex-1 h-11 rounded-[13px] flex items-center justify-center gap-2 text-[13px] font-semibold transition-transform hover:scale-[1.02]"
                              style={{ background: BG_D, color: T2, border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D, letterSpacing: "-0.1px" }}>
                              <span className="px-1 text-center truncate">{secondary.label}</span>
                            </button>
                          )}
                          <button onClick={() => dismissAlert(alert)}
                            className="w-11 h-11 rounded-[13px] flex items-center justify-center transition-transform hover:scale-[1.05]"
                            style={{ background: BG_D, color: T4, border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D }}
                            title="Dismiss">
                            <CheckCircle className="w-4 h-4" strokeWidth={2.3} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Summary + distribution */}
          <div className="space-y-4">
            {/* Summary dark card */}
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
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
              <div className="absolute -top-[50px] -right-[32px] w-[220px] h-[220px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
              <div className="relative z-10" style={{ transform: "translateZ(14px)" }}>
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: "rgba(255,255,255,0.50)" }}>Notification Summary</div>
                <div className="text-[22px] font-semibold leading-[1.2] mb-5" style={{ letterSpacing: "-0.5px" }}>This Term</div>
                <div className="grid grid-cols-3 rounded-[16px] overflow-hidden" style={{ gap: "1px", background: "rgba(255,255,255,0.12)" }}>
                  {[
                    { val: unreadCountD, label: "Unread" },
                    { val: highCountD, label: "High" },
                    { val: allAlerts.length, label: "Total" },
                  ].map(({ val, label }) => (
                    <div key={label} className="py-[12px] px-2 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="text-[22px] font-semibold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>{val}</div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category distribution */}
            <div
              onMouseEnter={handle3DEnter}
              onMouseMove={handle3DMove}
              onMouseLeave={handle3DLeave}
              className="bg-white rounded-[22px] p-5 relative overflow-hidden"
              style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)", transformStyle: "preserve-3d", willChange: "transform" }}>
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
              <div className="text-[15px] font-semibold mb-4" style={{ color: T1, letterSpacing: "-0.3px", transform: "translateZ(10px)" }}>By Category</div>
              <div className="space-y-3">
                {filterTabs.filter(t => t !== "All").map(cat => {
                  const count = getTabCount(cat);
                  const pct = allAlerts.length > 0 ? Math.round((count / allAlerts.length) * 100) : 0;
                  const color = cat === "Academic" ? B1 : cat === "Attendance" ? GREEN_D : T3;
                  const bar = cat === "Academic" ? `linear-gradient(90deg, ${B1}, #7CBBFF)` : cat === "Attendance" ? `linear-gradient(90deg, ${GREEN_D}, #34C759)` : `linear-gradient(90deg, ${T3}, ${T4})`;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-[8px]">
                        <span className="text-[12px] font-semibold" style={{ color: T2 }}>{cat}</span>
                        <span className="text-[13px] font-semibold" style={{ color }}>{count}</span>
                      </div>
                      <div className="h-[7px] rounded-[4px] overflow-hidden" style={{ background: "rgba(10,132,255,0.08)" }}>
                        <div className="h-full rounded-[4px]" style={{ width: `${pct}%`, background: bar, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action tip card */}
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
                  <div className="text-[15px] font-semibold" style={{ color: T1, letterSpacing: "-0.2px" }}>AI Assist</div>
                  <div className="text-[12px] font-normal" style={{ color: T3 }}>Action shortcuts</div>
                </div>
              </div>
              <p className="text-[12px] leading-[1.6] relative z-10" style={{ color: T3 }}>
                Each alert has tailored actions — message the teacher, view the report, or dismiss. Primary actions use the blue glow button.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Utility functions ──
const fmtDateStr = (dateStr: string) => {
  if (!dateStr) return "Recent";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return dateStr;
};

const fmtTs = (ts: any): string => {
  if (!ts) return "Recent";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default AlertsPage;
