import { useState, useEffect } from "react";
import {
  Trophy, AlertTriangle, Star, StarHalf, Clock, Users,
  BookOpen, HandHeart, Lightbulb, Loader2, CheckCircle,
  ShieldCheck, Hourglass, Activity
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { scopedQuery } from "@/lib/scopedQuery";
import { where, onSnapshot, limit } from "firebase/firestore";
import { subscribeEnrollments } from "@/lib/enrollmentQuery";
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
  enrolledAt: { toDate: () => new Date(Date.now() - 150 * 86400000) },
};

// Firestore-Timestamp-shaped helper (page reads .toMillis() and .toDate())
const _bhTs = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};

// 16 teacher notes spread over the last 5 months — 12 positive + 4 improvement.
// Reflects Aarav's "good standing" (avg 84%, 92% attendance) with realistic
// improvement flags around the weak areas (English reading, talkativeness in CS).
const MOCK_TEACHER_NOTES: any[] = [
  // ── This month (most recent) ──
  { id: "bn1",  category: "positive",    teacherName: "Mrs. Priya Mehta",  content: "Aarav consistently raises his hand to answer Mathematics questions and is always eager to help classmates who are struggling with algebra problems. A real role model in class.", createdAt: _bhTs(1) },
  { id: "bn2",  category: "positive",    teacherName: "Dr. Anil Reddy",    content: "Excellent teamwork during the photosynthesis lab today. Aarav led his group calmly and made sure everyone got a chance to handle the equipment.",                                  createdAt: _bhTs(3) },
  { id: "bn3",  category: "improvement", teacherName: "Ms. Neha Iyer",     content: "Aarav has been talkative during the last two CS Lab sessions. Could you please remind him to focus during practical work? His project quality is otherwise excellent.",          createdAt: _bhTs(5) },
  { id: "bn4",  category: "positive",    teacherName: "Mrs. Sunita Verma", content: "Hindi vyakaran ka homework hamesha samay par jama karta hai aur uske writing mein clarity hai. Class mein bhi achhe questions puchhta hai.",                                       createdAt: _bhTs(8) },

  // ── ~3 weeks ago ──
  { id: "bn5",  category: "positive",    teacherName: "Mrs. Priya Mehta",  content: "Volunteered to be the class monitor this week and managed his responsibilities maturely. Distributed worksheets without fuss and reported absences accurately.",                  createdAt: _bhTs(15) },
  { id: "bn6",  category: "improvement", teacherName: "Mr. Kiran Patel",   content: "Aarav forgot to bring his English reading log to class for the second time this week. Please help him build a routine of packing his bag the previous evening.",                  createdAt: _bhTs(18) },
  { id: "bn7",  category: "positive",    teacherName: "Mr. Rahul Khanna",  content: "Wonderful presentation on the Mughal Empire today. Aarav had clearly prepared well, spoke confidently, and answered audience questions thoughtfully.",                            createdAt: _bhTs(22) },

  // ── Last month ──
  { id: "bn8",  category: "positive",    teacherName: "Dr. Anil Reddy",    content: "Helped a new student settle into the science lab routine. Showed him where equipment was stored and explained the safety rules patiently.",                                       createdAt: _bhTs(35) },
  { id: "bn9",  category: "improvement", teacherName: "Mr. Kiran Patel",   content: "During the Reading Comprehension test Aarav rushed through the passage and missed important details. Encourage him to read passages twice before answering.",                     createdAt: _bhTs(40) },
  { id: "bn10", category: "positive",    teacherName: "Ms. Neha Iyer",     content: "His HTML project on personal resume was the most creative submission in 8B. Used semantic tags correctly and even added a navigation menu.",                                      createdAt: _bhTs(45) },

  // ── 2 months ago ──
  { id: "bn11", category: "positive",    teacherName: "Mrs. Priya Mehta",  content: "Showed remarkable improvement in mental math drill — completed 24 out of 25 questions in the time limit. Maintained focus throughout.",                                          createdAt: _bhTs(60) },
  { id: "bn12", category: "positive",    teacherName: "Mrs. Sunita Verma", content: "Aarav ne kavita 'Saakhi' ki vyakhya bahut achhi tarah ki. Uska uchcharan saaf hai aur kavita ke arth ko gehraai se samjha hai.",                                                  createdAt: _bhTs(70) },

  // ── 3 months ago ──
  { id: "bn13", category: "improvement", teacherName: "Mrs. Priya Mehta",  content: "Aarav was distracted during the probability chapter introduction and had to be reminded twice to put away his pencil case. He's capable of much better focus.",                  createdAt: _bhTs(85) },
  { id: "bn14", category: "positive",    teacherName: "Mr. Rahul Khanna",  content: "Submitted the India outline map work neatly with all rivers and mountain ranges correctly labelled. Good attention to detail.",                                                  createdAt: _bhTs(95) },

  // ── 4-5 months ago ──
  { id: "bn15", category: "positive",    teacherName: "Dr. Anil Reddy",    content: "Aarav asked an insightful question about the practical use of Newton's laws in cricket bowling. Curiosity like this is what we want to see in young scientists.",                createdAt: _bhTs(115) },
  { id: "bn16", category: "positive",    teacherName: "Mrs. Priya Mehta",  content: "First-week observation: Aarav adapted to Grade 8 quickly. He's polite to staff, punctual, and takes pride in keeping his notebook organised.",                                   createdAt: _bhTs(140) },
];

// Class-teacher's manual rating (visible at the top of the page)
const MOCK_MANUAL_RATING = 4.5;

