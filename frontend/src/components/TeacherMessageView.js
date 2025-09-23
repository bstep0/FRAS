import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import TeacherLayout from "./TeacherLayout";
import {
  resolveTimestamp,
  useNotifications,
} from "../context/NotificationsContext";

const formatMessageTimestamp = (value) => {
  if (!value) {
    return "";
  }
  const resolved = value instanceof Date ? value : resolveTimestamp(value);
  if (!resolved) {
    return "";
  }
  return resolved.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const TeacherMessageView = () => {
  const { messageId } = useParams();
  const [thread, setThread] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageDraft, setMessageDraft] = useState("");
  const { pushToast } = useNotifications();
  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchThread = async () => {
      if (!messageId) {
        setThread(null);
        setIsLoading(false);
        return;
      }

      if (!user?.email) {
        if (isMounted) {
          setThread(null);
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
          setThread(null);
          setIsLoading(false);
          return;
        }

        const teacherDoc = teacherSnapshot.docs[0];
        const teacherDocId = teacherDoc.id;

        const threadRef = doc(db, "messages", messageId);
        const threadSnap = await getDoc(threadRef);

        if (!isMounted) return;

        if (!threadSnap.exists()) {
          setThread(null);
          setIsLoading(false);
          return;
        }

        const threadData = threadSnap.data();
        const participants = Array.isArray(threadData.participants)
          ? threadData.participants
          : [];
        const otherParticipant =
          threadData.studentName ||
          threadData.student?.name ||
          threadData.student ||
          threadData.participantName ||
          participants.find((participant) => participant && participant !== teacherDocId) ||
          "Conversation";

        const normalizedMessages = (Array.isArray(threadData.messages)
          ? threadData.messages
          : []
        )
          .map((message, index) => {
            const senderId =
              message.senderId ||
              message.sender ||
              message.authorId ||
              message.userId ||
              message.from;
            const createdAt = resolveTimestamp(
              message.timestamp ||
                message.createdAt ||
                message.sentAt ||
                message.time
            );
            const isTeacherMessage =
              senderId === teacherDocId ||
              senderId === threadData.teacherId ||
              senderId === threadData.teacher ||
              (senderId?.id && senderId.id === teacherDocId);

            return {
              id: message.id || index,
              text:
                message.text ||
                message.message ||
                message.body ||
                message.content ||
                "",
              senderId: senderId || "unknown",
              createdAt,
              isTeacher: Boolean(isTeacherMessage),
            };
          })
          .sort((a, b) => {
            const first = a.createdAt ? a.createdAt.getTime() : 0;
            const second = b.createdAt ? b.createdAt.getTime() : 0;
            return first - second;
          });

        setThread({
          id: threadSnap.id,
          subject: threadData.subject || threadData.title || threadData.topic || "Conversation",
          participantName: otherParticipant,
          messages: normalizedMessages,
          updatedAt:
            threadData.updatedAt ||
            threadData.lastUpdated ||
            threadData.timestamp ||
            threadData.lastMessageAt,
        });
      } catch (error) {
        console.error("Error loading teacher message thread:", error);
        pushToast({
          tone: "error",
          title: "Unable to load conversation",
          message: "We couldn't open this conversation. Please try again shortly.",
        });
        if (isMounted) {
          setThread(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchThread();

    return () => {
      isMounted = false;
    };
  }, [messageId, user, pushToast]);

  const pageTitle = useMemo(() => {
    if (thread?.participantName) {
      return `Chat with ${thread.participantName}`;
    }
    if (thread?.subject) {
      return thread.subject;
    }
    return "Conversation";
  }, [thread]);

  return (
    <TeacherLayout
      title={pageTitle}
      headerActions={
        <Link
          to="/teacher/messages"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Back to inbox
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading conversation…</p>
        ) : thread ? (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">Message history</h2>
              <p className="mt-2 text-sm text-gray-600">
                Review the conversation with {thread.participantName}. Responses sent here will be visible to the student.
              </p>
              <div className="mt-6 space-y-4">
                {thread.messages.length ? (
                  thread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isTeacher ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xl rounded-lg px-4 py-3 text-sm shadow-sm ${
                          message.isTeacher
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p>{message.text || "(No message content)"}</p>
                        <p
                          className={`mt-2 text-xs ${
                            message.isTeacher ? "text-blue-100" : "text-gray-500"
                          }`}
                        >
                          {message.isTeacher ? "You" : thread.participantName} • {" "}
                          {formatMessageTimestamp(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    No messages in this conversation yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Send a message</h2>
              <p className="mt-2 text-sm text-gray-600">
                Messaging from the web app is coming soon. Draft a response below to save your notes for later.
              </p>
              <textarea
                rows={4}
                className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Type your reply…"
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-500">Drafts are stored locally and will clear when you leave this page.</p>
                <button
                  type="button"
                  className="cursor-not-allowed rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500"
                  disabled
                >
                  Send (coming soon)
                </button>
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-gray-500">Conversation not found.</p>
        )}
      </div>
    </TeacherLayout>
  );
};

export default TeacherMessageView;
