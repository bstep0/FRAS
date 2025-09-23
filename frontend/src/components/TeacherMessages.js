import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import TeacherLayout from "./TeacherLayout";
import {
  resolveTimestamp,
  useNotifications,
} from "../context/NotificationsContext";

const formatTimestamp = (value) => {
  const resolved = resolveTimestamp(value);
  if (!resolved) {
    return "";
  }

  const now = new Date();
  const diff = now - resolved;
  const oneDay = 24 * 60 * 60 * 1000;
  if (diff < oneDay) {
    return resolved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diff < oneDay * 7) {
    return resolved.toLocaleDateString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  return resolved.toLocaleDateString();
};

const TeacherMessages = () => {
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pushToast } = useNotifications();
  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchThreads = async () => {
      if (!user?.email) {
        if (isMounted) {
          setThreads([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const usersRef = collection(db, "users");
        const teacherQuery = query(usersRef, where("email", "==", user.email));
        const teacherSnapshot = await getDocs(teacherQuery);

        if (!isMounted) return;

        if (teacherSnapshot.empty) {
          setThreads([]);
          setIsLoading(false);
          return;
        }

        const teacherDoc = teacherSnapshot.docs[0];
        const teacherId = teacherDoc.id;

        const messagesRef = collection(db, "messages");
        const candidateQueries = [
          query(messagesRef, where("teacherId", "==", teacherId)),
          query(messagesRef, where("teacher", "==", teacherId)),
          query(messagesRef, where("participants", "array-contains", teacherId)),
        ];

        const collectedThreads = [];
        const seenIds = new Set();

        for (const candidate of candidateQueries) {
          try {
            const snapshot = await getDocs(candidate);
            snapshot.forEach((docSnapshot) => {
              if (seenIds.has(docSnapshot.id)) return;
              seenIds.add(docSnapshot.id);

              const data = docSnapshot.data();
              const participants = Array.isArray(data.participants) ? data.participants : [];
              const otherParticipant = participants.find(
                (participant) => participant && participant !== teacherId
              );

              const lastEntry = Array.isArray(data.messages)
                ? data.messages[data.messages.length - 1] || null
                : null;

              collectedThreads.push({
                id: docSnapshot.id,
                subject: data.subject || data.title || data.topic || "Conversation",
                displayName:
                  data.studentName ||
                  data.student?.name ||
                  data.student ||
                  data.participantName ||
                  otherParticipant ||
                  "Conversation",
                preview:
                  data.lastMessage ||
                  data.preview ||
                  data.snippet ||
                  data.latestMessage ||
                  (lastEntry && (lastEntry.text || lastEntry.message || lastEntry.body)) ||
                  "",
                updatedAt:
                  data.updatedAt ||
                  data.lastUpdated ||
                  data.timestamp ||
                  data.lastMessageAt ||
                  (lastEntry && (lastEntry.timestamp || lastEntry.createdAt || lastEntry.sentAt)),
              });
            });
          } catch (error) {
            console.error("Error loading teacher messages query:", error);
          }
        }

        if (!isMounted) return;

        setThreads(collectedThreads);
      } catch (error) {
        console.error("Error fetching teacher messages:", error);
        pushToast({
          tone: "error",
          title: "Unable to load messages",
          message: "We couldn't load your inbox right now. Please try again shortly.",
        });
        if (isMounted) {
          setThreads([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchThreads();

    return () => {
      isMounted = false;
    };
  }, [user, pushToast]);

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const first = resolveTimestamp(a.updatedAt);
      const second = resolveTimestamp(b.updatedAt);
      return (second ? second.getTime() : 0) - (first ? first.getTime() : 0);
    });
  }, [threads]);

  return (
    <TeacherLayout title="Messages">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Inbox</h2>
        <p className="mt-2 text-sm text-gray-600">
          Review conversations with students to follow up on attendance questions and announcements.
        </p>
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading messages…</p>
          ) : sortedThreads.length ? (
            sortedThreads.map((thread, index) => (
              <div
                key={thread.id}
                className="flex flex-col gap-3 rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={`https://i.pravatar.cc/64?img=${(index % 70) + 1}`}
                    alt="Participant avatar"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-base font-semibold text-gray-900">{thread.displayName}</p>
                    <p className="text-sm text-gray-600">{thread.subject}</p>
                    {thread.preview ? (
                      <p className="mt-1 text-sm text-gray-500">{thread.preview}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xs text-gray-500">{formatTimestamp(thread.updatedAt)}</p>
                  <Link
                    to={`/teacher/messages/${thread.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    View conversation
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No messages yet. Check back soon.</p>
          )}
        </div>
      </section>
    </TeacherLayout>
  );
};

export default TeacherMessages;
