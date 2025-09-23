import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { DateTime } from "luxon";

import { processClassReminders } from "../lib/class-reminders";
import { processAttendanceRisk } from "../lib/attendance-risk";
import {
  processAttendanceDecisionTask,
} from "../lib/attendance-decision";
import { parseSchedule, CENTRAL_TIMEZONE } from "../lib/time";
import type {
  AttendanceDecisionTaskData,
  AttendanceRecord,
  ClassInfo,
  NotificationCreation,
  StudentInfo,
} from "../lib/types";

chai.use(sinonChai);

describe("notification orchestration", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("parses schedules with multiple days", () => {
    const baseDate = DateTime.fromISO("2024-04-01T00:00:00", { zone: CENTRAL_TIMEZONE });
    const parsed = parseSchedule("MWF 9:00AM - 9:50AM", { baseDate });

    expect(parsed).to.not.be.null;
    expect(parsed?.days).to.deep.equal([1, 3, 5]);
    expect(parsed?.start.hour).to.equal(9);
    expect(parsed?.end.hour).to.equal(9);
    expect(parsed?.end.minute).to.equal(50);
  });

  it("emits reminders for classes starting soon", async () => {
    const now = DateTime.fromISO("2024-04-01T08:55:00", { zone: CENTRAL_TIMEZONE });
    const writer = sinon.spy(async (_creation: NotificationCreation) => {});

    await processClassReminders({
      now,
      classes: [
        {
          id: "CS101",
          name: "Intro to CS",
          schedule: "MWF 9:00AM - 9:50AM",
        } as ClassInfo,
      ],
      studentsByClass: {
        CS101: [
          {
            id: "student-1",
            email: "student@example.com",
          } as StudentInfo,
        ],
      },
      writer,
    });

    expect(writer).to.have.been.calledOnce;
    const payload = writer.firstCall.args[0];
    expect(payload.surfaces).to.deep.equal(["toast", "inbox"]);
    expect(payload.payload).to.include({ classId: "CS101", minutesUntilStart: 5 });
  });

  it("skips reminders outside the lookahead window", async () => {
    const now = DateTime.fromISO("2024-04-01T07:00:00", { zone: CENTRAL_TIMEZONE });
    const writer = sinon.spy(async (_creation: NotificationCreation) => {});

    await processClassReminders({
      now,
      classes: [
        {
          id: "CS101",
          name: "Intro to CS",
          schedule: "MWF 9:00AM - 9:50AM",
        } as ClassInfo,
      ],
      studentsByClass: { CS101: [{ id: "student-1" } as StudentInfo] },
      writer,
    });

    expect(writer).to.not.have.been.called;
  });

  it("sends attendance risk warnings when the absence threshold is crossed", async () => {
    const writer = sinon.spy(async (_creation: NotificationCreation) => {});

    await processAttendanceRisk(
      {
        before: {
          id: "att-1",
          classID: "CS101",
          studentID: "student-1",
          status: "Present",
        } as AttendanceRecord,
        after: {
          id: "att-1",
          classID: "CS101",
          studentID: "student-1",
          status: "Absent",
        } as AttendanceRecord,
      },
      {
        threshold: 5,
        absenceCount: 6,
        student: { id: "student-1", email: "student@example.com" },
        classInfo: { id: "CS101", name: "Intro to CS" },
        writer,
      }
    );

    expect(writer).to.have.been.calledOnce;
    const payload = writer.firstCall.args[0];
    expect(payload.surfaces).to.deep.equal(["banner", "inbox"]);
    expect(payload.payload).to.include({ absenceCount: 6, threshold: 6 });
  });

  it("reschedules decision notifications when attendance is still pending", async () => {
    const reschedule = sinon.spy(async (_payload: AttendanceDecisionTaskData, _delay: number) => {});

    await processAttendanceDecisionTask(
      { recordPath: "attendance/doc-1", attempt: 1 },
      {
        loadRecord: async () => ({
          id: "doc-1",
          status: "pending",
        } as AttendanceRecord),
        reschedule,
      }
    );

    expect(reschedule).to.have.been.calledOnce;
    const [payload, delay] = reschedule.firstCall.args;
    expect(payload.attempt).to.equal(2);
    expect(delay).to.equal(600);
  });

  it("emits decision notifications with toast metadata for successful attendance", async () => {
    const writer = sinon.spy(async (_creation: NotificationCreation) => {});
    const reviewDate = new Date("2024-04-01T09:05:00-05:00");

    await processAttendanceDecisionTask(
      { recordPath: "attendance/doc-2" },
      {
        loadRecord: async () => ({
          id: "doc-2",
          classID: "CS101",
          studentID: "student-1",
          status: "Present",
          date: reviewDate,
        } as AttendanceRecord),
        fetchStudent: async () => ({ id: "student-1", email: "student@example.com" }),
        fetchClass: async () => ({ id: "CS101", name: "Intro to CS" }),
        writer,
      }
    );

    expect(writer).to.have.been.calledOnce;
    const payload = writer.firstCall.args[0];
    expect(payload.surfaces).to.deep.equal(["toast", "inbox"]);
    expect(payload.toast).to.exist;
    expect(payload.payload).to.include({ showToast: true, classId: "CS101" });
  });

  it("emits banner-only decisions when attendance is marked absent", async () => {
    const writer = sinon.spy(async (_creation: NotificationCreation) => {});

    await processAttendanceDecisionTask(
      { recordPath: "attendance/doc-3" },
      {
        loadRecord: async () => ({
          id: "doc-3",
          classID: "CS101",
          studentID: "student-1",
          status: "Absent",
        } as AttendanceRecord),
        fetchStudent: async () => ({ id: "student-1", email: "student@example.com" }),
        fetchClass: async () => ({ id: "CS101", name: "Intro to CS" }),
        writer,
      }
    );

    expect(writer).to.have.been.calledOnce;
    const payload = writer.firstCall.args[0];
    expect(payload.surfaces).to.deep.equal(["banner", "inbox"]);
    expect(payload.toast).to.be.undefined;
    expect(payload.payload).to.include({ showToast: false });
  });
});

