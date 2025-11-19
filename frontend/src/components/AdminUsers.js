import React, { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import AdminLayout from "./AdminLayout";
import { useNotifications } from "../context/NotificationsContext";
import { ADMIN_CREATE_USER_ENDPOINT } from "../config/api";

const defaultFormState = {
  userId: "",
  fname: "",
  lname: "",
  email: "",
  role: "student",
  classes: [],
};

const idPrefixByRole = {
  student: "S",
  teacher: "T",
  admin: "A",
};

const idSeedByRole = {
  student: 1000,
  teacher: 1000,
  admin: 1000,
};

const isValidUserIdForRole = (userId, role) => {
  const prefix = idPrefixByRole[role];
  if (!prefix) return false;
  const match = new RegExp(`^${prefix}(\\d+)$`, "i").exec(userId || "");
  return Boolean(match);
};

const buildNextIdsByRole = (users) => {
  const nextIds = { ...idSeedByRole };

  users.forEach((user) => {
    const role = (user.role || "").toLowerCase();
    const prefix = idPrefixByRole[role];
    if (!prefix) return;

    const match = new RegExp(`^${prefix}(\\d+)$`, "i").exec(user.id || "");
    if (match && match[1]) {
      const numericPart = parseInt(match[1], 10);
      if (!Number.isNaN(numericPart)) {
        nextIds[role] = Math.max(nextIds[role], numericPart + 1);
      }
    }
  });

  return Object.fromEntries(
    Object.entries(nextIds).map(([role, seed]) => [
      role,
      `${idPrefixByRole[role]}${seed}`,
    ])
  );
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(defaultFormState);
  const [editingUserId, setEditingUserId] = useState(null);

  const { pushToast } = useNotifications();

  const nextIdsByRole = useMemo(() => buildNextIdsByRole(users), [users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const normalized = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        const name = [data.fname, data.lname].filter(Boolean).join(" ");
        const role = (data.role || data.userType || "student")
          .toString()
          .toLowerCase();

        return {
          id: docSnapshot.id,
          name:
            name ||
            data.displayName ||
            data.name ||
            data.email ||
            "User",
          email: data.email || "",
          role,
          classes: Array.isArray(data.classes)
            ? data.classes.filter(Boolean)
            : [],
          fname: data.fname || "",
          lname: data.lname || "",
          userId: docSnapshot.id,
        };
      });
      setUsers(normalized);
    } catch (error) {
      console.error("Failed to fetch users", error);
      pushToast({
        tone: "error",
        title: "Unable to load users",
        message:
          "We couldn't retrieve users right now. Please try again soon.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const classesRef = collection(db, "classes");
      const snapshot = await getDocs(classesRef);
      const normalized = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          name: data.name || data.title || docSnapshot.id,
        };
      });
      setClasses(normalized);
    } catch (error) {
      console.error("Failed to fetch classes", error);
      pushToast({
        tone: "error",
        title: "Unable to load classes",
        message:
          "We couldn't retrieve the class list. Please try again soon.",
      });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchClasses();
  }, []);

  const resetForm = () => {
    setFormState({
      ...defaultFormState,
      userId: nextIdsByRole[defaultFormState.role] || "",
    });
    setEditingUserId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setFormState({
      userId: user.id,
      fname: user.fname || "",
      lname: user.lname || "",
      email: user.email || "",
      role: (user.role || "student").toString().toLowerCase(),
      classes: user.classes || [],
    });
    setEditingUserId(user.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const handleInputChange = (field, value) => {
    setFormState((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "role" && !editingUserId) {
        const normalizedRole = value.toString().toLowerCase();
        updated.userId = nextIdsByRole[normalizedRole] || "";
      }

      return updated;
    });
  };

  const toggleClassSelection = (classId) => {
    setFormState((prev) => {
      const hasClass = prev.classes.includes(classId);
      return {
        ...prev,
        classes: hasClass
          ? prev.classes.filter((id) => id !== classId)
          : [...prev.classes, classId],
      };
    });
  };

  const syncClassAssignments = async (
    userId,
    newClasses,
    previousClasses,
    newRole,
    previousRole
  ) => {
    const normalizedNewRole = (newRole || "").toLowerCase();
    const normalizedPreviousRole = (
      previousRole || normalizedNewRole
    ).toLowerCase();

    const added = newClasses.filter(
      (id) => !previousClasses.includes(id)
    );
    const removed = previousClasses.filter(
      (id) => !newClasses.includes(id)
    );
    const unchanged = newClasses.filter((id) =>
      previousClasses.includes(id)
    );

    const applyUpdate = async (classId, role, operation) => {
      const classRef = doc(db, "classes", classId);
      if (role === "teacher") {
        if (operation === "add") {
          const snapshot = await getDoc(classRef);
          const currentTeacher = snapshot.exists()
            ? snapshot.data().teacher
            : "";

          const updates = [];

          if (currentTeacher && currentTeacher !== userId) {
            updates.push(
              updateDoc(doc(db, "users", currentTeacher), {
                classes: arrayRemove(classId),
              })
            );
          }

          updates.push(updateDoc(classRef, { teacher: userId }));

          return Promise.all(updates);
        }

        return updateDoc(classRef, { teacher: "" });
      }
      if (role === "student") {
        return updateDoc(classRef, {
          students:
            operation === "add"
              ? arrayUnion(userId)
              : arrayRemove(userId),
        });
      }
      return Promise.resolve();
    };

    const classUpdates = added.map((classId) =>
      applyUpdate(classId, normalizedNewRole, "add")
    );
    const removalUpdates = removed.map((classId) =>
      applyUpdate(classId, normalizedPreviousRole, "remove")
    );

    const roleChangeUpdates =
      normalizedNewRole !== normalizedPreviousRole
        ? unchanged.flatMap((classId) => [
            applyUpdate(
              classId,
              normalizedPreviousRole,
              "remove"
            ),
            applyUpdate(classId, normalizedNewRole, "add"),
          ])
        : [];

    await Promise.all([
      ...classUpdates,
      ...removalUpdates,
      ...roleChangeUpdates,
    ]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formState.email.trim()) {
      pushToast({
        tone: "warning",
        title: "Missing email",
        message:
          "Please provide an email before saving the user.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const normalizedRole = formState.role.toLowerCase();
      const targetUserId = (
        editingUserId ||
        formState.userId ||
        ""
      ).trim();

      if (!targetUserId) {
        pushToast({
          tone: "warning",
          title: "Missing ID",
          message:
            "Please provide an ID for this user (e.g., S1000).",
        });
        return;
      }

      if (!isValidUserIdForRole(targetUserId, normalizedRole)) {
        pushToast({
          tone: "warning",
          title: "Invalid ID format",
          message:
            "IDs must start with A, T, or S followed by numbers to match the user role.",
        });
        return;
      }

      if (
        !editingUserId &&
        users.some((user) => user.id === targetUserId)
      ) {
        pushToast({
          tone: "warning",
          title: "Duplicate ID",
          message:
            "Another user already has this ID. Please choose a unique value.",
        });
        return;
      }

      const basePayload = {
        id: targetUserId,        
        email: formState.email.trim(),
        fname: formState.fname.trim(),
        lname: formState.lname.trim(),
        classes: formState.classes,
        role: normalizedRole,
      };


      // Only attach the ID field that matches the role so we never send undefined.
      const payload = { ...basePayload };
      if (normalizedRole === "student") {
        payload.studentID = targetUserId;
      } else if (normalizedRole === "teacher") {
        payload.teacherID = targetUserId;
      } else if (normalizedRole === "admin") {
        payload.adminID = targetUserId;
      }

      // If this is a NEW user, first create the Firebase Auth account
      // so they can log in immediately with default password "test123".
      if (!editingUserId) {
        const authResponse = await fetch(
          ADMIN_CREATE_USER_ENDPOINT,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: payload.email,
              password: "test123",
              role: payload.role,
              fname: payload.fname,
              lname: payload.lname,
            }),
          }
        );

        let authResult = null;
        try {
          authResult = await authResponse.json();
        } catch (err) {
          console.error(
            "Failed to parse admin create-user response",
            err
          );
        }

        if (
          !authResponse.ok ||
          authResult?.status !== "success"
        ) {
          throw new Error(
            authResult?.message ||
              "Failed to create Firebase Auth user."
          );
        }
      }

      if (editingUserId) {
        const userRef = doc(db, "users", editingUserId);
        const existing = users.find(
          (user) => user.id === editingUserId
        );
        await updateDoc(userRef, payload);
        await syncClassAssignments(
          editingUserId,
          payload.classes,
          existing?.classes || [],
          payload.role,
          existing?.role
        );
        pushToast({
          tone: "success",
          title: "User updated",
          message: "Changes saved successfully.",
        });
      } else {
        const docRef = doc(db, "users", targetUserId);
        await setDoc(docRef, payload);
        await syncClassAssignments(
          targetUserId,
          payload.classes,
          [],
          payload.role
        );
        pushToast({
          tone: "success",
          title: "User created",
          message:
            "The user was added successfully. Default password is test123.",
        });
      }

      closeModal();
      fetchUsers();
    } catch (error) {
      console.error("Failed to save user", error);
      pushToast({
        tone: "error",
        title: "Save failed",
        message:
          "We couldn't save the user. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userId, role, classIds) => {
    const confirmed = window.confirm(
      "Delete this user? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "users", userId));

      if (classIds?.length) {
        const updates = classIds.map(async (classId) => {
          const classRef = doc(db, "classes", classId);
          if (role === "teacher") {
            await updateDoc(classRef, { teacher: "" });
          } else if (role === "student") {
            await updateDoc(classRef, {
              students: arrayRemove(userId),
            });
          }
        });
        await Promise.all(updates);
      }

      pushToast({
        tone: "success",
        title: "User deleted",
        message: "The user was removed.",
      });
      fetchUsers();
    } catch (error) {
      console.error("Failed to delete user", error);
      pushToast({
        tone: "error",
        title: "Delete failed",
        message:
          "We couldn't delete the user right now.",
      });
    }
  };

  const classLookup = useMemo(() => {
    return classes.reduce((acc, classItem) => {
      acc[classItem.id] = classItem.name;
      return acc;
    }, {});
  }, [classes]);

  return (
    <AdminLayout
      title="User Management"
      headerActions={
        <button
          type="button"
          onClick={fetchUsers}
          className="brand-button--ghost"
          disabled={isLoading}
        >
          Refresh
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              AttendU Users
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Review accounts, adjust roles, and manage class
              assignments.
            </p>
          </div>
          <button
            type="button"
            className="brand-button"
            onClick={openCreateModal}
          >
            Add User
          </button>
        </div>

        <section className="glass-card">
          {isLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Loading users…
            </p>
          ) : users.length ? (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {user.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {user.email}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-unt-green">
                      {user.role}
                    </p>
                    {user.classes.length ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Classes:{" "}
                        {user.classes
                          .map(
                            (id) => classLookup[id] || id
                          )
                          .join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No classes assigned
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="brand-button--ghost"
                      onClick={() => openEditModal(user)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="brand-button"
                      onClick={() =>
                        handleDelete(
                          user.id,
                          user.role,
                          user.classes
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No users found.
            </p>
          )}
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-unt-green/90">
                  {editingUserId ? "Edit" : "Add"} User
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingUserId
                    ? "Update user details"
                    : "Create a new user"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formState.fname}
                    onChange={(event) =>
                      handleInputChange(
                        "fname",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formState.lname}
                    onChange={(event) =>
                      handleInputChange(
                        "lname",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  User ID
                </label>
                <input
                  type="text"
                  value={formState.userId}
                  onChange={(event) =>
                    handleInputChange(
                      "userId",
                      event.target.value
                    )
                  }
                  placeholder={`${idPrefixByRole[formState.role]}${idSeedByRole[formState.role]}`}
                  disabled={Boolean(editingUserId)}
                  className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white disabled:dark:bg-slate-800/60"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  IDs must start with A, T, or S and a number
                  sequence (e.g., S1000). New students start at
                  S1000 and increment from the highest existing ID.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    handleInputChange(
                      "email",
                      event.target.value
                    )
                  }
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Role
                  </label>
                  <select
                    value={formState.role}
                    onChange={(event) =>
                      handleInputChange(
                        "role",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Classes
                  </label>
                  <div className="mt-2 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200/70 bg-white/90 p-3 text-sm shadow-inner dark:border-slate-700/60 dark:bg-slate-900/70">
                    {classes.length ? (
                      classes.map((classItem) => (
                        <label
                          key={classItem.id}
                          className="flex items-center gap-2 text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={formState.classes.includes(
                              classItem.id
                            )}
                            onChange={() =>
                              toggleClassSelection(
                                classItem.id
                              )
                            }
                          />
                          <span>{classItem.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No classes available.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="brand-button--ghost"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="brand-button"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving…"
                    : editingUserId
                    ? "Save Changes"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
};

export default AdminUsers;
