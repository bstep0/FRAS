import { collection, getDocs, query, where } from "firebase/firestore";

const CLASS_ID_FIELDS = ["classID", "classId"];
const STUDENT_ID_FIELDS = ["studentID", "studentId"];

const extractStudentId = (record) =>
  record?.studentID || record?.studentId || record?.student || "";

const buildQueries = (attendanceRef, classId, studentId) => {
  const queries = [];

  CLASS_ID_FIELDS.forEach((classField) => {
    if (studentId) {
      STUDENT_ID_FIELDS.forEach((studentField) => {
        queries.push(
          getDocs(
            query(
              attendanceRef,
              where(classField, "==", classId),
              where(studentField, "==", studentId)
            )
          )
        );
      });
      return;
    }

    queries.push(getDocs(query(attendanceRef, where(classField, "==", classId))));
  });

  return queries;
};

export const fetchAttendanceDocuments = async (db, classId, studentId) => {
  const attendanceRef = collection(db, "attendance");
  const queries = buildQueries(attendanceRef, classId, studentId);

  const snapshots = await Promise.all(queries);
  const merged = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.forEach((docSnapshot) => {
      merged.set(docSnapshot.id, { id: docSnapshot.id, ...docSnapshot.data() });
    });
  });

  return Array.from(merged.values());
};

export const collectStudentIds = (records) =>
  Array.from(
    new Set(records.map((record) => extractStudentId(record)).filter(Boolean))
  );

export { extractStudentId };