export default function BehaviourPage() {
  const { studentData: _liveStudentData } = useAuth();
  const studentData = USE_MOCK_DATA ? MOCK_STUDENT_DATA : _liveStudentData;
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(USE_MOCK_DATA ? false : true);
  const [teacherNotes, setTeacherNotes] = useState<any[]>(USE_MOCK_DATA ? MOCK_TEACHER_NOTES : []);
  const [manualRating, setManualRating] = useState<number | null>(USE_MOCK_DATA ? MOCK_MANUAL_RATING : null);

  useEffect(() => {
    if (USE_MOCK_DATA) return; // Mock mode: teacherNotes + manualRating pre-seeded above
    if (!studentData?.id) return;
    setLoading(true);
    const schoolId = studentData.schoolId;

    // 1. Enrollments — dual-listener helper picks up legacy enrollments
    // where studentId was stored as email by older writes.
    const unsubEnroll = subscribeEnrollments(studentData, (docs) => {
      const ratings = docs.map(d => d.data().manualBehaviourRating).filter(r => r !== undefined);
      if (ratings.length > 0) setManualRating(Math.max(...ratings));
    });

    // 2. Behavioural notes — single scoped query
    const notesQ = scopedQuery("parent_notes", schoolId, where("studentId", "==", studentData.id), limit(40));
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      const notes = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTeacherNotes(notes);
      setLoading(false);
    }, (err) => {
      console.error("[Behaviour] notes listener error:", err);
      setTeacherNotes([]);
      setLoading(false);
    });

    return () => { unsubEnroll(); unsubNotes(); };
  }, [studentData?.id, studentData?.schoolId]);

  // Determine positive vs improvement notes heuristics
  const classifyNote = (note: any) => {
    if (note.category) return note.category; // Trust structured category if exists
    
    const c = (note.content || "").toLowerCase();
    if (c.includes("late") || c.includes("forgot") || c.includes("miss") || c.includes("issue") || c.includes("distract") || c.includes("warning") || c.includes("poor") || c.includes("failing") || c.includes("talkative")) {
       return "improvement";
    }
    return "positive";
  };

  const positiveNotes = teacherNotes.filter(n => classifyNote(n) === "positive");
  const improvementNotes = teacherNotes.filter(n => classifyNote(n) === "improvement");

  const getIconForPositive = (index: number) => {
    const icons = [Star, HandHeart, Lightbulb, Trophy];
    return icons[index % icons.length];
  };

  const getIconForImprovement = (index: number) => {
    const icons = [Clock, BookOpen, AlertTriangle];
    return icons[index % icons.length];
  };

  const formatNoteDate = (note: any) => {
     try {
       if (note.createdAt && typeof note.createdAt.toDate === 'function') {
         return note.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
       } else if (note.createdAt?.toDate) {
          return note.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
       }
     } catch (e) {}
     return 'Recent';
  };

  // Do NOT default the rating to 5.0 when there are zero notes — a brand-new
  // student would then render "Excellent" on day one, which misrepresents the
  // system to parents. When we have no signal, expose that explicitly as null
  // so the UI can render an empty state instead of a healthy-looking score.
  const hasBehaviourSignal = teacherNotes.length > 0 || manualRating !== null;
  const calculatedRating = teacherNotes.length === 0
    ? null
    : Math.min(5.0, Math.max(1.0, 5.0 - (improvementNotes.length * 0.3) + (positiveNotes.length * 0.1)));

  const ratingNum: number | null = manualRating !== null
    ? manualRating
    : calculatedRating;
  const rating = ratingNum !== null ? ratingNum.toFixed(1) : "—";

  // Generate dynamic chart data from joining date to now
  const getTrendData = () => {
    const months: any = {};
    const now = new Date();
    
    // 1. Determine Start Date (Join Date)
    let startDate = new Date(now.getFullYear(), now.getMonth() - 4, 1); // default 5 months
    
    const rawJoinDate = studentData?.enrolledAt || studentData?.createdAt;
    if (rawJoinDate) {
       const jDate = rawJoinDate.toDate ? rawJoinDate.toDate() : new Date(rawJoinDate);
       startDate = new Date(jDate.getFullYear(), jDate.getMonth(), 1);
    } else if (teacherNotes.length > 0) {
       // Fallback to first note date
       const firstNoteDate = teacherNotes.reduce((earliest, current) => {
          const d = current.createdAt?.toDate ? current.createdAt.toDate() : new Date();
          return d < earliest ? d : earliest;
       }, new Date());
       startDate = new Date(firstNoteDate.getFullYear(), firstNoteDate.getMonth(), 1);
    }

    // 2. Generate all months between start and now
    let tempDate = new Date(startDate);
    while (tempDate <= now) {
       const mName = tempDate.toLocaleString('default', { month: 'short' });
       const mYear = tempDate.getFullYear().toString().slice(-2);
       const key = `${mName} ${mYear}`;
       months[key] = { m: mName, key: key, pos: 0, improv: 0, count: 0, date: new Date(tempDate) };
       tempDate.setMonth(tempDate.getMonth() + 1);
    }

    // 3. Populate Data
    teacherNotes.forEach(n => {
      const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
      const mName = date.toLocaleString('default', { month: 'short' });
      const mYear = date.getFullYear().toString().slice(-2);
      const key = `${mName} ${mYear}`;
      if (months[key]) {
        if (classifyNote(n) === "positive") months[key].pos++;
        else months[key].improv++;
        months[key].count++;
      }
    });

    return Object.values(months).map((data: any) => {
       const isCurrentMonth = data.m === now.toLocaleString('default', { month: 'short' }) &&
                             data.date?.getFullYear() === now.getFullYear();

       // Don't synthesise a flat 5.0 for empty months — recharts will drop nulls
       // from the line instead of painting a misleading "excellent" streak for
       // brand-new students.
       const calculatedScore: number | null = data.count === 0
         ? null
         : Math.min(5.0, Math.max(1.0, 5.0 - (data.improv * 0.3) + (data.pos * 0.1)));

       return {
          m: data.m,
          key: data.key,
          score: isCurrentMonth && manualRating !== null ? manualRating : calculatedScore,
       };
    });
  };

  const trendData = getTrendData();

  const renderStars = (rate: number) => {
    const stars = [];
    const fullStars = Math.floor(rate);
    const hasHalfStar = rate - fullStars >= 0.5;

    for (let i = 0; i < fullStars; i++) {
       stars.push(<Star key={`full-${i}`} className="w-8 h-8 text-amber-400 fill-amber-400" />);
    }
    if (hasHalfStar) {
       stars.push(<StarHalf key="half" className="w-8 h-8 text-amber-400 fill-amber-400" />);
    }
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
       stars.push(<Star key={`empty-${i}`} className="w-8 h-8 text-slate-200" />);
    }
    return stars;
  };

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0A84FF", B2 = "#3395FF", B3 = "#5BA9FF", B4 = "#7CBBFF";
    const BG = "#F5F5F7", BG2 = "#EBEBF0";
    const T1 = "#1D1D1F", T3 = "#6E6E73", T4 = "#A1A1A6";
    const SEP = "rgba(10,132,255,0.07)";
    const GREEN = "#34C759", GREEN_D = "#248A3D";
    const RED = "#FF3B30";
    const ORANGE = "#FF9500";
    const GOLD = "#FFCC00";
    const VIOLET = "#AF52DE";
    const SH = "0 0 0 0.5px rgba(10,132,255,0.08), 0 2px 8px rgba(10,132,255,0.08), 0 10px 26px rgba(10,132,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(10,132,255,0.10), 0 4px 16px rgba(10,132,255,0.11), 0 18px 44px rgba(10,132,255,0.13)";

    // Use the typed rating number (null when no data) rather than parseFloat
    // of the display string — that path turned "—" into NaN and silently
    // painted every sub-metric with junk values.
    const rateNum = ratingNum ?? 0;
    const incidents = improvementNotes.length;

    // Derive sub-metrics from available data. When there's no behaviour
    // signal at all, surface "—" instead of fabricating grades / percentages.
    const conductGrade = !hasBehaviourSignal ? "—" :
      rateNum >= 4.8 ? "A+" :
      rateNum >= 4.5 ? "A"  :
      rateNum >= 4.0 ? "B+" :
      rateNum >= 3.5 ? "B"  :
      rateNum >= 3.0 ? "C"  : "D";
    const punctualityPct = !hasBehaviourSignal ? null : Math.max(0, Math.round(100 - incidents * 8));
    const respectScore = !hasBehaviourSignal ? "—" : rateNum.toFixed(1);
    const participationScore = !hasBehaviourSignal
      ? "—"
      : (Math.max(1, Math.min(5, rateNum - (incidents ? 0.2 : 0) + (positiveNotes.length ? 0.1 : 0)))).toFixed(1);

    // Trend delta arrow direction
    const lastTwo = trendData.slice(-2);
    const trendUp = lastTwo.length === 2 && (lastTwo[1] as any).score >= (lastTwo[0] as any).score;

    // Tier badge for highlight rows
    const tierFor = (i: number) => i === 0 ? "Gold" : i === 1 ? "Good" : "Nice";

    // Stars for mobile score row
    const mobileStars = () => {
      const out = [];
      const full = Math.floor(rateNum);
      const half = rateNum - full >= 0.5;
      for (let i = 0; i < full; i++) {
        out.push(
          <svg key={`f${i}`} width="28" height="28" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 20.2,11.6 30.8,12.9 23,20.5 25.2,31 16,25.9 6.8,31 9,20.5 1.2,12.9 11.8,11.6" fill={GOLD} stroke="#FF9500" strokeWidth="0.5" />
          </svg>
        );
      }
      if (half) {
        out.push(
          <svg key="half" width="28" height="28" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="halfStarGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="50%" stopColor={GOLD} />
                <stop offset="50%" stopColor="rgba(255,204,0,0.18)" />
              </linearGradient>
            </defs>
            <polygon points="16,2 20.2,11.6 30.8,12.9 23,20.5 25.2,31 16,25.9 6.8,31 9,20.5 1.2,12.9 11.8,11.6" fill="url(#halfStarGrad)" stroke="#FF9500" strokeWidth="0.5" />
          </svg>
        );
      }
      const rest = 5 - out.length;
      for (let i = 0; i < rest; i++) {
        out.push(
          <svg key={`e${i}`} width="28" height="28" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 20.2,11.6 30.8,12.9 23,20.5 25.2,31 16,25.9 6.8,31 9,20.5 1.2,12.9 11.8,11.6" fill="rgba(255,204,0,0.15)" stroke="rgba(255,204,0,0.35)" strokeWidth="0.5" />
          </svg>
        );
      }
      return out;
    };

    return (
      <div data-sfpro className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {loading ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: B1 }} />
            <p className="text-xs font-medium" style={{ color: T4 }}>Loading behaviour data…</p>
          </div>
        ) : (
          <>
            {/* ── Page Head ── */}
            <div className="px-[24px] pt-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-1 flex items-center gap-[8px]" style={{ color: T4 }}>
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: B1, boxShadow: "0 0 0 2px rgba(10,132,255,0.18)" }} />
                Student Report
              </div>
              <div className="text-[28px] font-semibold leading-[1.08]" style={{ color: T1, letterSpacing: "-0.7px" }}>
                Behaviour &amp;<br />Discipline
              </div>
            </div>

            {/* ── Rating Card ── */}
            <div className="mx-5 mt-[16px] bg-white rounded-[26px] p-[24px] relative overflow-hidden"
              style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
              <div className="absolute -top-[46px] -right-8 w-[160px] h-[160px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(52,199,89,0.07) 0%, transparent 70%)" }} />
              <div className="text-[18px] font-semibold mb-[4px] relative z-10" style={{ color: T1, letterSpacing: "-0.3px" }}>
                Overall Behavior Rating
              </div>
              <div className="text-[12px] mb-5 font-normal relative z-10" style={{ color: T3 }}>
                Based on teacher observations this term
              </div>

              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="flex flex-col">
                  <div className="text-[56px] font-semibold leading-none" style={{ color: GREEN, letterSpacing: "-2px" }}>{rating}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mt-[4px]" style={{ color: T4 }}>Out of 5</div>
                </div>
                <div className="flex gap-1 ml-auto">
                  {mobileStars()}
                </div>
              </div>

              {/* Sub metrics */}
              <div className="grid grid-cols-3 gap-2 pt-4 relative z-10" style={{ borderTop: `0.5px solid ${SEP}` }}>
                <div className="flex flex-col items-center gap-[4px]">
                  <div className="text-[18px] font-semibold leading-none" style={{ color: GREEN, letterSpacing: "-0.4px" }}>{conductGrade}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: T4 }}>Conduct</div>
                  <div className="h-1 w-full rounded-[2px] overflow-hidden" style={{ background: BG2 }}>
                    <div className="h-full rounded-[2px]" style={{ width: `${Math.min(100, rateNum * 20)}%`, background: `linear-gradient(90deg, ${GREEN}, #34C759)` }} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-[4px]">
                  <div className="text-[18px] font-semibold leading-none" style={{ color: B1, letterSpacing: "-0.4px" }}>{punctualityPct}%</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: T4 }}>Punctual</div>
                  <div className="h-1 w-full rounded-[2px] overflow-hidden" style={{ background: BG2 }}>
                    <div className="h-full rounded-[2px]" style={{ width: `${punctualityPct}%`, background: `linear-gradient(90deg, ${B1}, ${B4})` }} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-[4px]">
                  <div className="text-[18px] font-semibold leading-none" style={{ color: GOLD, letterSpacing: "-0.4px" }}>{respectScore}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: T4 }}>Respect</div>
                  <div className="h-1 w-full rounded-[2px] overflow-hidden" style={{ background: BG2 }}>
                    <div className="h-full rounded-[2px]" style={{ width: `${Math.min(100, rateNum * 20)}%`, background: `linear-gradient(90deg, ${GOLD}, #FFCC00)` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Positive Highlights ── */}
            <div className="mx-5 mt-3 bg-white rounded-[24px] p-5"
              style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
              <div className="flex items-center gap-[12px] mb-[16px]">
                <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${GREEN}, #34C759)`, boxShadow: "0 3px 10px rgba(52,199,89,0.26)" }}>
                  <Trophy className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <div className="text-[16px] font-semibold" style={{ color: T1, letterSpacing: "-0.3px" }}>Positive Highlights</div>
              </div>

              {positiveNotes.length === 0 ? (
                <div className="text-[13px] italic leading-[1.6] font-normal py-1" style={{ color: T3 }}>
                  No positive highlights yet. <strong style={{ color: GREEN, fontStyle: "normal", fontWeight: 600 }}>Keep shining!</strong>
                </div>
              ) : (
                positiveNotes.slice(0, 5).map((note, idx, arr) => {
                  const Icon = getIconForPositive(idx);
                  return (
                    <div key={note.id || idx}
                      className={`flex items-center gap-3 px-[16px] py-[12px] rounded-[16px] active:scale-[0.97] transition-transform cursor-pointer ${idx < arr.length - 1 ? "mb-2" : ""}`}
                      style={{
                        background: "rgba(52,199,89,0.09)",
                        border: "0.5px solid rgba(52,199,89,0.20)",
                        transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)"
                      }}>
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: "rgba(52,199,89,0.09)", border: "0.5px solid rgba(52,199,89,0.20)" }}>
                        <Icon className="w-[15px] h-[15px]" style={{ color: GREEN }} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: T1, letterSpacing: "-0.1px", marginBottom: 2 }}>
                          {note.content || "Great behaviour"}
                        </div>
                        <div className="text-[12px] font-semibold flex items-center gap-[4px]" style={{ color: T4 }}>
                          <Clock className="w-[10px] h-[10px]" strokeWidth={2.5} />
                          {formatNoteDate(note)}
                          {note.teacherName && (
                            <>
                              <span className="w-1 h-1 rounded-full" style={{ background: T4 }} />
                              <span className="truncate">{typeof note.teacherName === "string" ? note.teacherName : "Teacher"}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="px-[12px] py-1 rounded-full text-[12px] font-semibold shrink-0"
                        style={{ background: "rgba(52,199,89,0.09)", color: GREEN_D, border: "0.5px solid rgba(52,199,89,0.20)" }}>
                        {tierFor(idx)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Areas for Improvement ── */}
            <div className="mx-5 mt-3 bg-white rounded-[24px] p-5"
              style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
              <div className="flex items-center gap-[12px] mb-[16px]">
                <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,149,0,0.09)", border: "0.5px solid rgba(255,149,0,0.22)" }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: ORANGE }} strokeWidth={2.2} />
                </div>
                <div className="text-[16px] font-semibold" style={{ color: T1, letterSpacing: "-0.3px" }}>Areas for Improvement</div>
              </div>

              {improvementNotes.length === 0 ? (
                <div className="text-[13px] italic leading-[1.6] font-normal py-1" style={{ color: T3 }}>
                  No areas for improvement recorded! <strong style={{ color: GREEN, fontStyle: "normal", fontWeight: 600 }}>Great job.</strong>
                </div>
              ) : (
                improvementNotes.slice(0, 5).map((note, idx, arr) => {
                  const Icon = getIconForImprovement(idx);
                  return (
                    <div key={note.id || idx}
                      className={`flex items-center gap-3 px-[16px] py-[12px] rounded-[16px] active:scale-[0.97] transition-transform cursor-pointer ${idx < arr.length - 1 ? "mb-2" : ""}`}
                      style={{
                        background: "rgba(255,59,48,0.09)",
                        border: "0.5px solid rgba(255,59,48,0.20)",
                        transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)"
                      }}>
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: "rgba(255,59,48,0.09)", border: "0.5px solid rgba(255,59,48,0.20)" }}>
                        <Icon className="w-[15px] h-[15px]" style={{ color: RED }} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: T1, letterSpacing: "-0.1px", marginBottom: 2 }}>
                          {note.content || "Needs attention"}
                        </div>
                        <div className="text-[12px] font-semibold flex items-center gap-[4px]" style={{ color: T4 }}>
                          <Clock className="w-[10px] h-[10px]" strokeWidth={2.5} />
                          {formatNoteDate(note)}
                          {note.teacherName && (
                            <>
                              <span className="w-1 h-1 rounded-full" style={{ background: T4 }} />
                              <span className="truncate">{typeof note.teacherName === "string" ? note.teacherName : "Teacher"}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="px-[12px] py-1 rounded-full text-[12px] font-semibold shrink-0"
                        style={{ background: "rgba(255,59,48,0.09)", color: RED, border: "0.5px solid rgba(255,59,48,0.20)" }}>
                        Focus
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Behavior Trend Chart ── */}
            {trendData.length > 1 && (
              <div className="mx-5 mt-3 bg-white rounded-[24px] p-5"
                style={{ boxShadow: SH_LG, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[18px] font-semibold" style={{ color: T1, letterSpacing: "-0.3px" }}>Behavior Trend</div>
                  <div className="px-[12px] py-1 rounded-full text-[12px] font-semibold"
                    style={{ background: "rgba(10,132,255,0.10)", color: B1, border: "0.5px solid rgba(10,132,255,0.18)" }}>
                    {rating} {trendUp ? "↑" : "↓"}
                  </div>
                </div>
                <div className="text-[12px] mb-4 font-normal" style={{ color: T3 }}>Rating progression across months</div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="behMobileLine" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={B1} />
                          <stop offset="100%" stopColor="#7CBBFF" />
                        </linearGradient>
                        <linearGradient id="behMobileArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={B1} stopOpacity={0.14} />
                          <stop offset="100%" stopColor={B1} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(10,132,255,0.06)" />
                      <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: T4, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: T4, fontWeight: 600 }} domain={[1, 5]} width={28} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "0.5px solid rgba(10,132,255,0.15)", boxShadow: "0 4px 20px rgba(10,132,255,0.12)", fontSize: 11, padding: "6px 10px", background: "#fff" }}
                        formatter={(val: any) => [`${val.toFixed?.(1) ?? val}`, "Rating"]}
                      />
                      <Area type="monotone" dataKey="score" stroke="url(#behMobileLine)" strokeWidth={2.5} fill="url(#behMobileArea)" dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: B1 }} activeDot={{ r: 6, strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Breakdown Grid 2×2 ── */}
            <div className="grid grid-cols-2 gap-2 mx-5 mt-3">
              {[
                { val: conductGrade,         label: "Conduct",       color: GREEN,  ico: CheckCircle, decorIcon: ShieldCheck, cardBg: "linear-gradient(135deg, rgba(52,199,89,0.13) 0%, rgba(52,199,89,0.04) 100%)",   cardBdr: "rgba(52,199,89,0.20)", iconBoxBg: "rgba(52,199,89,0.18)", iconBoxBdr: "rgba(52,199,89,0.30)" },
                { val: `${punctualityPct}%`, label: "Punctuality",   color: B1,     ico: Clock,       decorIcon: Hourglass,   cardBg: "linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(10,132,255,0.03) 100%)",   cardBdr: "rgba(10,132,255,0.20)", iconBoxBg: "rgba(10,132,255,0.14)", iconBoxBdr: "rgba(10,132,255,0.28)" },
                { val: respectScore,         label: "Respect",       color: GOLD,   ico: Star,        decorIcon: HandHeart,   cardBg: "linear-gradient(135deg, rgba(255,204,0,0.13) 0%, rgba(255,204,0,0.04) 100%)", cardBdr: "rgba(255,204,0,0.22)", iconBoxBg: "rgba(255,204,0,0.18)", iconBoxBdr: "rgba(255,204,0,0.32)" },
                { val: participationScore,   label: "Participation", color: VIOLET, ico: Users,       decorIcon: Activity,    cardBg: "linear-gradient(135deg, rgba(175,82,222,0.12) 0%, rgba(175,82,222,0.04) 100%)", cardBdr: "rgba(175,82,222,0.22)", iconBoxBg: "rgba(175,82,222,0.16)", iconBoxBdr: "rgba(175,82,222,0.30)" },
              ].map(({ val, label, color, ico: Icon, decorIcon: DecorIcon, cardBg, cardBdr, iconBoxBg, iconBoxBdr }) => (
                <div key={label} className="rounded-[16px] px-[16px] py-[12px] relative overflow-hidden active:scale-[0.96] transition-transform cursor-pointer"
                  style={{ background: cardBg, border: `0.5px solid ${cardBdr}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                  <div className="absolute pointer-events-none" style={{ bottom: 6, right: 6 }}>
                    <DecorIcon style={{ width: 50, height: 50, color, opacity: 0.20, strokeWidth: 1.6 }} />
                  </div>
                  <div className="w-7 h-7 rounded-[9px] flex items-center justify-center mb-2 relative"
                    style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                    <Icon className="w-[14px] h-[14px]" style={{ color }} strokeWidth={2.5} />
                  </div>
                  <div className="text-[20px] font-semibold leading-none mb-[2px] relative" style={{ color, letterSpacing: "-0.5px" }}>{val}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.07em] relative" style={{ color: T4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── Dark Summary ── */}
            <div className="mx-5 mt-3 rounded-[24px] px-[24px] py-5 relative overflow-hidden"
              style={{
                background: "linear-gradient(140deg, #0A84FF 0%, #0A84FF 48%, #0A84FF 100%)",
                boxShadow: "0 8px 30px rgba(0,51,204,0.32), 0 0 0 0.5px rgba(255,255,255,0.14)",
              }}>
              <div className="absolute -top-[40px] -right-[24px] w-[170px] h-[170px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }} />
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-[12px] relative z-10" style={{ color: "rgba(255,255,255,0.48)" }}>
                Term Behaviour Summary
              </div>
              <div className="grid grid-cols-3 rounded-[16px] overflow-hidden relative z-10" style={{ gap: "1px", background: "rgba(255,255,255,0.12)" }}>
                <div className="py-[16px] px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[24px] font-semibold text-white leading-none mb-1" style={{ letterSpacing: "-0.7px" }}>{rating}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>Rating</div>
                </div>
                <div className="py-[16px] px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[24px] font-semibold text-white leading-none mb-1" style={{ letterSpacing: "-0.7px" }}>{incidents}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>{incidents === 1 ? "Incident" : "Incidents"}</div>
                </div>
                <div className="py-[16px] px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[24px] font-semibold text-white leading-none mb-1" style={{ letterSpacing: "-0.7px" }}>{conductGrade}</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>Grade</div>
                </div>
              </div>
            </div>

            <div className="h-6" />
          </>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  const B1 = "#0A84FF", B2 = "#3395FF", B3 = "#5BA9FF", B4 = "#7CBBFF";
  const BG_D = "#F5F5F7", BG2_D = "#EBEBF0";
  const T1 = "#1D1D1F", T3 = "#6E6E73", T4 = "#A1A1A6";
  const SEP_D = "rgba(10,132,255,0.07)";
  const GREEN = "#34C759", GREEN_D = "#248A3D";
  const RED = "#FF3B30";
  const ORANGE = "#FF9500";
  const GOLD = "#FFCC00";
  const VIOLET = "#AF52DE";
  const BLUE_BDR = "rgba(10,132,255,0.12)";
  const SH_D = "0 0 0 0.5px rgba(10,132,255,0.08), 0 2px 8px rgba(10,132,255,0.09), 0 10px 28px rgba(10,132,255,0.11)";
  const SH_LG_D = "0 0 0 0.5px rgba(10,132,255,0.10), 0 4px 16px rgba(10,132,255,0.12), 0 18px 44px rgba(10,132,255,0.14)";

  const rateNumD = ratingNum ?? 0;
  const incidentsD = improvementNotes.length;
  const conductGradeD = !hasBehaviourSignal ? "—" :
    rateNumD >= 4.8 ? "A+" :
    rateNumD >= 4.5 ? "A"  :
    rateNumD >= 4.0 ? "B+" :
    rateNumD >= 3.5 ? "B"  :
    rateNumD >= 3.0 ? "C"  : "D";
  const punctualityPctD = !hasBehaviourSignal ? 0 : Math.max(0, Math.round(100 - incidentsD * 8));
  const respectScoreD = !hasBehaviourSignal ? "—" : rateNumD.toFixed(1);
  const participationScoreD = !hasBehaviourSignal
    ? "—"
    : (Math.max(1, Math.min(5, rateNumD - (incidentsD ? 0.2 : 0) + (positiveNotes.length ? 0.1 : 0)))).toFixed(1);
  const tierForD = (i: number) => i === 0 ? "Gold" : i === 1 ? "Good" : "Nice";

  const renderDesktopStars = (rate: number) => {
    const stars: any[] = [];
    const full = Math.floor(rate);
    const half = rate - full >= 0.5;
    for (let i = 0; i < full; i++) {
      stars.push(<Star key={`f${i}`} className="w-7 h-7" style={{ color: GOLD, fill: GOLD }} strokeWidth={1.5} />);
    }
    if (half) stars.push(<StarHalf key="half" className="w-7 h-7" style={{ color: GOLD, fill: GOLD }} strokeWidth={1.5} />);
    const rest = 5 - stars.length;
    for (let i = 0; i < rest; i++) {
      stars.push(<Star key={`e${i}`} className="w-7 h-7" style={{ color: "rgba(255,204,0,0.25)", fill: "rgba(255,204,0,0.10)" }} strokeWidth={1.5} />);
    }
    return stars;
  };

  return (
    <div data-sfpro className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", background: BG_D }}>
      <div className="w-full px-6 pt-8 pb-10">

        {loading ? (
          <div className="bg-white rounded-[22px] py-10 flex flex-col items-center"
            style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: B1 }} />
            <p className="text-[13px] font-medium mt-3" style={{ color: T4 }}>Loading behaviour data…</p>
          </div>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-1 flex items-center gap-[8px]" style={{ color: T4 }}>
                  <span className="w-[6px] h-[6px] rounded-full" style={{ background: B1, boxShadow: "0 0 0 3px rgba(10,132,255,0.18)" }} />
                  Parent Dashboard · Behaviour
                </div>
                <h1 className="text-[28px] font-semibold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Behaviour &amp; Discipline</h1>
                <div className="text-[13px] font-normal mt-[8px]" style={{ color: T3 }}>Teacher observations, positive highlights, and improvement areas</div>
              </div>
              <div className="flex items-center gap-[12px]">
                <div className="px-[16px] py-[8px] rounded-full text-[12px] font-semibold flex items-center gap-[8px]"
                  style={{ background: "rgba(52,199,89,0.08)", color: GREEN_D, border: "0.5px solid rgba(52,199,89,0.22)" }}>
                  <Star className="w-[12px] h-[12px]" style={{ fill: GREEN }} />
                  {rating} / 5
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-white"
                  style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(10,132,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
                  {studentData?.name?.[0]?.toUpperCase() || "S"}
                </div>
              </div>
            </div>

            {/* ── Hero Row: Rating + Sub-metrics ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
              {/* Rating Card — col-3 */}
              <div className="lg:col-span-3 bg-white rounded-[22px] p-8 relative overflow-hidden"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="absolute -top-[40px] -right-[20px] w-[260px] h-[260px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(52,199,89,0.07) 0%, transparent 70%)" }} />
                <div className="relative z-10">
                  <div className="text-[18px] font-semibold mb-1" style={{ color: T1, letterSpacing: "-0.3px" }}>Overall Behavior Rating</div>
                  <div className="text-[12px] font-normal mb-6" style={{ color: T3 }}>Based on teacher observations this term</div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <div>
                      <div className="text-[72px] font-semibold leading-none" style={{ color: GREEN, letterSpacing: "-2.5px" }}>{rating}</div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.10em] mt-2" style={{ color: T4 }}>Out of 5</div>
                    </div>
                    <div className="flex gap-[8px]">
                      {renderDesktopStars(rateNumD)}
                    </div>
                  </div>

                  {/* Sub metrics */}
                  <div className="grid grid-cols-3 gap-4 pt-5 mt-6" style={{ borderTop: `0.5px solid ${SEP_D}` }}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{ color: T4 }}>Conduct</span>
                        <span className="text-[18px] font-semibold leading-none" style={{ color: GREEN, letterSpacing: "-0.3px" }}>{conductGradeD}</span>
                      </div>
                      <div className="h-[6px] rounded-[3px] overflow-hidden" style={{ background: BG2_D }}>
                        <div className="h-full rounded-[3px]" style={{ width: `${Math.min(100, rateNumD * 20)}%`, background: `linear-gradient(90deg, ${GREEN}, #34C759)` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{ color: T4 }}>Punctuality</span>
                        <span className="text-[18px] font-semibold leading-none" style={{ color: B1, letterSpacing: "-0.3px" }}>{!hasBehaviourSignal ? "—" : `${punctualityPctD}%`}</span>
                      </div>
                      <div className="h-[6px] rounded-[3px] overflow-hidden" style={{ background: BG2_D }}>
                        <div className="h-full rounded-[3px]" style={{ width: `${punctualityPctD}%`, background: `linear-gradient(90deg, ${B1}, ${B4})` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{ color: T4 }}>Respect</span>
                        <span className="text-[18px] font-semibold leading-none" style={{ color: GOLD, letterSpacing: "-0.3px" }}>{respectScoreD}</span>
                      </div>
                      <div className="h-[6px] rounded-[3px] overflow-hidden" style={{ background: BG2_D }}>
                        <div className="h-full rounded-[3px]" style={{ width: `${Math.min(100, rateNumD * 20)}%`, background: `linear-gradient(90deg, ${GOLD}, #FFCC00)` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown Grid — col-2 */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                {[
                  { val: conductGradeD,                                       label: "Conduct",       color: GREEN,  icon: CheckCircle, decorIcon: ShieldCheck, cardBg: "linear-gradient(135deg, rgba(52,199,89,0.13) 0%, rgba(52,199,89,0.04) 100%)",   cardBdr: "rgba(52,199,89,0.20)", iconBoxBg: "rgba(52,199,89,0.18)", iconBoxBdr: "rgba(52,199,89,0.30)" },
                  { val: !hasBehaviourSignal ? "—" : `${punctualityPctD}%`,    label: "Punctuality",   color: B1,     icon: Clock,       decorIcon: Hourglass,   cardBg: "linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(10,132,255,0.03) 100%)",   cardBdr: "rgba(10,132,255,0.20)", iconBoxBg: "rgba(10,132,255,0.14)", iconBoxBdr: "rgba(10,132,255,0.28)" },
                  { val: respectScoreD,                                       label: "Respect",       color: GOLD,   icon: Star,        decorIcon: HandHeart,   cardBg: "linear-gradient(135deg, rgba(255,204,0,0.13) 0%, rgba(255,204,0,0.04) 100%)", cardBdr: "rgba(255,204,0,0.22)", iconBoxBg: "rgba(255,204,0,0.18)", iconBoxBdr: "rgba(255,204,0,0.32)" },
                  { val: participationScoreD,                                 label: "Participation", color: VIOLET, icon: Users,       decorIcon: Activity,    cardBg: "linear-gradient(135deg, rgba(175,82,222,0.12) 0%, rgba(175,82,222,0.04) 100%)", cardBdr: "rgba(175,82,222,0.22)", iconBoxBg: "rgba(175,82,222,0.16)", iconBoxBdr: "rgba(175,82,222,0.30)" },
                ].map(({ val, label, color, icon: Icon, decorIcon: DecorIcon, cardBg, cardBdr, iconBoxBg, iconBoxBdr }) => (
                  <div key={label} className="rounded-[18px] px-5 py-5 relative overflow-hidden transition-transform hover:-translate-y-0.5"
                    style={{ background: cardBg, boxShadow: SH_D, border: `0.5px solid ${cardBdr}` }}>
                    <div className="absolute pointer-events-none" style={{ bottom: 14, right: 14 }}>
                      <DecorIcon style={{ width: 80, height: 80, color, opacity: 0.20, strokeWidth: 1.6 }} />
                    </div>
                    <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 relative"
                      style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                      <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.3} />
                    </div>
                    <div className="text-[28px] font-semibold leading-none mb-1 relative" style={{ color, letterSpacing: "-0.6px" }}>{val}</div>
                    <div className="text-[12px] font-semibold uppercase tracking-[0.10em] relative" style={{ color: T4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Highlights Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* Positive */}
              <div className="bg-white rounded-[22px] p-6"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${GREEN}, #34C759)`, boxShadow: "0 3px 12px rgba(52,199,89,0.28)" }}>
                    <Trophy className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold" style={{ color: T1, letterSpacing: "-0.3px" }}>Positive Highlights</div>
                    <div className="text-[12px] font-normal mt-[2px]" style={{ color: T3 }}>{positiveNotes.length} recorded</div>
                  </div>
                </div>

                {positiveNotes.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-[13px] leading-[1.6]" style={{ color: T3 }}>
                      No positive highlights yet. <strong style={{ color: GREEN_D }}>Keep shining!</strong>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positiveNotes.slice(0, 6).map((note, idx) => {
                      const Icon = getIconForPositive(idx);
                      return (
                        <div key={note.id || idx}
                          className="flex items-center gap-3 px-4 py-3 rounded-[14px]"
                          style={{ background: "rgba(52,199,89,0.06)", border: "0.5px solid rgba(52,199,89,0.18)" }}>
                          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
                            style={{ background: "rgba(52,199,89,0.10)", border: "0.5px solid rgba(52,199,89,0.22)" }}>
                            <Icon className="w-[16px] h-[16px]" style={{ color: GREEN }} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold mb-[4px]" style={{ color: T1, letterSpacing: "-0.1px" }}>
                              {note.content || "Great behaviour"}
                            </div>
                            <div className="text-[12px] font-semibold flex items-center gap-[4px]" style={{ color: T4 }}>
                              <Clock className="w-[10px] h-[10px]" strokeWidth={2.5} />
                              {formatNoteDate(note)}
                              {note.teacherName && (
                                <>
                                  <span className="w-1 h-1 rounded-full" style={{ background: T4 }} />
                                  <span className="truncate max-w-[140px]">{typeof note.teacherName === "string" ? note.teacherName : "Teacher"}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="px-[12px] py-[4px] rounded-full text-[12px] font-semibold shrink-0"
                            style={{ background: "rgba(52,199,89,0.10)", color: GREEN_D, border: "0.5px solid rgba(52,199,89,0.22)" }}>
                            {tierForD(idx)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Improvement */}
              <div className="bg-white rounded-[22px] p-6"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ORANGE}, #FF9500)`, boxShadow: "0 3px 12px rgba(255,149,0,0.28)" }}>
                    <AlertTriangle className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold" style={{ color: T1, letterSpacing: "-0.3px" }}>Areas for Improvement</div>
                    <div className="text-[12px] font-normal mt-[2px]" style={{ color: T3 }}>{improvementNotes.length} flagged</div>
                  </div>
                </div>

                {improvementNotes.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-[13px] leading-[1.6]" style={{ color: T3 }}>
                      No areas flagged. <strong style={{ color: GREEN_D }}>Great job.</strong>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {improvementNotes.slice(0, 6).map((note, idx) => {
                      const Icon = getIconForImprovement(idx);
                      return (
                        <div key={note.id || idx}
                          className="flex items-center gap-3 px-4 py-3 rounded-[14px]"
                          style={{ background: "rgba(255,59,48,0.06)", border: "0.5px solid rgba(255,59,48,0.18)" }}>
                          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
                            style={{ background: "rgba(255,59,48,0.10)", border: "0.5px solid rgba(255,59,48,0.22)" }}>
                            <Icon className="w-[16px] h-[16px]" style={{ color: RED }} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold mb-[4px]" style={{ color: T1, letterSpacing: "-0.1px" }}>
                              {note.content || "Needs attention"}
                            </div>
                            <div className="text-[12px] font-semibold flex items-center gap-[4px]" style={{ color: T4 }}>
                              <Clock className="w-[10px] h-[10px]" strokeWidth={2.5} />
                              {formatNoteDate(note)}
                              {note.teacherName && (
                                <>
                                  <span className="w-1 h-1 rounded-full" style={{ background: T4 }} />
                                  <span className="truncate max-w-[140px]">{typeof note.teacherName === "string" ? note.teacherName : "Teacher"}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="px-[12px] py-[4px] rounded-full text-[12px] font-semibold shrink-0"
                            style={{ background: "rgba(255,59,48,0.10)", color: RED, border: "0.5px solid rgba(255,59,48,0.22)" }}>
                            Focus
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Bottom Row: Trend Chart + Dark Summary ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Trend Chart */}
              <div className="lg:col-span-2 bg-white rounded-[22px] p-6"
                style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(10,132,255,0.10)" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[18px] font-semibold" style={{ color: T1, letterSpacing: "-0.3px" }}>Behavior Trend</div>
                    <div className="text-[12px] font-normal mt-[2px]" style={{ color: T3 }}>Rating progression across months</div>
                  </div>
                  <div className="px-[12px] py-[4px] rounded-full text-[12px] font-semibold"
                    style={{ background: "rgba(10,132,255,0.10)", color: B1, border: `0.5px solid ${BLUE_BDR}` }}>
                    {rating} / 5
                  </div>
                </div>
                {trendData.length > 1 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="behDeskArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={B1} stopOpacity={0.22} />
                            <stop offset="100%" stopColor={B1} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="behDeskLine" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={B1} />
                            <stop offset="100%" stopColor="#7CBBFF" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(10,132,255,0.07)" />
                        <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: T4 }} dy={8} />
                        <YAxis domain={[1, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: T4 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: `0.5px solid ${BLUE_BDR}`, boxShadow: "0 4px 20px rgba(10,132,255,0.12)", fontSize: 12, fontFamily: "'SF Pro Display'", background: "#fff" }}
                          formatter={(val: any) => [`${val?.toFixed?.(1) ?? val}`, "Rating"]} />
                        <Area type="monotone" dataKey="score" stroke="url(#behDeskLine)" strokeWidth={3} fill="url(#behDeskArea)"
                          dot={{ r: 5, fill: B1, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[13px]" style={{ color: T4 }}>
                    Not enough data yet for a trend.
                  </div>
                )}
              </div>

              {/* Dark Summary */}
              <div className="rounded-[22px] px-6 py-6 relative overflow-hidden"
                style={{
                  background: "linear-gradient(140deg, #0A84FF 0%, #0A84FF 48%, #0A84FF 100%)",
                  boxShadow: "0 8px 30px rgba(0,51,204,0.34), 0 0 0 0.5px rgba(255,255,255,0.14)",
                }}>
                <div className="absolute -top-10 -right-7 w-[200px] h-[200px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
                  backgroundSize: "24px 24px"
                }} />
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-2 relative z-10" style={{ color: "rgba(255,255,255,0.50)" }}>Term Summary</div>
                <div className="text-[20px] font-semibold mb-5 relative z-10 text-white" style={{ letterSpacing: "-0.3px" }}>Behaviour Overview</div>
                <div className="space-y-2 relative z-10">
                  {[
                    { label: "Rating", val: rating },
                    { label: incidentsD === 1 ? "Incident" : "Incidents", val: `${incidentsD}` },
                    { label: "Grade", val: conductGradeD },
                    { label: "Positive notes", val: `${positiveNotes.length}` },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.50)" }}>{label}</span>
                      <span className="text-[18px] font-semibold text-white" style={{ letterSpacing: "-0.3px" }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
