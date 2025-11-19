import React, { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import AdminLayout from "./AdminLayout";
import { db } from "../firebaseConfig";
import { useNotifications } from "../context/NotificationsContext";

const defaultClassState = {
  classId: "",
  name: "",
  room: "",
  schedule: "",
  teacher: "",
  teacherName: "",
};

const AdminClasses = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(defaultClassState);
  const [editingClassId, setEditingClassId] = useState(null);

  const { pushToast } = useNotifications();

  const fetchTeachers = async () => {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    return snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data();
        const name = [data.fname, data.lname].filter(Boolean).join(" ");
        const rawRole = data.role || data.userType || "";
        return {
          id: docSnapshot.id,
          name: name || data.displayName || data.name || data.email || "Instructor",
          email: data.email || "",
          role: rawRole ? String(rawRole).toLowerCase() : "",
          classes: Array.isArray(data.classes) ? data.classes.filter(Boolean) : [],
        };
      })
      .filter((user) => user.role === "teacher");
  };

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const [classSnapshot, teacherList] = await Promise.all([
        getDocs(collection(db, "classes")),
        fetchTeachers(),
      ]);

      const teacherLookup = teacherList.reduce((acc, teacher) => {
        acc[teacher.id] = teacher.name;
        return acc;
      }, {});

      const normalized = classSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        const teacherName = data.teacherName || teacherLookup[data.teacher] || "";
        return {
          id: docSnapshot.id,
          classId: data.classId || docSnapshot.id,
          name: data.name || data.title || "Untitled Class",
          room: data.room || "",
          schedule: data.schedule || "",
          teacher: data.teacher || "",
          teacherName,
        };
      });

      setClasses(normalized);
      setTeachers(teacherList);
    } catch (error) {
      console.error("Failed to fetch classes", error);
      pushToast({
        tone: "error",
        title: "Unable to load classes",
        message: "We couldn't retrieve classes right now. Please try again soon.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setFormState(defaultClassState);
    setEditingClassId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (classItem) => {
    setFormState({
      classId: classItem.classId || classItem.id || "",
      name: classItem.name || "",
      room: classItem.room || "",
      schedule: classItem.schedule || "",
      teacher: classItem.teacher || "",
      teacherName: classItem.teacherName || "",
    });
    setEditingClassId(classItem.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const handleInputChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const syncTeacherAssignments = async (classId, newTeacherId, previousTeacherId) => {
    const updates = [];

    if (previousTeacherId && previousTeacherId !== newTeacherId) {
      const prevTeacherRef = doc(db, "users", previousTeacherId);
      updates.push(updateDoc(prevTeacherRef, { classes: arrayRemove(classId) }));
    }

    if (newTeacherId) {
      const newTeacherRef = doc(db, "users", newTeacherId);
      updates.push(updateDoc(newTeacherRef, { classes: arrayUnion(classId) }));
    }

    await Promise.all(updates);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedClassId = formState.classId.trim();
    const selectedTeacher = teachers.find((teacher) => teacher.id === formState.teacher);
    const selectedTeacherName = selectedTeacher?.name || formState.teacherName || "";

    if (!trimmedClassId) {
      pushToast({
        tone: "warning",
        title: "Missing class ID",
        message: "Please provide a unique class ID before saving.",
      });
      return;
    }

    if (!formState.name.trim()) {
      pushToast({
        tone: "warning",
        title: "Missing name",
        message: "Please provide a class name before saving.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: trimmedClassId,
        name: formState.name.trim(),
        room: formState.room.trim(),
        schedule: formState.schedule.trim(),
        teacher: formState.teacher,
      };

      if (editingClassId) {
        const classRef = doc(db, "classes", editingClassId);
        const existing = classes.find((classItem) => classItem.id === editingClassId);
        await updateDoc(classRef, payload);
        await syncTeacherAssignments(editingClassId, payload.teacher, existing?.teacher || "");
        pushToast({ tone: "success", title: "Class updated", message: "Changes saved successfully." });
      } else {
        const classRef = doc(db, "classes", trimmedClassId);
        await setDoc(classRef, payload);
        await syncTeacherAssignments(trimmedClassId, payload.teacher, "");
        pushToast({ tone: "success", title: "Class created", message: "The class was added successfully." });
      }

      closeModal();
      fetchClasses();
    } catch (error) {
      console.error("Failed to save class", error);
      pushToast({
        tone: "error",
        title: "Save failed",
        message: "We couldn't save the class. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (classId) => {
    const confirmed = window.confirm("Delete this class? This action cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "classes", classId));

      const usersRef = collection(db, "users");
      const enrollmentQuery = query(usersRef, where("classes", "array-contains", classId));
      const enrollmentSnapshot = await getDocs(enrollmentQuery);

      const updates = enrollmentSnapshot.docs.map((docSnapshot) =>
        updateDoc(docSnapshot.ref, { classes: arrayRemove(classId) })
      );

      await Promise.all(updates);

      pushToast({ tone: "success", title: "Class deleted", message: "The class was removed." });
      fetchClasses();
    } catch (error) {
      console.error("Failed to delete class", error);
      pushToast({
        tone: "error",
        title: "Delete failed",
        message: "We couldn't delete the class right now.",
      });
    }
  };

  const teacherLookup = useMemo(() => {
    return teachers.reduce((acc, teacher) => {
      acc[teacher.id] = teacher.name;
      return acc;
    }, {});
  }, [teachers]);

  return (
    <AdminLayout
      title="Class Management"
      headerActions={
        <button type="button" onClick={fetchClasses} className="brand-button--ghost" disabled={isLoading}>
          Refresh
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Classes</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Manage course details and instructor assignments.
            </p>
          </div>
          <button type="button" className="brand-button" onClick={openCreateModal}>
            Add Class
          </button>
        </div>

        <section className="glass-card">
          {isLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading classes…</p>
          ) : classes.length ? (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {classItem.classId || classItem.id} · {classItem.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {classItem.room ? `Room: ${classItem.room}` : "Room not set"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {classItem.schedule ? `Schedule: ${classItem.schedule}` : "Schedule not set"}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-unt-green">
                      {classItem.teacherName
                        || teacherLookup[classItem.teacher]
                        || classItem.teacher
                        || "No instructor"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="brand-button--ghost"
                      onClick={() => openEditModal(classItem)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="brand-button"
                      onClick={() => handleDelete(classItem.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">No classes found.</p>
          )}
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-unt-green/90">{editingClassId ? "Edit" : "Add"} Class</p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingClassId ? "Update class details" : "Create a new class"}
                </h3>
              </div>
              <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                ✕
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Class ID</label>
                  <input
                    type="text"
                    value={formState.classId}
                    onChange={(event) => handleInputChange("classId", event.target.value)}
                    required
                    disabled={isSaving}
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white dark:disabled:bg-slate-800"
                    placeholder="e.g., CS101"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Class Name</label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(event) => handleInputChange("name", event.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Room</label>
                  <input
                    type="text"
                    value={formState.room}
                    onChange={(event) => handleInputChange("room", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Schedule</label>
                  <input
                    type="text"
                    value={formState.schedule}
                    onChange={(event) => handleInputChange("schedule", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Instructor</label>
                  <select
                    value={formState.teacher}
                    onChange={(event) => handleInputChange("teacher", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                  >
                    <option value="">Unassigned</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
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
                  {isSaving ? "Saving…" : editingClassId ? "Save Changes" : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
};

export default AdminClasses;
