import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const buildDisplayName = (userData, fallback) => {
  if (!userData) {
    return fallback;
  }

  const { fname, lname, displayName, name } = userData;
  const composed = [fname, lname].filter(Boolean).join(" ");

  return composed || displayName || name || fallback;
};

const buildInitials = (displayName, email) => {
  if (displayName) {
    const matches = displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase());

    if (matches.length) {
      return matches.join("");
    }
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "UN";
};

export const useUserProfile = () => {
  const [profile, setProfile] = useState({
    displayName: "",
    email: "",
    initials: "",
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    const user = auth.currentUser;

    if (!user?.email) {
      if (isMounted) {
        setProfile({ displayName: "", email: "", initials: "", isLoading: false });
      }
      return () => {
        isMounted = false;
      };
    }

    const fetchProfile = async () => {
      try {
        const usersRef = collection(db, "users");
        const profileQuery = query(usersRef, where("email", "==", user.email));
        const snapshot = await getDocs(profileQuery);

        if (!isMounted) return;

        const userData = snapshot.docs[0]?.data();
        const displayName = buildDisplayName(userData, user.displayName || user.email);
        const initials = buildInitials(displayName, user.email);

        setProfile({
          displayName,
          email: user.email,
          initials,
          isLoading: false,
        });
      } catch (error) {
        console.error("Failed to load user profile", error);
        if (isMounted) {
          const fallbackName = user.displayName || user.email || "User";
          setProfile({
            displayName: fallbackName,
            email: user.email || "",
            initials: buildInitials(fallbackName, user.email),
            isLoading: false,
          });
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  return useMemo(() => profile, [profile]);
};

export default useUserProfile;

