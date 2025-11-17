import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const roleFromProfile = (profileData) => {
  if (!profileData) return null;

  const possibleFields = [
    "role",
    "userType",
    "type",
    "accountType",
  ];

  for (const field of possibleFields) {
    if (profileData[field]) {
      return String(profileData[field]).toLowerCase();
    }
  }

  return null;
};

const fallbackPathForRole = (role) => {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    default:
      return "/";
  }
};

const RequireRole = ({ role, allowedRoles, children }) => {
  const [authUser, setAuthUser] = useState(() => auth.currentUser);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const location = useLocation();

  const normalizedRoles = useMemo(() => {
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.map((value) => String(value).toLowerCase());
    }

    if (role) {
      return [String(role).toLowerCase()];
    }

    return [];
  }, [allowedRoles, role]);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!isMounted) return;

      setAuthUser(firebaseUser);
      setUserRole(null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const resolveRole = async () => {
      if (!authReady) return;

      if (isMounted) {
        setLoading(true);
      }

      if (!authUser?.email) {
        if (isMounted) {
          setUserRole(null);
          setLoading(false);
        }
        return;
      }

      try {
        const usersRef = collection(db, "users");
        const roleQuery = query(usersRef, where("email", "==", authUser.email));
        const snapshot = await getDocs(roleQuery);
        const profileData = snapshot.docs[0]?.data();
        const derivedRole = roleFromProfile(profileData);

        if (isMounted) {
          setUserRole(derivedRole);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to resolve user role", error);
        if (isMounted) {
          setUserRole(null);
          setLoading(false);
        }
      }
    };

    resolveRole();

    return () => {
      isMounted = false;
    };
  }, [authUser, authReady]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-white">
        <p className="text-lg font-semibold">Loading your experience…</p>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (normalizedRoles.length && (!userRole || !normalizedRoles.includes(userRole))) {
    return <Navigate to={fallbackPathForRole(userRole)} replace />;
  }

  return children;
};

export default RequireRole;
