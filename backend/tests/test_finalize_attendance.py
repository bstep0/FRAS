import datetime
import importlib
import importlib.util
import sys
import types

import pytest

from pathlib import Path
from zoneinfo import ZoneInfo


CENTRAL_TZ = ZoneInfo("America/Chicago")
DELETE_FIELD = object()


class FakeDocumentSnapshot:
    def __init__(self, data):
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        if self._data is None:
            return None
        return dict(self._data)


class FakeDocument:
    def __init__(self, store, doc_id):
        self._store = store
        self._doc_id = doc_id

    def get(self):
        data = self._store.get(self._doc_id)
        if data is None:
            return FakeDocumentSnapshot(None)
        return FakeDocumentSnapshot(dict(data))

    def set(self, data):
        self._store[self._doc_id] = dict(data)

    def update(self, updates):
        if self._doc_id not in self._store:
            raise KeyError("Document does not exist")
        record = self._store[self._doc_id]
        for key, value in updates.items():
            if value is DELETE_FIELD:
                record.pop(key, None)
            else:
                record[key] = value


class FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id):
        return FakeDocument(self._store, doc_id)


class FakeFirestore:
    def __init__(self, initial_attendance=None):
        attendance_data = {}
        if initial_attendance:
            for key, value in initial_attendance.items():
                attendance_data[key] = dict(value)
        self._collections = {"attendance": attendance_data}

    def collection(self, name):
        store = self._collections.setdefault(name, {})
        return FakeCollection(store)

    def get_attendance(self, record_id):
        return self._collections["attendance"].get(record_id)


class FakeBucket:
    pass


@pytest.fixture
def load_app(monkeypatch):
    def _loader(initial_attendance):
        monkeypatch.setenv("EAGLENET_IP_ALLOWLIST", "10.0.0.0/8")

        fake_db = FakeFirestore(initial_attendance)

        flask_module = types.ModuleType("flask")

        class FakeFlask:
            def __init__(self, _name):
                pass

            def after_request(self, func):
                return func

            def route(self, *args, **kwargs):
                def decorator(func):
                    return func

                return decorator

        flask_module.Flask = FakeFlask
        flask_module.request = types.SimpleNamespace()
        flask_module.jsonify = lambda payload: payload

        firebase_admin_module = types.ModuleType("firebase_admin")
        credentials_module = types.ModuleType("firebase_admin.credentials")
        credentials_module.Certificate = lambda path: object()

        firestore_module = types.ModuleType("firebase_admin.firestore")
        firestore_module.DELETE_FIELD = DELETE_FIELD
        firestore_module.client = lambda: fake_db

        storage_module = types.ModuleType("firebase_admin.storage")
        storage_module.bucket = lambda: FakeBucket()

        firebase_admin_module.credentials = credentials_module
        firebase_admin_module.firestore = firestore_module
        firebase_admin_module.storage = storage_module
        firebase_admin_module.initialize_app = lambda *args, **kwargs: None

        sys.modules["flask"] = flask_module
        if "cv2" not in sys.modules:
            cv2_module = types.ModuleType("cv2")
            cv2_module.IMREAD_COLOR = 1
            cv2_module.imdecode = lambda *args, **kwargs: None
            cv2_module.imwrite = lambda *args, **kwargs: None
            sys.modules["cv2"] = cv2_module

        if "deepface" not in sys.modules:
            deepface_module = types.ModuleType("deepface")

            class _FakeDeepFace:
                @staticmethod
                def verify(*args, **kwargs):
                    return {"verified": True, "distance": 0.0, "max_threshold_to_verify": 0.0}

            deepface_module.DeepFace = _FakeDeepFace
            sys.modules["deepface"] = deepface_module

        if "numpy" not in sys.modules:
            numpy_module = types.ModuleType("numpy")
            numpy_module.frombuffer = lambda *args, **kwargs: b""
            numpy_module.uint8 = "uint8"
            sys.modules["numpy"] = numpy_module

        sys.modules["firebase_admin"] = firebase_admin_module
        sys.modules["firebase_admin.credentials"] = credentials_module
        sys.modules["firebase_admin.firestore"] = firestore_module
        sys.modules["firebase_admin.storage"] = storage_module

        sys.modules.pop("backend", None)
        sys.modules.pop("backend.app", None)

        backend_pkg = types.ModuleType("backend")
        backend_pkg.__path__ = [str(Path(__file__).resolve().parents[1])]
        sys.modules["backend"] = backend_pkg

        module_path = Path(__file__).resolve().parents[1] / "app.py"
        spec = importlib.util.spec_from_file_location("backend.app", module_path)
        app_module = importlib.util.module_from_spec(spec)
        sys.modules["backend.app"] = app_module
        spec.loader.exec_module(app_module)
        app_module.db = fake_db
        app_module.bucket = FakeBucket()
        return app_module, fake_db

    return _loader


def test_finalize_attendance_accepts_allowlisted_request(load_app):
    record_id = "CPSC101_A12345_2024-04-01"
    original_record = {
        "studentID": "A12345",
        "classID": "CPSC101",
        "date": datetime.datetime(2024, 4, 1, 9, 0, tzinfo=CENTRAL_TZ),
        "status": "pending",
        "isPending": True,
        "proposedStatus": "Present",
    }

    app_module, fake_db = load_app({record_id: original_record})

    request_payload = {"recordId": record_id}

    def get_json(silent=True):
        assert silent is True
        return request_payload

    app_module.request = types.SimpleNamespace(
        headers={"X-Forwarded-For": "10.5.6.7"},
        remote_addr="10.5.6.7",
        get_json=get_json,
    )

    payload, status_code = app_module.finalize_attendance()

    assert status_code == 200
    assert payload["status"] == "success"
    assert payload["finalStatus"] == "Present"

    stored_record = fake_db.get_attendance(record_id)
    assert stored_record["status"] == "Present"
    assert stored_record["date"] == original_record["date"]
    assert "proposedStatus" not in stored_record
    assert "isPending" not in stored_record
    assert "rejectionReason" not in stored_record
    assert "finalizedAt" in stored_record


def test_finalize_attendance_rejects_outside_allowlist(load_app):
    record_id = "CPSC101_A12345_2024-04-02"
    original_record = {
        "studentID": "A12345",
        "classID": "CPSC101",
        "date": datetime.datetime(2024, 4, 2, 9, 0, tzinfo=CENTRAL_TZ),
        "status": "pending",
        "isPending": True,
        "proposedStatus": "Late",
    }

    app_module, fake_db = load_app({record_id: original_record})

    request_payload = {"recordId": record_id}

    def get_json(silent=True):
        assert silent is True
        return request_payload

    app_module.request = types.SimpleNamespace(
        headers={"X-Forwarded-For": "203.0.113.10"},
        remote_addr="203.0.113.10",
        get_json=get_json,
    )

    payload, status_code = app_module.finalize_attendance()

    assert status_code == 403
    assert payload["status"] == "rejected"
    assert "Follow-up request must originate from EagleNet." in payload["message"]

    stored_record = fake_db.get_attendance(record_id)
    assert stored_record["status"] == "Rejected"
    assert stored_record["date"] == original_record["date"]
    assert stored_record["rejectionReason"] == "Follow-up request must originate from EagleNet."
    assert "proposedStatus" not in stored_record
    assert "isPending" not in stored_record
    assert "finalizedAt" in stored_record
