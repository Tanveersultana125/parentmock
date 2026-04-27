import React, { createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH REMOVED — this dashboard is a mock/demo build.
//
// The original implementation gated the app behind Google sign-in + a Firestore
// student-whitelist check. Because every page now renders from `MOCK_*` data
// (see `USE_MOCK_DATA = true` in each page), the auth flow added nothing useful
// and broke the demo for anyone without a Firebase project. This module is now
// a no-op stub: it preserves the `useAuth()` shape so existing consumers
// continue to compile and run, but it never touches Firebase auth.
// ─────────────────────────────────────────────────────────────────────────────

interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

interface AuthContextType {
  user: MockUser | null;
  studentData: any | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const MOCK_USER: MockUser = {
  uid: 'mock-parent-001',
  email: 'rajesh.sharma@example.com',
  displayName: 'Rajesh Sharma',
  photoURL: null,
};

const MOCK_STUDENT_DATA = {
  id: 'mock-student-001',
  name: 'Aarav Sharma',
  email: 'aarav.sharma@example.com',
  grade: '8B',
  className: '8B',
  rollNo: '23',
  schoolId: 'mock-school-001',
  schoolName: 'Edullent Demo School',
  branch: 'Main Campus',
  status: 'Active',
};

const MOCK_VALUE: AuthContextType = {
  user: MOCK_USER,
  studentData: MOCK_STUDENT_DATA,
  loading: false,
  loginWithGoogle: async () => {},
  logout: async () => {},
  error: null,
};

const AuthContext = createContext<AuthContextType>(MOCK_VALUE);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AuthContext.Provider value={MOCK_VALUE}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
