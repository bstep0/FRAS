import React from "react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-unt-green">
            Student Privacy
          </p>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-slate-600">
            This policy explains how we collect, use, and safeguard student information when using
            the face scanning attendance feature.
          </p>
        </header>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <p className="text-slate-700">
            When you check in for attendance, we capture a photo of your face and associate it with
            your student account and selected class.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            <li>Student identifiers such as ID, name, and enrolled classes.</li>
            <li>Captured facial images used only for verifying class attendance.</li>
            <li>System metadata like timestamp and device information for security logging.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">How We Use Your Data</h2>
          <p className="text-slate-700">
            We process the captured image to confirm your identity for attendance purposes only. The
            resulting attendance record is stored in alignment with institutional retention
            schedules and applicable student data protections.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Data Security & Sharing</h2>
          <p className="text-slate-700">
            Access to your data is restricted to authorized university systems and personnel
            supporting course attendance. We do not sell or use student images for advertising. Data
            may be shared only as required by law or to comply with accreditation and audit needs.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Your Choices</h2>
          <p className="text-slate-700">
            By proceeding with the scan, you consent to the capture and processing of your image for
            attendance verification. If you have questions or would like to request access, updates,
            or deletion consistent with university policy, please contact your instructor or the
            registrar.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/" className="brand-button">
            Return to Login
          </Link>
          <Link to="/student" className="brand-button--ghost">
            Go to Student Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
