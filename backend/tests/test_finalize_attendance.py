import datetime
import importlib
import importlib.util
import sys
import types
import logging

import pytest

from pathlib import Path
from zoneinfo import ZoneInfo


CENTRAL_TZ = ZoneInfo("America/Chicago")
DELETE_FIELD = object()


class FakeDocumentSnapshot:
    def __init__(self, data, doc_id=None):
        self._data = data
        self._doc_id = doc_id

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        if self._data is None:
            return None
        return dict(self._data)

    @property
    def id(self):
        return self._doc_id


class FakeDocument:
    def __init__(self, store, doc_id):
        self._store = store
        self._doc_id = doc_id

    @property
    def id(self):
        return self._doc_id

    def get(self):
        data = self._store.get(self._doc_id)
        if data is None:
            return FakeDocumentSnapshot(None, self._doc_id)
        return FakeDocumentSnapshot(dict(data), self._doc_id)

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

        class FakeResponse:
            def __init__(self, iterable=None, mimetype=None, status=200):
                self.iterable = iterable
                self.mimetype = mimetype
                self.headers = {}
                self.status_code = status

        def fake_stream_with_context(generator):
            return generator

        class FakeFlask:
            def __init__(self, _name):
                self._after_request_handlers = []
                self._routes = {}
                self.logger = logging.getLogger("fake_flask_app")

            def after_request(self, func):
                self._after_request_handlers.append(func)
                return func

            def route(self, *args, **kwargs):
                rule = args[0] if args else ""
                methods = kwargs.get("methods") or ["GET"]

                def decorator(func):
                    entry = self._routes.setdefault(rule, {})
                    for method in methods:
                        entry[method.upper()] = func
                    return func

                return decorator

            def _build_response(self, result):
                headers = {}
                status = 200
                payload = result

                if isinstance(result, FakeResponse):
                    payload = result.iterable
                    status = getattr(result, "status_code", 200)
                    headers = dict(result.headers)
                elif isinstance(result, tuple):
                    payload = result[0]
                    if len(result) > 1:
                        status = result[1]
                    if len(result) > 2 and isinstance(result[2], dict):
                        headers = dict(result[2])

                response = FakeResponse(payload, None, status)
                response.headers.update(headers)

                for handler in self._after_request_handlers:
                    maybe_new = handler(response)
                    if maybe_new is not None:
                        response = maybe_new

                return response

            def test_client(self):
                app = self

                class FakeClient:
                    def _invoke(self, path, method, json_payload=None, headers=None, environ=None):
                        headers = headers or {}
                        environ = environ or {}

                        flask_module.request.headers = headers
                        flask_module.request.remote_addr = environ.get("REMOTE_ADDR")
                        flask_module.request.get_json = lambda silent=True: json_payload
                        flask_module.request.method = method

                        handler = app._routes.get(path, {}).get(method)
                        if handler is None:
                            raise AssertionError(f"No handler registered for {method} {path}")

                        result = handler()
                        return app._build_response(result)

                    def post(self, path, json=None, headers=None, environ_base=None):
                        return self._invoke(path, "POST", json_payload=json, headers=headers, environ=environ_base)

                    def options(self, path, json=None, headers=None, environ_base=None):
                        return self._invoke(path, "OPTIONS", json_payload=json, headers=headers, environ=environ_base)

                return FakeClient()

        flask_module.Flask = FakeFlask
        flask_module.request = types.SimpleNamespace()
        flask_module.jsonify = lambda payload: payload
        flask_module.Response = FakeResponse
        flask_module.stream_with_context = fake_stream_with_context

        firebase_admin_module = types.ModuleType("firebase_admin")
        credentials_module = types.ModuleType("firebase_admin.credentials")
        credentials_module.Certificate = lambda path: object()

        firestore_module = types.ModuleType("firebase_admin.firestore")
        firestore_module.DELETE_FIELD = DELETE_FIELD
        firestore_module.client = lambda: fake_db

        storage_module = types.ModuleType("firebase_admin.storage")
        storage_module.bucket = lambda: FakeBucket()

        auth_module = types.ModuleType("firebase_admin.auth")

        class _FakeAuth:
            class InvalidIdTokenError(Exception):
                pass

            class ExpiredIdTokenError(Exception):
                pass

            class RevokedIdTokenError(Exception):
                pass

            @staticmethod
            def verify_id_token(_token):
                return {"uid": "fake-teacher", "email": "teacher@example.com"}

        auth_module.InvalidIdTokenError = _FakeAuth.InvalidIdTokenError
        auth_module.ExpiredIdTokenError = _FakeAuth.ExpiredIdTokenError
        auth_module.RevokedIdTokenError = _FakeAuth.RevokedIdTokenError
        auth_module.verify_id_token = _FakeAuth.verify_id_token

        firebase_admin_module.credentials = credentials_module
        firebase_admin_module.firestore = firestore_module
        firebase_admin_module.storage = storage_module
        firebase_admin_module.auth = auth_module
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
        sys.modules["firebase_admin.auth"] = auth_module

        preserved_backend_pkg = sys.modules.get("backend")
        preserved_backend_app = sys.modules.get("backend.app")

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

        result = (app_module, fake_db)

        if preserved_backend_app is not None:
            sys.modules["backend.app"] = preserved_backend_app
        else:
            sys.modules.pop("backend.app", None)

        if preserved_backend_pkg is not None:
            sys.modules["backend"] = preserved_backend_pkg
        else:
            sys.modules.pop("backend", None)

        return result

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
